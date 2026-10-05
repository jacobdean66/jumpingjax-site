import { revalidatePath } from "next/cache";
import { after, NextResponse } from "next/server";

import {
  buildRentalEditUpdate,
  isValidBookingId,
  parseRentalEditInput,
  rentalBookingIsEditable,
} from "@/lib/admin/booking-edit";
import { verifyAdminAccess } from "@/lib/admin/session";
import { rentalReservedDates } from "@/lib/rentals/rental-period";
import {
  summarizeGoogleCalendarError,
  syncGoogleCalendarDestinations,
  updateGoogleCalendarEvent,
} from "@/lib/google/calendar";
import { rateLimit } from "@/lib/rate-limit";
import {
  buildRentalCalendarDescription,
  foamDurationLabelForBooking,
  isFoamPartyRentalItem,
  rentalCalendarDateTimes,
} from "@/lib/rentals/rental-pricing-text";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { runRoutePlannerAgent } from "@/lib/admin/route-planner-agent";

const RENTAL_EDIT_SELECT =
  "id, status, customer_name, customer_email, customer_phone, rental_item, rental_name, event_date, duration, foam_duration, span_days, rental_day_charges, event_address, delivery_time, event_start_time, requested_delivery_window, distance_miles, delivery_fee, mileage_fee, setup_location, setup_surface, setup_access, setup_notes, payment_method, subtotal, total, google_calendar_event_id, google_calendar_secondary_event_id, google_foam_calendar_event_id";

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
  foam_duration: string | null;
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
  const foamDurationLabel = foamDurationLabelForBooking(
    calendarItems,
    durationLabel,
    input.booking.foam_duration,
  );

  let ok = true;

  if (rentalOnlyItems.length > 0) {
    const description = buildRentalCalendarDescription({
      items: rentalOnlyItems,
      durationLabel:
        rentalOnlyItems.length === calendarItems.length ? durationLabel : "One Day",
      foamDurationLabel,
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
    const foamCalendarDuration = foamDurationLabel ?? durationLabel;
    const foamDescription = buildRentalCalendarDescription({
      items: foamItems,
      durationLabel: foamCalendarDuration,
      foamDurationLabel: foamCalendarDuration,
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

  const loadedItems: RentalItemRow[] =
    ((itemRows ?? []) as RentalItemRow[]).length > 0
      ? ((itemRows ?? []) as RentalItemRow[])
      : [
          {
            booking_id: existing.id,
            rental_item: existing.rental_item,
            rental_name: existing.rental_name,
          },
        ];

  const items = loadedItems.some(item => item.rental_item === existing.rental_item) ? loadedItems :
    [...loadedItems, { booking_id: existing.id, rental_item: existing.rental_item, rental_name: existing.rental_name }];
  const currentEventDate = String(existing.event_date).slice(0, 10);
  const { data, error: updateError } = await supabase.rpc("edit_rental_booking_atomic", {
    p_id: id,
    p_update: buildRentalEditUpdate(parsed.value),
    p_period: parsed.value.spanDays === undefined ? null : {
      spanDays: parsed.value.spanDays, dayCharges: parsed.value.dayCharges,
    },
    p_expected: parsed.value.expectedPeriod ?? null,
  });
  if (updateError) {
    const conflict = updateError.message.includes("booking_conflict");
    const stale = updateError.message.includes("rental_edit_stale");
    const retry = ["40001", "40P01"].includes(updateError.code);
    return NextResponse.json({ ok: false, message: conflict
      ? (updateError.details || "An item is already reserved during this period.")
      : stale ? "This rental's dates or pricing changed. Refresh and reopen it before saving."
      : retry ? "Another reservation changed at the same time. Refresh and try again."
      : updateError.message.includes("rental_price_needs_review") ? "This booking's stored price needs review before changing its rental period."
      : "The rental could not be updated. No changes were saved." },
      { status: conflict || stale || retry || updateError.message.includes("rental_not_editable") ? 409 : 503 });
  }
  const updated = data as RentalEditRow | null;

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

  after(() =>
    runRoutePlannerAgent({
      bookingId: id,
      eventDates: [...new Set([...rentalReservedDates(currentEventDate, existing.span_days ?? 1), ...rentalReservedDates(updated.event_date, updated.span_days ?? 1)])],
      trigger: "rental.edited",
    }),
  );

  revalidatePath("/admin");
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
