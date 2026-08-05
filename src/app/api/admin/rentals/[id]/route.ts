import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  isValidBookingId,
  parseRentalEditInput,
  rentalBookingIsEditable,
} from "@/lib/admin/booking-edit";
import { verifyAdminAccess } from "@/lib/admin/session";
import {
  planRentalReschedule,
  type RentalConflictCandidate,
} from "@/lib/bookings/rental-reschedule-validation";
import { RENTAL_INVENTORY_BLOCKING_STATUSES } from "@/lib/bookings/rental-lifecycle";
import {
  summarizeGoogleCalendarError,
  syncGoogleCalendarDestinations,
  updateGoogleCalendarEvent,
} from "@/lib/google/calendar";
import { rateLimit } from "@/lib/rate-limit";
import {
  buildRentalCalendarDescription,
  isFoamPartyRentalItem,
  rentalCalendarDateTimes,
} from "@/lib/rentals/rental-pricing-text";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const RENTAL_EDIT_SELECT =
  "id, status, customer_name, customer_email, customer_phone, rental_item, rental_name, event_date, duration, span_days, event_address, delivery_time, event_start_time, requested_delivery_window, distance_miles, delivery_fee, mileage_fee, setup_location, setup_surface, setup_access, setup_notes, payment_method, subtotal, total, google_calendar_event_id, google_calendar_secondary_event_id, google_foam_calendar_event_id";

type RentalEditRow = {
  id: number | string;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  rental_item: string;
  rental_name: string | null;
  event_date: string;
  duration: string | null;
  span_days: number | null;
  event_address: string | null;
  delivery_time: string | null;
  event_start_time: string | null;
  requested_delivery_window: string | null;
  distance_miles: number | null;
  delivery_fee: number | null;
  mileage_fee: number | null;
  setup_location: string | null;
  setup_surface: string | null;
  setup_access: string | null;
  setup_notes: string | null;
  payment_method: string | null;
  subtotal: number | null;
  total: number | null;
  google_calendar_event_id: string | null;
  google_calendar_secondary_event_id: string | null;
  google_foam_calendar_event_id: string | null;
};

type RentalItemRow = {
  booking_id: number | string;
  rental_item: string;
  rental_name: string | null;
};

async function loadConflictCandidates(
  supabase: ReturnType<typeof createServiceRoleClient>,
  bookingId: string,
): Promise<RentalConflictCandidate[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, status, event_date, span_days, rental_item")
    .in("status", [...RENTAL_INVENTORY_BLOCKING_STATUSES])
    .neq("id", bookingId);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as {
    id: number | string;
    status: string;
    event_date: string;
    span_days: number | null;
    rental_item: string;
  }[];

  const ids = rows.map((row) => row.id);
  const itemMap = new Map<string, string[]>();

  if (ids.length > 0) {
    const { data: itemRows, error: itemError } = await supabase
      .from("booking_rental_items")
      .select("booking_id, rental_item")
      .in("booking_id", ids);
    if (itemError) throw new Error(itemError.message);
    for (const item of (itemRows ?? []) as {
      booking_id: number | string;
      rental_item: string;
    }[]) {
      const key = String(item.booking_id);
      itemMap.set(key, [...(itemMap.get(key) ?? []), item.rental_item]);
    }
  }

  return rows.map((row) => ({
    id: String(row.id),
    status: row.status,
    eventDate: String(row.event_date).slice(0, 10),
    spanDays:
      typeof row.span_days === "number" && row.span_days >= 1
        ? row.span_days
        : 1,
    rentalItems: itemMap.get(String(row.id)) ?? [row.rental_item],
  }));
}

async function syncApprovedRentalCalendar(input: {
  supabase: ReturnType<typeof createServiceRoleClient>;
  booking: RentalEditRow;
  items: { rental_item: string; rental_name: string | null }[];
}): Promise<boolean> {
  const spanDays =
    typeof input.booking.span_days === "number" && input.booking.span_days >= 1
      ? input.booking.span_days
      : 1;
  const durationLabel = input.booking.duration?.trim() || "One Day";
  const customerName = input.booking.customer_name?.trim() || "Guest";
  const rentalLabel =
    input.booking.rental_name?.trim() || input.booking.rental_item;
  const eventDate = String(input.booking.event_date).slice(0, 10);
  const { start, end } = rentalCalendarDateTimes(
    eventDate,
    input.booking.delivery_time,
    spanDays,
    input.booking.event_start_time,
  );

  const calendarItems = input.items.map((item) => ({
    rental_item: item.rental_item,
    rental_name: item.rental_name ?? undefined,
  }));
  const rentalOnlyItems = calendarItems.filter(
    (item) => !isFoamPartyRentalItem(item.rental_item),
  );
  const foamItems = calendarItems.filter((item) =>
    isFoamPartyRentalItem(item.rental_item),
  );

  let ok = true;

  if (rentalOnlyItems.length > 0) {
    const description = buildRentalCalendarDescription({
      items: rentalOnlyItems,
      durationLabel:
        rentalOnlyItems.length === calendarItems.length ? durationLabel : "One Day",
      spanDays,
      total: input.booking.total,
      deliveryFee: input.booking.delivery_fee,
      mileageFee: input.booking.mileage_fee,
      distanceMiles: input.booking.distance_miles,
      eventDateYmd: eventDate,
      deliveryTime: input.booking.delivery_time,
      eventStartTime: input.booking.event_start_time,
      requestedDeliveryWindow: input.booking.requested_delivery_window,
      customerName,
      customerPhone: input.booking.customer_phone,
      customerEmail: input.booking.customer_email,
      eventAddress: input.booking.event_address,
      setupSurface: input.booking.setup_surface,
      setupAccess: input.booking.setup_access,
      setupNotes: input.booking.setup_notes,
      paymentMethod: input.booking.payment_method,
      bookingId: String(input.booking.id),
    });

    try {
      const sync = await syncGoogleCalendarDestinations({
        title: `Rental - ${rentalLabel} - ${customerName}`,
        description,
        start,
        end,
        idempotencyKeyBase: `rental-${input.booking.id}-calendar-v1`,
        primaryEventId: input.booking.google_calendar_event_id,
        secondaryEventId: input.booking.google_calendar_secondary_event_id,
      });

      if (sync.primaryStatus === "failed" || sync.secondaryStatus === "failed") {
        ok = false;
      }

      const { error: calendarIdError } = await input.supabase
        .from("bookings")
        .update({
          google_calendar_event_id:
            sync.primaryEventId ?? input.booking.google_calendar_event_id,
          google_calendar_secondary_event_id:
            sync.secondaryEventId ??
            input.booking.google_calendar_secondary_event_id,
        })
        .eq("id", input.booking.id);

      if (calendarIdError) {
        console.error(
          "[api/admin/rentals/edit] calendar id save error",
          calendarIdError.code,
        );
        ok = false;
      }
    } catch (error) {
      console.error(
        "[api/admin/rentals/edit] calendar sync failed",
        summarizeGoogleCalendarError(error),
      );
      ok = false;
    }
  }

  if (foamItems.length > 0 && input.booking.google_foam_calendar_event_id) {
    const foamDescription = buildRentalCalendarDescription({
      items: foamItems,
      durationLabel,
      spanDays,
      total: input.booking.total,
      deliveryFee: input.booking.delivery_fee,
      mileageFee: input.booking.mileage_fee,
      distanceMiles: input.booking.distance_miles,
      eventDateYmd: eventDate,
      deliveryTime: input.booking.delivery_time,
      eventStartTime: input.booking.event_start_time,
      requestedDeliveryWindow: input.booking.requested_delivery_window,
      customerName,
      customerPhone: input.booking.customer_phone,
      customerEmail: input.booking.customer_email,
      eventAddress: input.booking.event_address,
      setupSurface: input.booking.setup_surface,
      setupAccess: input.booking.setup_access,
      setupNotes: input.booking.setup_notes,
      paymentMethod: input.booking.payment_method,
      bookingId: String(input.booking.id),
    });

    const foamCalendarId =
      process.env.GOOGLE_FOAM_CALENDAR_ID?.trim() || "primary";

    try {
      const updatedId = await updateGoogleCalendarEvent({
        eventId: input.booking.google_foam_calendar_event_id,
        title: `Foam Party - ${customerName}`,
        description: foamDescription,
        start,
        end,
        calendarId: foamCalendarId,
      });
      if (!updatedId) ok = false;
    } catch (error) {
      console.error(
        "[api/admin/rentals/edit] foam calendar update failed",
        summarizeGoogleCalendarError(error),
      );
      ok = false;
    }
  }

  return ok;
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(req, {
    scope: "admin-rental-edit",
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const auth = await verifyAdminAccess();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: "Admin authentication required." },
      { status: auth.reason === "missing_config" ? 503 : 401 },
    );
  }

  const { id } = await context.params;
  if (!isValidBookingId(id)) {
    return NextResponse.json(
      { ok: false, message: "Invalid rental ID." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = parseRentalEditInput(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.error },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();
  const { data: existing, error: loadError } = await supabase
    .from("bookings")
    .select(RENTAL_EDIT_SELECT)
    .eq("id", id)
    .maybeSingle<RentalEditRow>();

  if (loadError) {
    console.error("[api/admin/rentals/edit] load failed", loadError.code);
    return NextResponse.json(
      { ok: false, message: "Could not load this rental." },
      { status: 503 },
    );
  }

  if (!existing) {
    return NextResponse.json(
      { ok: false, message: "Rental not found." },
      { status: 404 },
    );
  }

  if (!rentalBookingIsEditable(existing.status)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Only pending or approved rentals can be edited. Restore a cancelled rental first if needed.",
      },
      { status: 409 },
    );
  }

  const { data: itemRows, error: itemError } = await supabase
    .from("booking_rental_items")
    .select("booking_id, rental_item, rental_name")
    .eq("booking_id", id);

  if (itemError) {
    console.error("[api/admin/rentals/edit] items load failed", itemError.code);
    return NextResponse.json(
      { ok: false, message: "Could not load rental items." },
      { status: 503 },
    );
  }

  const items: RentalItemRow[] =
    ((itemRows ?? []) as RentalItemRow[]).length > 0
      ? ((itemRows ?? []) as RentalItemRow[])
      : [
          {
            booking_id: existing.id,
            rental_item: existing.rental_item,
            rental_name: existing.rental_name,
          },
        ];

  const spanDays =
    typeof existing.span_days === "number" && existing.span_days >= 1
      ? existing.span_days
      : 1;
  const currentEventDate = String(existing.event_date).slice(0, 10);

  if (parsed.value.eventDate !== currentEventDate) {
    try {
      const candidates = await loadConflictCandidates(supabase, id);
      const plan = planRentalReschedule(
        {
          id,
          status: existing.status,
          eventDate: currentEventDate,
          spanDays,
          rentalItems: items.map((item) => item.rental_item),
        },
        {
          bookingId: id,
          eventDate: parsed.value.eventDate,
          spanDays,
          rentalItems: items.map((item) => item.rental_item),
        },
        candidates,
      );
      if (!plan.ok) {
        const conflict = plan.conflicts[0];
        return NextResponse.json(
          {
            ok: false,
            message: conflict
              ? `That date conflicts with another booking for ${conflict.rentalItems.join(", ")} on ${conflict.eventDate}.`
              : "That date is unavailable for one or more rental items.",
          },
          { status: 409 },
        );
      }
    } catch (error) {
      console.error("[api/admin/rentals/edit] conflict check failed", error);
      return NextResponse.json(
        { ok: false, message: "Could not verify rental availability." },
        { status: 503 },
      );
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("bookings")
    .update({
      customer_name: parsed.value.customerName,
      customer_email: parsed.value.customerEmail,
      customer_phone: parsed.value.customerPhone,
      event_date: parsed.value.eventDate,
      event_start_time: parsed.value.eventStartTime,
      requested_delivery_window: parsed.value.requestedDeliveryWindow,
      delivery_time: parsed.value.requestedDeliveryWindow,
      event_address: parsed.value.eventAddress,
      setup_location: parsed.value.setupLocation,
      setup_surface: parsed.value.setupSurface,
      setup_access: parsed.value.setupAccess,
      setup_notes: parsed.value.setupNotes,
      payment_method: parsed.value.paymentMethod,
    })
    .eq("id", id)
    .in("status", ["pending", "approved"])
    .select(RENTAL_EDIT_SELECT)
    .maybeSingle<RentalEditRow>();

  if (updateError) {
    console.error("[api/admin/rentals/edit] update failed", updateError.code);
    return NextResponse.json(
      { ok: false, message: "The rental could not be updated." },
      { status: 503 },
    );
  }

  if (!updated) {
    return NextResponse.json(
      {
        ok: false,
        message: "Rental was not updated. It may have changed status.",
      },
      { status: 409 },
    );
  }

  let calendarSyncFailed = false;
  if (updated.status === "approved") {
    calendarSyncFailed = !(await syncApprovedRentalCalendar({
      supabase,
      booking: updated,
      items,
    }));
  }

  revalidatePath("/admin/rentals");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin/deliveries");

  return NextResponse.json({
    ok: true,
    message: calendarSyncFailed
      ? "Rental updated. Calendar sync needs attention — use Retry calendar sync from Confirm if needed."
      : "Rental updated.",
    calendarSyncFailed,
  });
}
