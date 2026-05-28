import { NextResponse } from "next/server";
import { Resend } from "resend";

import { createGoogleCalendarEvent } from "@/lib/google/calendar";
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

  return savedBooking?.google_calendar_event_id ? "created" : "failed";
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

  return savedBooking?.google_foam_calendar_event_id ? "created" : "failed";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const action = searchParams.get("action") ?? "confirm";

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  if (action !== "confirm" && action !== "reject") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const status = action === "reject" ? "rejected" : "approved";
  const successMessage =
    action === "reject" ? "Rental rejected" : "Rental confirmed";

  const supabase = createServiceRoleClient();

  const { data: updatedBooking, error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", id)
    .eq("status", "pending")
    .select(RENTAL_BOOKING_SELECT)
    .maybeSingle<RentalBookingRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let booking = updatedBooking;
  let calendarRepairOnly = false;

  if (!booking && action === "confirm") {
    const { data: existingBooking, error: existingError } = await supabase
      .from("bookings")
      .select(RENTAL_BOOKING_SELECT)
      .eq("id", id)
      .eq("status", "approved")
      .or("google_calendar_event_id.is.null,google_foam_calendar_event_id.is.null")
      .maybeSingle<RentalBookingRow>();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

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
      console.error("[api/rentals/confirm] rental calendar error", calendarError);
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
      console.error("[api/rentals/confirm] foam calendar error", calendarError);
      foamCalendarResult = "failed";
    }
  }

  if (calendarRepairOnly) {
    if (
      rentalCalendarResult === "created" ||
      foamCalendarResult === "created"
    ) {
      return new Response("Rental calendar event repaired");
    }

    if (
      rentalCalendarResult === "failed" ||
      foamCalendarResult === "failed"
    ) {
      return NextResponse.json(
        { error: "Rental is approved, but calendar repair failed" },
        { status: 500 },
      );
    }

    return new Response("Rental calendar event already exists");
  }

  if (!customerEmail || !customerName) {
    return new Response(`${successMessage}. No customer email sent (missing data).`);
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (!resendApiKey) {
    return NextResponse.json(
      { error: "Status changed but email is not configured" },
      { status: 500 },
    );
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
      return NextResponse.json(
        { error: "Status changed but customer email failed" },
        { status: 500 },
      );
    }
  } catch (emailError) {
    console.error("[api/rentals/confirm] customer email error", emailError);
    return NextResponse.json(
      { error: "Status changed but customer email failed" },
      { status: 500 },
    );
  }

  return new Response(successMessage);
}
