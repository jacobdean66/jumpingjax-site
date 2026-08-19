import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  facilityBookingIsEditable,
  facilityEditDetailsWrite,
  isValidBookingId,
  parseFacilityEditInput,
} from "@/lib/admin/booking-edit";
import { verifyAdminAccess } from "@/lib/admin/session";
import {
  formatFacilityCalendarDescription,
  type FacilityBookingCalendarFields,
} from "@/lib/facility-parties/calendar-description";
import { loadPublicFacilityAvailabilityRows } from "@/lib/facility-parties/availability-query";
import {
  isMissingFacilityScheduleRpcError,
  planFacilityReschedule,
  verifyFacilityReschedule,
  wallClockFromFacilityTimes,
  type FacilityScheduleSnapshot,
} from "@/lib/facility-parties/schedule-mutation";
import { clockTimeToMinutes } from "@/lib/facility-parties/time";
import {
  evaluateGoogleCalendarProjection,
  summarizeGoogleCalendarError,
  syncGoogleCalendarDestinations,
} from "@/lib/google/calendar";
import { resolveInvitationSnapshot } from "@/lib/facility-parties/invitations/snapshot";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const FACILITY_EDIT_SELECT =
  "id, status, email, customer_name, readable_date, readable_time, party_label, party_kind, start_time, end_time, phone, parent_name, child_name, child_gender, child_age, party_theme, invitation_delivery_preference, invitation_template_id, balloon_colors, table_cloth_colors, drink_choice, payment_method, deposit_acknowledged, room, notes, addon_selections, facility_package_price, addon_subtotal, subtotal, tax, total, pricing_details, google_calendar_event_id, google_calendar_secondary_event_id, invitation";

type FacilityEditRow = FacilityBookingCalendarFields & {
  status: string;
  party_kind: string | null;
  party_theme?: string | null;
  invitation?: unknown;
};

type RescheduleRpcResult = {
  outcome?: string;
  status?: string;
};

function snapshotFromBooking(
  booking: FacilityEditRow,
): FacilityScheduleSnapshot | null {
  if (booking.party_kind !== "public" && booking.party_kind !== "private") {
    return null;
  }
  if (booking.room !== "room-10" && booking.room !== "room-20") {
    return null;
  }
  const clock = wallClockFromFacilityTimes(booking.start_time, booking.end_time);
  if (!clock) return null;
  return {
    id: booking.id,
    status: booking.status,
    kind: booking.party_kind,
    roomId: booking.room,
    date: clock.date,
    startMinutes: clock.startMinutes,
    endMinutes: clock.endMinutes,
  };
}

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

  const details = {
    ...facilityEditDetailsWrite(parsed.value),
    invitation: resolveInvitationSnapshot({
      partyTheme: parsed.value.partyTheme,
      stored:
        (existing.party_theme ?? "").trim() ===
        (parsed.value.partyTheme ?? "").trim()
          ? existing.invitation
          : undefined,
    }),
  };
  let updated: FacilityEditRow | null = null;
  let releasedSlotVerified = false;
  let previousSlotOpen = false;

  if (parsed.value.bookingDate && parsed.value.bookingStartTime) {
    const current = snapshotFromBooking(existing);
    const requestedStartMinutes = clockTimeToMinutes(
      parsed.value.bookingStartTime,
    );
    if (!current || requestedStartMinutes === null) {
      return NextResponse.json(
        { ok: false, message: "This party does not have a valid booking window." },
        { status: 409 },
      );
    }

    const availability = await loadPublicFacilityAvailabilityRows(
      supabase,
      parsed.value.bookingDate,
    );
    if (!availability.ok) {
      return NextResponse.json(
        { ok: false, message: "Could not verify facility availability." },
        { status: 503 },
      );
    }

    const plan = planFacilityReschedule({
      current,
      requestedDate: parsed.value.bookingDate,
      requestedStartMinutes,
      rows: availability.rows,
    });
    if (!plan.ok) {
      return NextResponse.json(
        { ok: false, message: plan.message },
        { status: plan.code === "conflict" ? 409 : 400 },
      );
    }

    if (plan.slotChanged) {
      const previousQuery = {
        date: current.date,
        kind: current.kind,
        roomId: current.roomId,
        startMinutes: current.startMinutes,
        endMinutes: current.endMinutes,
      };
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "reschedule_facility_booking_atomic",
        {
          p_booking_id: id,
          p_start: plan.startTimeIso,
          p_end: plan.endTimeIso,
          p_readable_date: plan.readableDate,
          p_readable_time: plan.readableTime,
          p_details: details,
        },
      );

      if (rpcError) {
        console.error("[api/admin/facility/edit] reschedule RPC failed", {
          code: rpcError.code,
        });
        return NextResponse.json(
          {
            ok: false,
            message: isMissingFacilityScheduleRpcError(rpcError)
              ? "Facility reschedule is not enabled in the database yet. The original booking was not changed."
              : "The facility party could not be updated.",
          },
          { status: 503 },
        );
      }

      const rpcResult = (rpcData ?? {}) as RescheduleRpcResult;
      if (rpcResult.outcome === "conflict") {
        return NextResponse.json(
          {
            ok: false,
            message:
              "That date and time is already held by another active booking.",
          },
          { status: 409 },
        );
      }
      if (rpcResult.outcome !== "updated") {
        return NextResponse.json(
          {
            ok: false,
            message:
              rpcResult.outcome === "invalid_status"
                ? "Facility party was not updated. It may have changed status."
                : "The facility party could not be updated.",
          },
          { status: rpcResult.outcome === "not_found" ? 404 : 409 },
        );
      }

      const { data: reloaded, error: reloadError } = await supabase
        .from("facility_bookings")
        .select(FACILITY_EDIT_SELECT)
        .eq("id", id)
        .maybeSingle<FacilityEditRow>();
      if (reloadError || !reloaded) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "The party time changed, but the updated booking could not be reloaded for verification.",
          },
          { status: 503 },
        );
      }
      updated = reloaded;

      const [previousRows, nextRows] = await Promise.all([
        loadPublicFacilityAvailabilityRows(supabase, previousQuery.date),
        loadPublicFacilityAvailabilityRows(supabase, plan.query.date),
      ]);
      if (!previousRows.ok || !nextRows.ok) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "The party time changed, but availability restoration could not be verified.",
          },
          { status: 503 },
        );
      }

      const verified = verifyFacilityReschedule({
        bookingId: id,
        previous: previousQuery,
        next: plan.query,
        previousDateRows: previousRows.rows,
        nextDateRows: nextRows.rows,
      });
      if (!verified.ok) {
        console.error("[api/admin/facility/edit] restoration verification failed", {
          bookingId: id,
          previousDate: previousQuery.date,
          nextDate: plan.query.date,
        });
        return NextResponse.json(
          { ok: false, message: verified.message },
          { status: 409 },
        );
      }
      releasedSlotVerified = true;
      previousSlotOpen = verified.previousAvailable;

      console.info("[api/admin/facility/edit] reschedule", {
        bookingId: id,
        actorId: auth.identity.id,
        actorRole: auth.role,
        previousDate: previousQuery.date,
        previousStartMinutes: previousQuery.startMinutes,
        nextDate: plan.query.date,
        nextStartMinutes: plan.query.startMinutes,
        status: updated.status,
      });
    }
  }

  if (!updated) {
    const { data: detailsUpdated, error: updateError } = await supabase
      .from("facility_bookings")
      .update(details)
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

    if (!detailsUpdated) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Facility party was not updated. It may have changed status.",
        },
        { status: 409 },
      );
    }
    updated = detailsUpdated;
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
      ? releasedSlotVerified
        ? previousSlotOpen
          ? "Facility party updated and the previous time was released. Calendar sync needs attention — use Retry calendar sync if needed."
          : "Facility party updated. Calendar sync needs attention — use Retry calendar sync if needed."
        : "Facility party updated. Calendar sync needs attention — use Retry calendar sync if needed."
      : releasedSlotVerified
        ? previousSlotOpen
          ? "Facility party updated. The previous date and time is available again."
          : "Facility party updated. The new date and time is reserved."
        : "Facility party updated.",
    calendarSyncFailed,
    releasedSlotVerified,
  });
}
