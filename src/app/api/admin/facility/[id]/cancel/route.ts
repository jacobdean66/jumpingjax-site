import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isValidBookingId } from "@/lib/admin/booking-edit";
import { verifyAdminAccess } from "@/lib/admin/session";
import { loadPublicFacilityAvailabilityRows } from "@/lib/facility-parties/availability-query";
import {
  facilityBookingCanMutate,
  isMissingFacilityScheduleRpcError,
  verifyFacilityCancellation,
  wallClockFromFacilityTimes,
} from "@/lib/facility-parties/schedule-mutation";
import {
  deleteGoogleCalendarDestinations,
  summarizeGoogleCalendarError,
} from "@/lib/google/calendar";
import { recordWorkflowOutcome } from "@/lib/bookings/workflow-state";
import { sendBookingOperationalAlert } from "@/lib/bookings/operational-alert";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const FACILITY_CANCEL_SELECT =
  "id, status, party_kind, room, start_time, end_time, google_calendar_event_id, google_calendar_secondary_event_id";

type FacilityCancelRow = {
  id: string;
  status: string;
  party_kind: string | null;
  room: string | null;
  start_time: string;
  end_time: string;
  google_calendar_event_id: string | null;
  google_calendar_secondary_event_id: string | null;
};

type CancelRpcResult = {
  outcome?: string;
  status?: string;
};

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(req, {
    scope: "admin-facility-cancel",
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

  const supabase = createServiceRoleClient();
  const { data: existing, error: loadError } = await supabase
    .from("facility_bookings")
    .select(FACILITY_CANCEL_SELECT)
    .eq("id", id)
    .maybeSingle<FacilityCancelRow>();

  if (loadError) {
    console.error("[api/admin/facility/cancel] load failed", loadError.code);
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

  const alreadyCancelled =
    existing.status === "cancelled" || existing.status === "canceled";
  if (
    !alreadyCancelled &&
    !facilityBookingCanMutate({
      status: existing.status,
      startTimeIso: existing.start_time,
    })
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Only upcoming pending or confirmed facility parties can be cancelled.",
      },
      { status: 409 },
    );
  }

  const clock = wallClockFromFacilityTimes(
    existing.start_time,
    existing.end_time,
  );
  if (
    !clock ||
    (existing.party_kind !== "public" && existing.party_kind !== "private") ||
    (existing.room !== "room-10" && existing.room !== "room-20")
  ) {
    return NextResponse.json(
      { ok: false, message: "This party does not have a valid booking window." },
      { status: 409 },
    );
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "cancel_facility_booking_atomic",
    { p_booking_id: id },
  );

  if (rpcError) {
    console.error("[api/admin/facility/cancel] RPC failed", {
      code: rpcError.code,
    });
    return NextResponse.json(
      {
        ok: false,
        message: isMissingFacilityScheduleRpcError(rpcError)
          ? "Facility cancellation is not enabled in the database yet. The booking was not changed."
          : "The facility party could not be cancelled.",
      },
      { status: 503 },
    );
  }

  const rpcResult = (rpcData ?? {}) as CancelRpcResult;
  if (
    rpcResult.outcome !== "cancelled" &&
    rpcResult.outcome !== "already_cancelled"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          rpcResult.outcome === "not_found"
            ? "Facility party not found."
            : "This facility party cannot be cancelled in its current status.",
      },
      { status: rpcResult.outcome === "not_found" ? 404 : 409 },
    );
  }

  const availability = await loadPublicFacilityAvailabilityRows(
    supabase,
    clock.date,
  );
  if (!availability.ok) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "The party was cancelled, but availability restoration could not be verified.",
      },
      { status: 503 },
    );
  }

  const verified = verifyFacilityCancellation({
    bookingId: id,
    released: {
      date: clock.date,
      kind: existing.party_kind,
      roomId: existing.room,
      startMinutes: clock.startMinutes,
      endMinutes: clock.endMinutes,
    },
    rows: availability.rows,
  });
  if (!verified.ok) {
    console.error("[api/admin/facility/cancel] restoration verification failed", {
      bookingId: id,
      date: clock.date,
    });
    return NextResponse.json(
      { ok: false, message: verified.message },
      { status: 409 },
    );
  }

  const facilityCalendarId =
    process.env.GOOGLE_FACILITY_CALENDAR_ID?.trim() || "primary";
  const hadStoredCalendarIds = Boolean(
    existing.google_calendar_event_id ||
      existing.google_calendar_secondary_event_id,
  );
  let calendarSyncFailed = false;
  try {
    const deletion = await deleteGoogleCalendarDestinations({
      primaryEventId: existing.google_calendar_event_id,
      secondaryEventId: existing.google_calendar_secondary_event_id,
      primaryCalendarId: facilityCalendarId,
    });
    if (
      deletion.primaryStatus === "failed" ||
      deletion.secondaryStatus === "failed"
    ) {
      calendarSyncFailed = true;
    }
  } catch (error) {
    calendarSyncFailed = true;
    console.error(
      "[api/admin/facility/cancel] calendar delete error",
      summarizeGoogleCalendarError(error),
    );
  }

  await recordWorkflowOutcome({
    supabase,
    kind: "facility",
    bookingId: id,
    step: "calendar",
    outcome: calendarSyncFailed ? "failed" : "not_required",
    safeErrorClass: calendarSyncFailed
      ? "calendar_projection_failed"
      : undefined,
  });
  if (calendarSyncFailed) {
    await sendBookingOperationalAlert({
      kind: "facility",
      bookingId: id,
      step: "calendar",
      safeErrorClass: "calendar_projection_failed",
    });
  }

  console.info("[api/admin/facility/cancel]", {
    bookingId: id,
    actorId: auth.identity.id,
    actorRole: auth.role,
    date: clock.date,
    startMinutes: clock.startMinutes,
    outcome: rpcResult.outcome,
    status: "cancelled",
  });

  revalidatePath("/admin/facility");
  revalidatePath("/admin/schedule");

  return NextResponse.json({
    ok: true,
    message: calendarSyncFailed
      ? "Facility party cancelled and the time was released, but Calendar removal needs attention. History was kept."
      : rpcResult.outcome === "already_cancelled"
        ? hadStoredCalendarIds
          ? "Facility party was already cancelled and Calendar removal was retried successfully."
          : "Facility party was already cancelled. The date and time remains available unless another booking holds it."
        : "Facility party cancelled. The date and time is available again and the booking history was kept.",
    calendarSyncFailed,
    releasedSlotVerified: true,
  });
}
