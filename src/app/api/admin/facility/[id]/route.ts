import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  facilityBookingIsEditable,
  isValidBookingId,
  parseFacilityEditInput,
} from "@/lib/admin/booking-edit";
import { verifyAdminAccess } from "@/lib/admin/session";
import {
  formatFacilityCalendarDescription,
  type FacilityBookingCalendarFields,
} from "@/lib/facility-parties/calendar-description";
import {
  evaluateGoogleCalendarProjection,
  summarizeGoogleCalendarError,
  syncGoogleCalendarDestinations,
} from "@/lib/google/calendar";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const FACILITY_EDIT_SELECT =
  "id, status, email, customer_name, readable_date, readable_time, party_label, start_time, end_time, phone, parent_name, child_name, child_gender, child_age, party_theme, balloon_colors, table_cloth_colors, drink_choice, payment_method, deposit_acknowledged, room, notes, addon_selections, facility_package_price, addon_subtotal, subtotal, tax, total, pricing_details, google_calendar_event_id, google_calendar_secondary_event_id";

type FacilityEditRow = FacilityBookingCalendarFields & {
  status: string;
};

async function syncConfirmedFacilityCalendar(input: {
  supabase: ReturnType<typeof createServiceRoleClient>;
  booking: FacilityEditRow;
}): Promise<boolean> {
  const facilityCalendarId =
    process.env.GOOGLE_FACILITY_CALENDAR_ID?.trim() || "primary";

  try {
    const sync = await syncGoogleCalendarDestinations({
      title: `${input.booking.party_label ?? "Facility party"} - ${input.booking.customer_name}`,
      description: formatFacilityCalendarDescription(input.booking),
      start: input.booking.start_time,
      end: input.booking.end_time,
      idempotencyKeyBase: `facility-${input.booking.id}-calendar-v1`,
      primaryEventId: input.booking.google_calendar_event_id,
      secondaryEventId: input.booking.google_calendar_secondary_event_id,
      primaryCalendarId: facilityCalendarId,
    });

    const projection = evaluateGoogleCalendarProjection(sync);
    const { error: calendarIdError } = await input.supabase
      .from("facility_bookings")
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
        "[api/admin/facility/edit] calendar id save error",
        calendarIdError.code,
      );
      return false;
    }

    return !projection.hardFailed;
  } catch (error) {
    console.error(
      "[api/admin/facility/edit] calendar sync failed",
      summarizeGoogleCalendarError(error),
    );
    return false;
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(req, {
    scope: "admin-facility-edit",
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
      { ok: false, message: "Invalid facility booking ID." },
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

  const parsed = parseFacilityEditInput(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.error },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();
  const { data: existing, error: loadError } = await supabase
    .from("facility_bookings")
    .select(FACILITY_EDIT_SELECT)
    .eq("id", id)
    .maybeSingle<FacilityEditRow>();

  if (loadError) {
    console.error("[api/admin/facility/edit] load failed", loadError.code);
    return NextResponse.json(
      { ok: false, message: "Could not load this facility party." },
      { status: 503 },
    );
  }

  if (!existing) {
    return NextResponse.json(
      { ok: false, message: "Facility party not found." },
      { status: 404 },
    );
  }

  if (!facilityBookingIsEditable(existing.status)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Only pending or confirmed facility parties can be edited.",
      },
      { status: 409 },
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("facility_bookings")
    .update({
      customer_name: parsed.value.customerName,
      email: parsed.value.email,
      phone: parsed.value.phone,
      parent_name: parsed.value.parentName,
      child_name: parsed.value.childName,
      child_age: parsed.value.childAge,
      child_gender: parsed.value.childGender,
      party_theme: parsed.value.partyTheme,
      balloon_colors: parsed.value.balloonColors,
      table_cloth_colors: parsed.value.tableClothColors,
      drink_choice: parsed.value.drinkChoice,
      notes: parsed.value.notes,
      payment_method: parsed.value.paymentMethod,
    })
    .eq("id", id)
    .in("status", ["pending", "confirmed"])
    .select(FACILITY_EDIT_SELECT)
    .maybeSingle<FacilityEditRow>();

  if (updateError) {
    console.error("[api/admin/facility/edit] update failed", updateError.code);
    return NextResponse.json(
      { ok: false, message: "The facility party could not be updated." },
      { status: 503 },
    );
  }

  if (!updated) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Facility party was not updated. It may have changed status.",
      },
      { status: 409 },
    );
  }

  let calendarSyncFailed = false;
  if (updated.status === "confirmed") {
    calendarSyncFailed = !(await syncConfirmedFacilityCalendar({
      supabase,
      booking: updated,
    }));
  }

  revalidatePath("/admin/facility");
  revalidatePath("/admin/schedule");

  return NextResponse.json({
    ok: true,
    message: calendarSyncFailed
      ? "Facility party updated. Calendar sync needs attention — use Retry calendar sync if needed."
      : "Facility party updated.",
    calendarSyncFailed,
  });
}
