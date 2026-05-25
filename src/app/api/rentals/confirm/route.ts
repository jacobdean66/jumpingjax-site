import { NextResponse } from "next/server";
import { Resend } from "resend";

import { createGoogleCalendarEvent } from "@/lib/google/calendar";
import {
  buildRentalCalendarDescription,
  rentalCalendarDateTimes,
} from "@/lib/rentals/rental-pricing-text";
import { createServiceRoleClient } from "@/lib/supabase/admin";

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

  const { data: booking, error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", id)
    .eq("status", "pending")
    .select(
      "id, customer_name, customer_email, customer_phone, rental_item, rental_name, event_date, duration, span_days, event_address, delivery_time, subtotal, total",
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!booking) {
    return NextResponse.json(
      { error: "Booking not found or already processed" },
      { status: 409 },
    );
  }

  const customerEmail = booking.customer_email?.trim();
  const customerName = booking.customer_name?.trim();

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

  const { data: rentalItemRows } = await supabase
    .from("booking_rental_items")
    .select("rental_item, rental_name")
    .eq("booking_id", id);

  const calendarItems =
    rentalItemRows && rentalItemRows.length > 0
      ? rentalItemRows
      : [
          {
            rental_item: booking.rental_item,
            rental_name: booking.rental_name ?? booking.rental_item,
          },
        ];

  if (action === "confirm") {
    try {
      const { start, end } = rentalCalendarDateTimes(
        eventDate,
        booking.delivery_time,
        spanDays,
      );
      const description = buildRentalCalendarDescription({
        items: calendarItems,
        durationLabel,
        spanDays,
        total: bookingTotal,
        eventDateYmd: eventDate,
        deliveryTime: booking.delivery_time,
        customerName: customerName ?? "Guest",
        customerPhone: booking.customer_phone,
        customerEmail,
        eventAddress: booking.event_address,
        bookingId: String(booking.id),
      });
      await createGoogleCalendarEvent({
        title: `Rental — ${rentalLabel} — ${customerName ?? "Guest"}`,
        description,
        start,
        end,
      });
    } catch (calendarError) {
      console.error("[api/rentals/confirm] rental calendar error", calendarError);
    }
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
      from: "Jumping Jax <onboarding@resend.dev>",
      to: customerEmail,
      subject: emailSubject,
      text: [
        `Hi ${customerName},`,
        "",
        emailMessage,
        "",
        `Rental: ${rentalLabel}`,
        `Event date: ${eventDate}`,
        durationParts.length > 0 ? `Duration: ${durationParts.join(" — ")}` : null,
        booking.event_address?.trim()
          ? `Event address: ${booking.event_address.trim()}`
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
