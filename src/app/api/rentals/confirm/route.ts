import { Resend } from "resend";

import {
  createGoogleCalendarEvent,
  summarizeGoogleCalendarError,
} from "@/lib/google/calendar";
import {
  buildRentalCalendarDescription,
  buildRentalListWithPrices,
  formatEstimatedTotalLine,
  isFoamPartyRentalItem,
  rentalCalendarDateTimes,
} from "@/lib/rentals/rental-pricing-text";
import { getResendFromAddress } from "@/lib/email/resend";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const RENTAL_BOOKING_SELECT =
  "id, customer_name, customer_email, customer_phone, rental_item, rental_name, event_date, duration, span_days, event_address, delivery_time, event_start_time, requested_delivery_window, distance_miles, delivery_fee, mileage_fee, setup_surface, setup_access, setup_notes, payment_method, subtotal, total, google_calendar_event_id, google_foam_calendar_event_id";

type RentalBookingRow = {
  id: number | string;
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
  setup_surface: string | null;
  setup_access: string | null;
  setup_notes: string | null;
  payment_method: string | null;
  subtotal: number | null;
  total: number | null;
  google_calendar_event_id: string | null;
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

  if (input.booking.google_calendar_event_id) {
    return "already_exists";
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
      : "Full day";
  const description = buildRentalCalendarDescription({
    items: rentalOnlyItems,
    durationLabel: rentalDurationLabel,
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
  const eventId = await createGoogleCalendarEvent({
    title: `Rental - ${input.rentalLabel} - ${input.customerName ?? "Guest"}`,
    description,
    start,
    end,
  });

  if (!eventId) {
    return "failed";
  }

  const { data: savedBooking, error: calendarIdError } = await input.supabase
    .from("bookings")
    .update({ google_calendar_event_id: eventId })
    .eq("id", input.id)
    .is("google_calendar_event_id", null)
    .select("google_calendar_event_id")
    .maybeSingle<{ google_calendar_event_id: string | null }>();

  if (calendarIdError) {
    console.error(
      "[api/rentals/confirm] rental calendar id save error",
      calendarIdError,
    );
    return "failed";
  }

  if (savedBooking?.google_calendar_event_id) {
    return "created";
  }

  const { data: existingBooking } = await input.supabase
    .from("bookings")
    .select("google_calendar_event_id")
    .eq("id", input.id)
    .maybeSingle<{ google_calendar_event_id: string | null }>();

  return existingBooking?.google_calendar_event_id ? "already_exists" : "failed";
}

async function createMissingFoamCalendarEvent(input: {
  supabase: ReturnType<typeof createServiceRoleClient>;
  booking: RentalBookingRow;
  id: string;
  calendarItems: { rental_item?: string; rental_name?: string }[];
  eventDate: string;
  spanDays: number;
  durationLabel: string;
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
  const description = buildRentalCalendarDescription({
    items: foamItems,
    durationLabel: input.durationLabel,
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

async function handleRentalConfirm(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const action = searchParams.get("action") ?? "confirm";

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
    return ownerResultPage({
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

  if (!booking && action === "confirm") {
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

  if (!booking) {
    return ownerResultPage({
      title: "Already Processed",
      message:
        "This booking has already been handled or could not be found. Check the admin dashboard for the current status.",
      tone: "warning",
      bookingId: id,
    });
  }

  if (action === "cancel") {
    return ownerResultPage({
      title: successTitle,
      message: "The rental has been cancelled.",
      bookingId: booking.id,
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
  const rentalListText = buildRentalListWithPrices(
    calendarItems,
    durationLabel,
    spanDays,
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

  if (
    action === "confirm" &&
    (rentalCalendarResult === "failed" || foamCalendarResult === "failed")
  ) {
    return ownerResultPage({
      title: "Rental Confirmed",
      message:
        "The rental was approved, but Google Calendar did not finish. The booking will still show in Schedule View; please check Google Calendar when you have a moment.",
      tone: "warning",
      bookingId: booking.id,
    });
  }

  if (!customerEmail || !customerName) {
    return ownerResultPage({
      title: successTitle,
      message: `${successMessage}. No customer email was sent because customer contact details are missing.`,
      tone: "warning",
      bookingId: booking.id,
    });
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (!resendApiKey) {
    return ownerResultPage({
      title: successTitle,
      message:
        "The rental status was updated, but customer email is not configured.",
      tone: "warning",
      bookingId: booking.id,
    });
  }

  try {
    const resend = new Resend(resendApiKey);
    const emailSubject =
      action === "reject"
        ? "Your rental request was declined"
        : "Your rental is approved";
    const emailMessage =
      action === "reject"
        ? "We are sorry, but we are unable to approve your rental request for the selected dates."
        : "Your rental booking has been approved.";

    const { error: emailError } = await resend.emails.send({
      from: getResendFromAddress(),
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
    return ownerResultPage({
      title: successTitle,
      message:
        "The rental status was updated, but the customer email did not send. Please contact the customer manually.",
      tone: "warning",
      bookingId: booking.id,
    });
  }

  return ownerResultPage({
    title: successTitle,
    message:
      action === "confirm"
        ? "The rental is approved, the customer email was sent, and the calendar has been handled."
        : successMessage,
    bookingId: booking.id,
  });
}

export async function GET(req: Request) {
  return handleRentalConfirm(req);
}

export async function POST(req: Request) {
  return handleRentalConfirm(req);
}
