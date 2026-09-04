import { after } from "next/server";

import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarDestinations,
  deleteGoogleCalendarEvent,
  summarizeGoogleCalendarError,
  syncGoogleCalendarDestinations,
} from "@/lib/google/calendar";
import {
  buildRentalCalendarDescription,
  buildRentalListWithPrices,
  foamDurationLabelForBooking,
  formatEstimatedTotalLine,
  isFoamPartyRentalItem,
  rentalCalendarDateTimes,
} from "@/lib/rentals/rental-pricing-text";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  renderApprovalReview,
  resolveDecisionRequest,
  type BookingDecision,
} from "@/lib/bookings/approval-review";
import { recordWorkflowOutcome } from "@/lib/bookings/workflow-state";
import { sendBookingOperationalAlert } from "@/lib/bookings/operational-alert";
import { sendDurableBookingEmail } from "@/lib/bookings/durable-email";
import { runRoutePlannerAgent } from "@/lib/admin/route-planner-agent";

const RENTAL_BOOKING_SELECT =
  "id, customer_name, customer_email, customer_phone, rental_item, rental_name, event_date, duration, foam_duration, span_days, event_address, delivery_time, event_start_time, requested_delivery_window, distance_miles, delivery_fee, mileage_fee, setup_surface, setup_access, setup_notes, payment_method, subtotal, total, google_calendar_event_id, google_calendar_secondary_event_id, google_foam_calendar_event_id";

type RentalBookingRow = {
  id: number | string;
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

type CalendarRepairResult = "already_exists" | "created" | "failed" | "skipped";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ownerResultPage(input: {
  title: string;
  message: string;
  tone?: "success" | "warning" | "error";
  bookingId?: string | number | null;
  status?: number;
}) {
  const tone = input.tone ?? "success";
  const colors =
    tone === "error"
      ? {
          bg: "#fff1f2",
          border: "#fecdd3",
          accent: "#be123c",
          badgeBg: "#ffe4e6",
        }
      : tone === "warning"
        ? {
            bg: "#fffbeb",
            border: "#fde68a",
            accent: "#b45309",
            badgeBg: "#fef3c7",
          }
        : {
            bg: "#f0fdf4",
            border: "#bbf7d0",
            accent: "#15803d",
            badgeBg: "#dcfce7",
          };
  const bookingLine =
    input.bookingId === null || input.bookingId === undefined
      ? ""
      : `<p class="booking">Booking ID: <strong>${escapeHtml(String(input.bookingId))}</strong></p>`;

  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.title)} - Jumping Jax</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #eef3f8;
        color: #0f172a;
        font-family: Arial, Helvetica, sans-serif;
        padding: 24px;
      }
      main {
        width: min(100%, 620px);
        border: 1px solid ${colors.border};
        border-radius: 18px;
        background: ${colors.bg};
        box-shadow: 0 24px 70px rgba(15, 23, 42, 0.14);
        padding: 28px;
      }
      .badge {
        display: inline-flex;
        border-radius: 999px;
        background: ${colors.badgeBg};
        color: ${colors.accent};
        font-size: 12px;
        font-weight: 900;
        letter-spacing: .08em;
        padding: 8px 12px;
        text-transform: uppercase;
      }
      h1 {
        margin: 18px 0 10px;
        font-size: clamp(30px, 8vw, 44px);
        line-height: 1;
      }
      p {
        color: #334155;
        font-size: 18px;
        line-height: 1.55;
        margin: 0;
      }
      .booking {
        margin-top: 18px;
        color: #0f172a;
      }
      .hint {
        margin-top: 20px;
        color: #64748b;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <main>
      <span class="badge">Jumping Jax Booking</span>
      <h1>${escapeHtml(input.title)}</h1>
      <p>${escapeHtml(input.message)}</p>
      ${bookingLine}
      <p class="hint">You can close this page and return to Gmail.</p>
    </main>
  </body>
</html>`,
    {
      status: input.status ?? 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

function actionResult(
  req: Request,
  input: {
    title: string;
    message: string;
    tone?: "success" | "warning" | "error";
    bookingId?: string | number | null;
    status?: number;
    calendarSyncFailed?: boolean;
  },
): Response {
  if (req.headers.get("accept")?.includes("application/json")) {
    return Response.json(
      {
        ok: (input.status ?? 200) < 400,
        message: input.message,
        bookingId: input.bookingId ?? null,
        calendarSyncFailed: input.calendarSyncFailed === true,
      },
      {
        status: input.status ?? 200,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  }
  return ownerResultPage(input);
}

async function loadRentalItems(
  supabase: ReturnType<typeof createServiceRoleClient>,
  id: string,
  booking: RentalBookingRow,
) {
  const { data: rentalItemRows } = await supabase
    .from("booking_rental_items")
    .select("rental_item, rental_name")
    .eq("booking_id", id);

  return rentalItemRows && rentalItemRows.length > 0
    ? rentalItemRows
    : [
        {
          rental_item: booking.rental_item,
          rental_name: booking.rental_name ?? booking.rental_item,
        },
      ];
}

async function createMissingRentalCalendarEvent(input: {
  supabase: ReturnType<typeof createServiceRoleClient>;
  booking: RentalBookingRow;
  id: string;
  calendarItems: { rental_item?: string; rental_name?: string }[];
  eventDate: string;
  spanDays: number;
  durationLabel: string;
  foamDurationLabel: string | null;
  bookingTotal: number | null;
  customerName: string | null;
  customerEmail: string | null;
  rentalLabel: string;
}): Promise<CalendarRepairResult> {
  const rentalOnlyItems = input.calendarItems.filter(
    (item) => !isFoamPartyRentalItem(item.rental_item),
  );
  if (rentalOnlyItems.length === 0) {
    return "skipped";
  }

  const { start, end } = rentalCalendarDateTimes(
    input.eventDate,
    input.booking.delivery_time,
    input.spanDays,
    input.booking.event_start_time,
  );
  const rentalDurationLabel =
    rentalOnlyItems.length === input.calendarItems.length
      ? input.durationLabel
      : "One Day";
  const description = buildRentalCalendarDescription({
    items: rentalOnlyItems,
    durationLabel: rentalDurationLabel,
    foamDurationLabel: input.foamDurationLabel,
    spanDays: input.spanDays,
    total: input.bookingTotal,
    deliveryFee: input.booking.delivery_fee,
    mileageFee: input.booking.mileage_fee,
    distanceMiles: input.booking.distance_miles,
    eventDateYmd: input.eventDate,
    deliveryTime: input.booking.delivery_time,
    eventStartTime: input.booking.event_start_time,
    requestedDeliveryWindow: input.booking.requested_delivery_window,
    customerName: input.customerName ?? "Guest",
    customerPhone: input.booking.customer_phone,
    customerEmail: input.customerEmail,
    eventAddress: input.booking.event_address,
    setupSurface: input.booking.setup_surface,
    setupAccess: input.booking.setup_access,
    setupNotes: input.booking.setup_notes,
    paymentMethod: input.booking.payment_method,
    bookingId: String(input.booking.id),
  });

  const sync = await syncGoogleCalendarDestinations({
    title: `Rental - ${input.rentalLabel} - ${input.customerName ?? "Guest"}`,
    description,
    start,
    end,
    idempotencyKeyBase: `rental-${input.id}-calendar-v1`,
    primaryEventId: input.booking.google_calendar_event_id,
    secondaryEventId: input.booking.google_calendar_secondary_event_id,
  });

  if (sync.primaryStatus === "failed" && sync.secondaryStatus === "failed") {
    return "failed";
  }

  const { error: calendarIdError } = await input.supabase
    .from("bookings")
    .update({
      // Never clear a known event id with null on a failed destination sync;
      // retries must update the same events instead of creating duplicates.
      google_calendar_event_id:
        sync.primaryEventId ?? input.booking.google_calendar_event_id,
      google_calendar_secondary_event_id:
        sync.secondaryEventId ??
        input.booking.google_calendar_secondary_event_id,
    })
    .eq("id", input.id);

  if (calendarIdError) {
    console.error(
      "[api/rentals/confirm] rental calendar id save error",
      calendarIdError,
    );
    return "failed";
  }

  if (sync.primaryStatus === "failed" || sync.secondaryStatus === "failed") {
    console.error("[api/rentals/confirm] partial calendar sync", {
      primaryStatus: sync.primaryStatus,
      secondaryStatus: sync.secondaryStatus,
    });
    return "failed";
  }

  if (
    sync.primaryStatus === "already_exists" ||
    sync.primaryStatus === "updated" ||
    (sync.primaryStatus === "created" && sync.secondaryStatus === "already_exists")
  ) {
    if (sync.primaryStatus === "created" || sync.secondaryStatus === "created") {
      return "created";
    }
    if (sync.primaryStatus === "updated" || sync.secondaryStatus === "updated") {
      return "created";
    }
  }

  if (sync.primaryStatus === "created" || sync.secondaryStatus === "created") {
    return "created";
  }

  return sync.primaryEventId ? "already_exists" : "failed";
}

async function createMissingFoamCalendarEvent(input: {
  supabase: ReturnType<typeof createServiceRoleClient>;
  booking: RentalBookingRow;
  id: string;
  calendarItems: { rental_item?: string; rental_name?: string }[];
  eventDate: string;
  spanDays: number;
  durationLabel: string;
  foamDurationLabel: string | null;
  bookingTotal: number | null;
  customerName: string | null;
  customerEmail: string | null;
}): Promise<CalendarRepairResult> {
  const foamItems = input.calendarItems.filter((item) =>
    isFoamPartyRentalItem(item.rental_item),
  );
  if (foamItems.length === 0) {
    return "skipped";
  }

  if (input.booking.google_foam_calendar_event_id) {
    return "already_exists";
  }

  const { start, end } = rentalCalendarDateTimes(
    input.eventDate,
    input.booking.delivery_time,
    input.spanDays,
    input.booking.event_start_time,
  );
  const foamDurationLabel =
    input.foamDurationLabel ?? input.durationLabel;
  const description = buildRentalCalendarDescription({
    items: foamItems,
    durationLabel: foamDurationLabel,
    foamDurationLabel,
    spanDays: input.spanDays,
    total: input.bookingTotal,
    deliveryFee: input.booking.delivery_fee,
    mileageFee: input.booking.mileage_fee,
    distanceMiles: input.booking.distance_miles,
    eventDateYmd: input.eventDate,
    deliveryTime: input.booking.delivery_time,
    eventStartTime: input.booking.event_start_time,
    requestedDeliveryWindow: input.booking.requested_delivery_window,
    customerName: input.customerName ?? "Guest",
    customerPhone: input.booking.customer_phone,
    customerEmail: input.customerEmail,
    eventAddress: input.booking.event_address,
    setupSurface: input.booking.setup_surface,
    setupAccess: input.booking.setup_access,
    setupNotes: input.booking.setup_notes,
    paymentMethod: input.booking.payment_method,
    bookingId: String(input.booking.id),
  });

  const foamCalendarId =
    process.env.GOOGLE_FOAM_CALENDAR_ID?.trim() ||
    process.env.GOOGLE_CALENDAR_ID ||
    "primary";
  const eventId = await createGoogleCalendarEvent({
    title: `Foam Party - ${input.customerName ?? "Guest"}`,
    description,
    start,
    end,
    calendarId: foamCalendarId,
    idempotencyKey: `rental-${input.id}-foam-calendar-v1`,
  });

  if (!eventId) {
    return "failed";
  }

  const { data: savedBooking, error: calendarIdError } = await input.supabase
    .from("bookings")
    .update({ google_foam_calendar_event_id: eventId })
    .eq("id", input.id)
    .is("google_foam_calendar_event_id", null)
    .select("google_foam_calendar_event_id")
    .maybeSingle<{ google_foam_calendar_event_id: string | null }>();

  if (calendarIdError) {
    console.error(
      "[api/rentals/confirm] foam calendar id save error",
      calendarIdError,
    );
    return "failed";
  }

  if (savedBooking?.google_foam_calendar_event_id) {
    return "created";
  }

  const { data: existingBooking } = await input.supabase
    .from("bookings")
    .select("google_foam_calendar_event_id")
    .eq("id", input.id)
    .maybeSingle<{ google_foam_calendar_event_id: string | null }>();

  return existingBooking?.google_foam_calendar_event_id ? "already_exists" : "failed";
}

async function handleRentalConfirm(
  req: Request,
  decision: BookingDecision,
  allowRepair: boolean,
) {
  const id = decision.bookingId;
  const action = decision.action;

  if (!id) {
    return ownerResultPage({
      title: "Missing Booking",
      message: "This confirmation link is missing its booking ID.",
      tone: "error",
      status: 400,
    });
  }

  if (action !== "confirm" && action !== "reject" && action !== "cancel") {
    return ownerResultPage({
      title: "Invalid Action",
      message: "This confirmation link is not valid.",
      tone: "error",
      bookingId: id,
      status: 400,
    });
  }

  const status =
    action === "reject" ? "rejected" : action === "cancel" ? "cancelled" : "approved";
  const successMessage =
    action === "reject"
      ? "Rental rejected"
      : action === "cancel"
        ? "Rental cancelled"
        : "Rental confirmed";
  const successTitle =
    action === "reject"
      ? "Rental Rejected"
      : action === "cancel"
        ? "Rental Cancelled"
        : "Rental Confirmed";

  const supabase = createServiceRoleClient();

  let updateQuery = supabase
    .from("bookings")
    .update({ status })
    .eq("id", id)
    .select(RENTAL_BOOKING_SELECT);

  updateQuery =
    action === "cancel"
      ? updateQuery.in("status", ["pending", "approved"])
      : updateQuery.eq("status", "pending");

  const { data: updatedBooking, error } =
    await updateQuery.maybeSingle<RentalBookingRow>();

  if (error) {
    console.error("[api/rentals/confirm] status update error", error);
    return actionResult(req, {
      title: "Something Went Wrong",
      message:
        "The booking could not be updated. Please check the admin dashboard before trying again.",
      tone: "error",
      bookingId: id,
      status: 500,
    });
  }

  let booking = updatedBooking;
  let calendarRepairOnly = false;

  if (!booking && action === "confirm" && allowRepair) {
    const { data: existingBooking, error: existingError } = await supabase
      .from("bookings")
      .select(RENTAL_BOOKING_SELECT)
      .eq("id", id)
      .eq("status", "approved")
      .maybeSingle<RentalBookingRow>();

    if (existingError) {
      console.error("[api/rentals/confirm] existing booking load error", existingError);
      return ownerResultPage({
        title: "Already Confirmed",
        message:
          "This rental appears to be approved already, but the confirmation page could not reload the booking details.",
        tone: "warning",
        bookingId: id,
      });
    }

    if (existingBooking) {
      booking = existingBooking;
      calendarRepairOnly = true;
    }
  }

  if (!booking && action === "cancel" && allowRepair) {
    const { data: existingBooking, error: existingError } = await supabase
      .from("bookings")
      .select(RENTAL_BOOKING_SELECT)
      .eq("id", id)
      .in("status", ["cancelled", "canceled"])
      .maybeSingle<RentalBookingRow>();

    if (existingError) {
      console.error(
        "[api/rentals/confirm] cancelled booking reload error",
        existingError,
      );
      return actionResult(req, {
        title: "Cancellation Recorded",
        message:
          "The rental is cancelled, but its Calendar removal could not be retried because the booking could not be reloaded.",
        tone: "warning",
        bookingId: id,
        status: 500,
        calendarSyncFailed: true,
      });
    }

    if (existingBooking) {
      booking = existingBooking;
      calendarRepairOnly = true;
    }
  }

  if (!booking) {
    return actionResult(req, {
      title: "Already Processed",
      message:
        "This booking has already been handled or could not be found. Check the admin dashboard for the current status.",
      tone: "warning",
      bookingId: id,
      status: action === "cancel" ? 409 : undefined,
    });
  }

  const routePlanDate = String(booking.event_date).slice(0, 10);
  after(() =>
    runRoutePlannerAgent({
      bookingId: String(booking.id),
      eventDates: [routePlanDate],
      trigger:
        action === "confirm" ? "rental.confirmed" : "rental.removed",
    }),
  );

  if (action === "cancel") {
    let calendarSyncFailed = false;

    try {
      const deletion = await deleteGoogleCalendarDestinations({
        primaryEventId: booking.google_calendar_event_id,
        secondaryEventId: booking.google_calendar_secondary_event_id,
      });
      if (deletion.primaryStatus === "failed" || deletion.secondaryStatus === "failed") {
        console.error("[api/rentals/confirm] calendar delete partial failure", deletion);
        calendarSyncFailed = true;
      }
    } catch (calendarError) {
      calendarSyncFailed = true;
      console.error(
        "[api/rentals/confirm] calendar delete error",
        summarizeGoogleCalendarError(calendarError),
      );
    }

    if (booking.google_foam_calendar_event_id) {
      const foamCalendarId =
        process.env.GOOGLE_FOAM_CALENDAR_ID?.trim() ||
        process.env.GOOGLE_CALENDAR_ID ||
        "primary";
      try {
        const foamDeleted = await deleteGoogleCalendarEvent({
          eventId: booking.google_foam_calendar_event_id,
          calendarId: foamCalendarId,
        });
        if (!foamDeleted) {
          calendarSyncFailed = true;
          console.error("[api/rentals/confirm] foam calendar delete failed");
        }
      } catch (calendarError) {
        calendarSyncFailed = true;
        console.error(
          "[api/rentals/confirm] foam calendar delete error",
          summarizeGoogleCalendarError(calendarError),
        );
      }
    }

    await recordWorkflowOutcome({
      supabase,
      kind: "rental",
      bookingId: id,
      step: "calendar",
      outcome: calendarSyncFailed ? "failed" : "sent",
      safeErrorClass: calendarSyncFailed
        ? "calendar_projection_failed"
        : undefined,
    });
    if (calendarSyncFailed) {
      await sendBookingOperationalAlert({
        kind: "rental",
        bookingId: id,
        step: "calendar",
        safeErrorClass: "calendar_projection_failed",
      });
    }

    const message = calendarSyncFailed
      ? "The rental is cancelled and inventory is released, but at least one Google Calendar event could not be removed. The stored event IDs were preserved; retry cancellation from the Cancelled view."
      : calendarRepairOnly
        ? "The rental was already cancelled and its Google Calendar removal was retried successfully."
        : "The rental has been cancelled. Inventory is released and the booking history and Calendar event IDs were retained.";
    return actionResult(req, {
      title: successTitle,
      message,
      tone: calendarSyncFailed ? "warning" : "success",
      bookingId: booking.id,
      calendarSyncFailed,
    });
  }

  const customerEmail = booking.customer_email?.trim() ?? null;
  const customerName = booking.customer_name?.trim() ?? null;

  const eventDate =
    typeof booking.event_date === "string"
      ? booking.event_date.slice(0, 10)
      : String(booking.event_date);
  const rentalLabel = booking.rental_name?.trim() || booking.rental_item;
  const durationParts: string[] = [];
  if (booking.duration?.trim()) durationParts.push(booking.duration.trim());
  if (typeof booking.span_days === "number" && booking.span_days > 1) {
    durationParts.push(`${booking.span_days} days`);
  }

  const spanDays =
    typeof booking.span_days === "number" && booking.span_days >= 1
      ? booking.span_days
      : 1;
  const durationLabel = booking.duration?.trim() ?? "Standard";
  const bookingTotal =
    typeof booking.total === "number"
      ? booking.total
      : typeof booking.subtotal === "number"
        ? booking.subtotal
        : null;

  const calendarItems = await loadRentalItems(supabase, id, booking);
  const foamDurationLabel = foamDurationLabelForBooking(
    calendarItems,
    durationLabel,
    booking.foam_duration,
  );
  const rentalListText = buildRentalListWithPrices(
    calendarItems,
    durationLabel,
    spanDays,
    foamDurationLabel,
  );
  const estimatedTotalLine = formatEstimatedTotalLine(bookingTotal);

  let rentalCalendarResult: CalendarRepairResult | null = null;
  let foamCalendarResult: CalendarRepairResult | null = null;

  if (action === "confirm") {
    try {
      rentalCalendarResult = await createMissingRentalCalendarEvent({
        supabase,
        booking,
        id,
        calendarItems,
        eventDate,
        spanDays,
        durationLabel,
        foamDurationLabel,
        bookingTotal,
        customerName,
        customerEmail,
        rentalLabel,
      });
    } catch (calendarError) {
      console.error(
        "[api/rentals/confirm] rental calendar error",
        summarizeGoogleCalendarError(calendarError),
      );
      rentalCalendarResult = "failed";
    }

    try {
      foamCalendarResult = await createMissingFoamCalendarEvent({
        supabase,
        booking,
        id,
        calendarItems,
        eventDate,
        spanDays,
        durationLabel,
        foamDurationLabel,
        bookingTotal,
        customerName,
        customerEmail,
      });
    } catch (calendarError) {
      console.error(
        "[api/rentals/confirm] foam calendar error",
        summarizeGoogleCalendarError(calendarError),
      );
      foamCalendarResult = "failed";
    }
  }

  const calendarFailed =
    rentalCalendarResult === "failed" || foamCalendarResult === "failed";
  await recordWorkflowOutcome({
    supabase,
    kind: "rental",
    bookingId: id,
    step: "calendar",
    outcome: action === "reject" ? "not_required" : calendarFailed ? "failed" : "sent",
    safeErrorClass: calendarFailed ? "calendar_projection_failed" : undefined,
  });
  if (calendarFailed) {
    await sendBookingOperationalAlert({
      kind: "rental",
      bookingId: id,
      step: "calendar",
      safeErrorClass: "calendar_projection_failed",
    });
  }

  if (calendarRepairOnly) {
    if (
      rentalCalendarResult === "created" ||
      foamCalendarResult === "created"
    ) {
      return ownerResultPage({
        title: "Rental Confirmed",
        message:
          "This rental was already approved, and the missing calendar event has been repaired.",
        bookingId: booking.id,
      });
    }

    if (
      rentalCalendarResult === "failed" ||
      foamCalendarResult === "failed"
    ) {
      return ownerResultPage({
        title: "Rental Already Confirmed",
        message:
          "This rental is approved. The calendar repair did not finish, so check Schedule View or Google Calendar before relying on the calendar entry.",
        tone: "warning",
        bookingId: booking.id,
      });
    }

    return ownerResultPage({
      title: "Rental Already Confirmed",
      message:
        "This rental was already approved and the calendar entry is already handled.",
      bookingId: booking.id,
    });
  }

  if (!customerEmail || !customerName) {
    await recordWorkflowOutcome({
      supabase, kind: "rental", bookingId: id, step: "decision_email",
      outcome: "failed", safeErrorClass: "customer_contact_missing",
    });
    await sendBookingOperationalAlert({
      kind: "rental", bookingId: id, step: "decision_email",
      safeErrorClass: "customer_contact_missing",
    });
    return ownerResultPage({
      title: successTitle,
      message: `${successMessage}. No customer email was sent because customer contact details are missing.`,
      tone: "warning",
      bookingId: booking.id,
    });
  }

  try {
    const emailSubject =
      action === "reject"
        ? "Your rental request was declined"
        : "Your rental is approved";
    const emailMessage =
      action === "reject"
        ? "We are sorry, but we are unable to approve your rental request for the selected dates."
        : "Your rental booking has been approved.";

    const { error: emailError } = await sendDurableBookingEmail({
      supabase,
      messageKey: `rental-${id}-decision-${action}-v1`,
      kind: "rental",
      bookingId: id,
      purpose: `decision_${action}`,
      to: customerEmail,
      subject: emailSubject,
      text: [
        `Hi ${customerName},`,
        "",
        emailMessage,
        "",
        `Rental: ${rentalLabel}`,
        action === "confirm" ? "Selected rentals:" : null,
        action === "confirm" ? rentalListText : null,
        action === "confirm" ? estimatedTotalLine : null,
        `Event date: ${eventDate}`,
        booking.event_start_time?.trim()
          ? `Official party start time: ${booking.event_start_time.trim()}`
          : null,
        booking.requested_delivery_window?.trim()
          ? `Requested delivery window: ${booking.requested_delivery_window.trim()}`
          : booking.delivery_time?.trim()
            ? `Requested delivery window: ${booking.delivery_time.trim()}`
            : null,
        durationParts.length > 0 ? `Duration: ${durationParts.join(" - ")}` : null,
        foamDurationLabel && foamDurationLabel !== durationLabel
          ? `Foam time: ${foamDurationLabel}`
          : null,
        booking.event_address?.trim()
          ? `Event address: ${booking.event_address.trim()}`
          : null,
        booking.setup_surface?.trim()
          ? `Setup surface: ${booking.setup_surface.trim()}`
          : null,
        booking.setup_access?.trim()
          ? `Setup access: ${booking.setup_access.trim()}`
          : null,
        booking.setup_notes?.trim()
          ? `Setup notes: ${booking.setup_notes.trim()}`
          : null,
        booking.payment_method?.trim()
          ? `Payment method: ${booking.payment_method.trim()}`
          : null,
        "",
        `Booking ID: ${booking.id}`,
      ]
        .filter((line): line is string => line !== null)
        .join("\n"),
    });

    if (emailError) {
      await recordWorkflowOutcome({
        supabase, kind: "rental", bookingId: id, step: "decision_email",
        outcome: "failed", safeErrorClass: "decision_email_failed",
      });
      await sendBookingOperationalAlert({
        kind: "rental", bookingId: id, step: "decision_email",
        safeErrorClass: "decision_email_failed",
      });
      console.error("[api/rentals/confirm] customer email error", emailError);
      return ownerResultPage({
        title: successTitle,
        message:
          "The rental status was updated, but the customer email did not send. Please contact the customer manually.",
        tone: "warning",
        bookingId: booking.id,
      });
    }
  } catch (emailError) {
    console.error("[api/rentals/confirm] customer email error", emailError);
    await recordWorkflowOutcome({
      supabase, kind: "rental", bookingId: id, step: "decision_email",
      outcome: "failed", safeErrorClass: "decision_email_failed",
    });
    await sendBookingOperationalAlert({
      kind: "rental", bookingId: id, step: "decision_email",
      safeErrorClass: "decision_email_failed",
    });
    return ownerResultPage({
      title: successTitle,
      message:
        "The rental status was updated, but the customer email did not send. Please contact the customer manually.",
      tone: "warning",
      bookingId: booking.id,
    });
  }

  await recordWorkflowOutcome({
    supabase,
    kind: "rental",
    bookingId: id,
    step: "decision_email",
    outcome: "sent",
  });

  return ownerResultPage({
    title: successTitle,
    message:
      action === "confirm"
        ? calendarFailed
          ? "The rental is approved and the customer email was sent, but Calendar still requires attention."
          : "The rental is approved, the customer email was sent, and the calendar has been handled."
        : successMessage,
    tone: calendarFailed ? "warning" : "success",
    bookingId: booking.id,
  });
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  return renderApprovalReview({
    bookingKind: "rental",
    token,
    postPath: "/api/rentals/confirm",
  });
}

export async function POST(req: Request) {
  const resolved = await resolveDecisionRequest(req, "rental", {
    allowCancel: true,
  });
  if (!resolved.ok) return resolved.response;
  return handleRentalConfirm(req, resolved.decision, resolved.authorization === "admin");
}
