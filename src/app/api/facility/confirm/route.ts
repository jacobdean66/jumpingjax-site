import { NextResponse } from "next/server";

import {
  deleteGoogleCalendarDestinations,
  evaluateGoogleCalendarProjection,
  summarizeGoogleCalendarError,
  syncGoogleCalendarDestinations,
} from "@/lib/google/calendar";
import { formatStoredFacilityAddons } from "@/lib/facility-parties/addons";
import {
  facilityPricingFromBooking,
  formatFacilityCalendarDescription,
  type FacilityBookingCalendarFields,
} from "@/lib/facility-parties/calendar-description";
import { formatFacilityPricingLines } from "@/lib/facility-parties/pricing";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  renderApprovalReview,
  resolveDecisionRequest,
  type BookingDecision,
} from "@/lib/bookings/approval-review";
import {
  claimCalendarRepairAttempt,
  recordWorkflowOutcome,
} from "@/lib/bookings/workflow-state";
import { sendBookingOperationalAlert } from "@/lib/bookings/operational-alert";
import { sendDurableBookingEmail } from "@/lib/bookings/durable-email";

const FACILITY_BOOKING_SELECT =
  "id, email, customer_name, readable_date, readable_time, party_label, start_time, end_time, phone, parent_name, child_name, child_gender, child_age, party_theme, balloon_colors, table_cloth_colors, drink_choice, payment_method, deposit_acknowledged, room, notes, addon_selections, facility_package_price, addon_subtotal, subtotal, tax, total, pricing_details, google_calendar_event_id, google_calendar_secondary_event_id";

async function handleFacilityConfirm(
  req: Request,
  decision: BookingDecision,
  allowRepair: boolean,
) {
  const id = decision.bookingId;
  const action = decision.action;
  const facilityCalendarId =
    process.env.GOOGLE_FACILITY_CALENDAR_ID?.trim() ||
    process.env.GOOGLE_CALENDAR_ID?.trim() ||
    "primary";

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  if (action !== "confirm" && action !== "reject") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const status = action === "reject" ? "rejected" : "confirmed";
  const successMessage =
    action === "reject"
      ? "Booking rejected. You can close this tab."
      : "Booking confirmed. You can close this tab.";

  const supabase = createServiceRoleClient();

  const { data: updatedBooking, error } = await supabase
    .from("facility_bookings")
    .update({ status })
    .eq("id", id)
    .eq("status", "pending")
    .select(FACILITY_BOOKING_SELECT)
    .maybeSingle<FacilityBookingCalendarFields>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let booking = updatedBooking;
  let calendarRepairOnly = false;
  if (!booking && action === "confirm" && allowRepair) {
    const { data: existingBooking } = await supabase
      .from("facility_bookings")
      .select(FACILITY_BOOKING_SELECT)
      .eq("id", id)
      .eq("status", "confirmed")
      .maybeSingle<FacilityBookingCalendarFields>();
    if (existingBooking) {
      booking = existingBooking;
      calendarRepairOnly = true;
    }
  }

  if (!booking) {
    return NextResponse.json(
      { error: "Booking not found or already processed" },
      { status: 409 },
    );
  }

  let calendarFailed = false;
  let secondaryCalendarDegraded = false;
  let calendarEventId = booking.google_calendar_event_id as string | null;
  if (action === "confirm") {
    if (calendarRepairOnly) {
      // Best-effort claim reduces overlapping repairs. Deterministic Google
      // event IDs remain the hard guarantee against duplicate events.
      await claimCalendarRepairAttempt({
        supabase,
        kind: "facility",
        bookingId: id,
      });
      const secondaryConfigured = Boolean(
        process.env.GOOGLE_CALENDAR_SECONDARY_ID?.trim(),
      );
      const { data: workflowState } = await supabase
        .from("booking_integration_workflows")
        .select("calendar_status")
        .eq("booking_kind", "facility")
        .eq("booking_id", id)
        .maybeSingle<{ calendar_status: string }>();
      const bothDestinationsPresent =
        Boolean(booking.google_calendar_event_id) &&
        (!secondaryConfigured ||
          Boolean(booking.google_calendar_secondary_event_id));
      if (
        workflowState?.calendar_status === "sent" &&
        bothDestinationsPresent
      ) {
        return new Response(
          "Booking is confirmed and both Calendar projections are already complete.",
          { status: 200 },
        );
      }
    }
    try {
      const sync = await syncGoogleCalendarDestinations({
        title: `${booking.party_label} - ${booking.customer_name}`,
        description: formatFacilityCalendarDescription(booking),
        start: booking.start_time,
        end: booking.end_time,
        idempotencyKeyBase: `facility-${id}-calendar-v1`,
        primaryEventId: booking.google_calendar_event_id,
        secondaryEventId: booking.google_calendar_secondary_event_id,
        primaryCalendarId: facilityCalendarId,
      });
      const projection = evaluateGoogleCalendarProjection(sync);
      calendarEventId = projection.primaryEventId;
      secondaryCalendarDegraded = projection.secondaryDegraded;
      if (projection.hardFailed || secondaryCalendarDegraded) {
        console.error("[api/facility/confirm] partial calendar sync", {
          primaryStatus: sync.primaryStatus,
          secondaryStatus: sync.secondaryStatus,
          hardFailed: projection.hardFailed,
          secondaryDegraded: secondaryCalendarDegraded,
        });
      }
      // Primary hard-failure is the only outcome that blocks booking approval
      // continuity. Secondary-only failure keeps the primary event and leaves a
      // retryable backup-calendar warning until both destinations succeed.
      calendarFailed = projection.hardFailed;
      const { error: calendarIdError } = await supabase
        .from("facility_bookings")
        .update({
          // Never clear a known event id with null on a failed destination sync;
          // retries must update the same events instead of creating duplicates.
          google_calendar_event_id:
            sync.primaryEventId ?? booking.google_calendar_event_id,
          google_calendar_secondary_event_id:
            sync.secondaryEventId ??
            booking.google_calendar_secondary_event_id,
        })
        .eq("id", booking.id);
      if (calendarIdError) {
        // External event may already exist; keep the known id and mark failed
        // so an idempotent repair can reconcile without creating a duplicate.
        calendarFailed = true;
        console.error(
          "[api/facility/confirm] facility calendar id save error",
          { code: calendarIdError.code },
        );
      }
    } catch (calendarError) {
      calendarFailed = true;
      console.error(
        "GOOGLE CALENDAR ERROR",
        summarizeGoogleCalendarError(calendarError),
      );
    }
  }

  if (action === "reject") {
    try {
      const deletion = await deleteGoogleCalendarDestinations({
        primaryEventId: booking.google_calendar_event_id,
        secondaryEventId: booking.google_calendar_secondary_event_id,
        primaryCalendarId: facilityCalendarId,
      });
      if (deletion.primaryStatus === "failed" || deletion.secondaryStatus === "failed") {
        console.error("[api/facility/confirm] calendar delete partial failure", deletion);
      }
    } catch (calendarError) {
      console.error(
        "[api/facility/confirm] calendar delete error",
        summarizeGoogleCalendarError(calendarError),
      );
    }
  }
  // Keep calendar_status failed while backup sync is incomplete so the admin
  // warning and Retry action remain available. Approval/emails still proceed.
  const calendarStepIncomplete =
    calendarFailed || secondaryCalendarDegraded;
  const calendarSafeErrorClass = calendarFailed
    ? "calendar_projection_failed"
    : secondaryCalendarDegraded
      ? "calendar_secondary_projection_failed"
      : undefined;
  await recordWorkflowOutcome({
    supabase,
    kind: "facility",
    bookingId: id,
    step: "calendar",
    outcome:
      action === "reject"
        ? "not_required"
        : calendarStepIncomplete
          ? "failed"
          : "sent",
    safeErrorClass: calendarSafeErrorClass,
    calendarEventId: calendarEventId ?? undefined,
  });
  if (calendarFailed) {
    await sendBookingOperationalAlert({
      kind: "facility",
      bookingId: id,
      step: "calendar",
      safeErrorClass: "calendar_projection_failed",
    });
  } else if (secondaryCalendarDegraded) {
    await sendBookingOperationalAlert({
      kind: "facility",
      bookingId: id,
      step: "calendar",
      safeErrorClass: "calendar_secondary_projection_failed",
    });
  }
  if (calendarRepairOnly) {
    return new Response(
      calendarFailed
        ? "Booking is confirmed, but the Calendar repair still needs attention."
        : secondaryCalendarDegraded
          ? "Primary calendar synced. Backup calendar sync needs attention."
          : "Booking is confirmed and both Calendar projections are complete.",
      { status: calendarStepIncomplete ? 503 : 200 },
    );
  }

  if (
    !booking.email ||
    !booking.customer_name ||
    !booking.readable_date ||
    !booking.readable_time ||
    !booking.party_label
  ) {
    await recordWorkflowOutcome({
      supabase, kind: "facility", bookingId: id, step: "decision_email",
      outcome: "failed", safeErrorClass: "customer_contact_missing",
    });
    await sendBookingOperationalAlert({
      kind: "facility", bookingId: id, step: "decision_email",
      safeErrorClass: "customer_contact_missing",
    });
    return new Response("Status updated. No customer email sent (missing data).");
  }

  try {
    const emailSubject =
      action === "reject"
        ? "Your Jumping Jax facility booking request"
        : "Your Jumping Jax facility booking is confirmed";
    const emailMessage =
      action === "reject"
        ? "We are sorry, but we are unable to confirm your facility booking request for this time."
        : "Your facility booking has been confirmed.";
    const pricingLines = formatFacilityPricingLines(
      facilityPricingFromBooking(booking),
    );

    const { error: emailError } = await sendDurableBookingEmail({
      supabase,
      messageKey: `facility-${id}-decision-${action}-v1`,
      kind: "facility",
      bookingId: id,
      purpose: `decision_${action}`,
      to: booking.email,
      subject: emailSubject,
      text: [
        `Hi ${booking.customer_name},`,
        "",
        emailMessage,
        "",
        `Party: ${booking.party_label}`,
        `Date: ${booking.readable_date}`,
        `Time: ${booking.readable_time}`,
        booking.child_name ? `Child: ${booking.child_name}` : null,
        booking.child_age ? `Child age: ${booking.child_age}` : null,
        booking.party_theme ? `Party theme: ${booking.party_theme}` : null,
        booking.drink_choice ? `Drink choice: ${booking.drink_choice}` : null,
        booking.payment_method
          ? `Payment method: ${booking.payment_method}`
          : null,
        action === "confirm"
          ? "Deposit: $50 due within one week of making this reservation, paid directly to Jumping Jax."
          : null,
        "",
        formatStoredFacilityAddons(booking.addon_selections),
        ...pricingLines,
      ]
        .filter((line): line is string => line !== null)
        .join("\n"),
    });

    if (emailError) {
      await recordWorkflowOutcome({
        supabase, kind: "facility", bookingId: id, step: "decision_email",
        outcome: "failed", safeErrorClass: "decision_email_failed",
      });
      await sendBookingOperationalAlert({
        kind: "facility", bookingId: id, step: "decision_email",
        safeErrorClass: "decision_email_failed",
      });
      console.error("CUSTOMER STATUS EMAIL ERROR", emailError);
      return NextResponse.json(
        { error: "Status changed but customer email failed" },
        { status: 500 },
      );
    }
  } catch (emailError) {
    console.error("EMAIL ERROR:", emailError);
    console.error("CUSTOMER STATUS EMAIL ERROR", emailError);
    await recordWorkflowOutcome({
      supabase, kind: "facility", bookingId: id, step: "decision_email",
      outcome: "failed", safeErrorClass: "decision_email_failed",
    });
    await sendBookingOperationalAlert({
      kind: "facility", bookingId: id, step: "decision_email",
      safeErrorClass: "decision_email_failed",
    });
    return NextResponse.json(
      { error: "Status changed but customer email failed" },
      { status: 500 },
    );
  }

  await recordWorkflowOutcome({
    supabase,
    kind: "facility",
    bookingId: id,
    step: "decision_email",
    outcome: "sent",
  });

  return new Response(
    calendarFailed
      ? `${successMessage} Customer email was sent, but Calendar still requires attention.`
      : secondaryCalendarDegraded
        ? `${successMessage} Primary calendar synced. Backup calendar sync needs attention.`
        : successMessage,
    // 207: approval + customer email succeeded; calendar warning remains.
    { status: calendarStepIncomplete ? 207 : 200 },
  );
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  return renderApprovalReview({
    bookingKind: "facility",
    token,
    postPath: "/api/facility/confirm",
  });
}

export async function POST(req: Request) {
  const resolved = await resolveDecisionRequest(req, "facility");
  if (!resolved.ok) return resolved.response;
  return handleFacilityConfirm(
    req,
    resolved.decision,
    resolved.authorization === "admin",
  );
}
