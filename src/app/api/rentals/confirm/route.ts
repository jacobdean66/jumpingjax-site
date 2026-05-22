import { NextResponse } from "next/server";
import { Resend } from "resend";

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
      "id, customer_name, customer_email, rental_item, rental_name, event_date, duration, span_days, event_address",
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
