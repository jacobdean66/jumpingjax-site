import { NextResponse } from "next/server";
import { Resend } from "resend";

import { createGoogleCalendarEvent } from "@/lib/google/calendar";
import { formatStoredFacilityAddons } from "@/lib/facility-parties/addons";
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

  const status = action === "reject" ? "rejected" : "confirmed";
  const successMessage =
    action === "reject"
      ? "Booking rejected. You can close this tab."
      : "Booking confirmed. You can close this tab.";

  const supabase = createServiceRoleClient();

  const { data: booking, error } = await supabase
    .from("facility_bookings")
    .update({ status })
    .eq("id", id)
    .eq("status", "pending")
    .select(
      "id, email, customer_name, readable_date, readable_time, party_label, start_time, end_time, phone, room, notes, addon_selections, google_calendar_event_id",
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

  if (action === "confirm") {
    console.log("=== CONFIRM HIT ===");
    console.log("BOOKING ID:", id);
    console.log("CUSTOMER EMAIL:", booking.email);
    console.log("CUSTOMER NAME:", booking.customer_name);

    try {
      if (!booking.google_calendar_event_id) {
        const addonsText = formatStoredFacilityAddons(booking.addon_selections);
        const calendarDescription = [
          booking.customer_name,
          booking.phone ? `Phone: ${booking.phone}` : "",
          booking.room ? `Room: ${booking.room}` : "",
          booking.notes?.trim() ? `Notes: ${booking.notes.trim()}` : "",
          addonsText,
        ]
          .filter(Boolean)
          .join("\n");

        const eventId = await createGoogleCalendarEvent({
          title: `${booking.party_label} - ${booking.customer_name}`,
          description: calendarDescription,
          start: booking.start_time,
          end: booking.end_time,
        });
        await supabase
          .from("facility_bookings")
          .update({ google_calendar_event_id: eventId })
          .eq("id", booking.id);
      }
    } catch (calendarError) {
      console.error("GOOGLE CALENDAR ERROR", calendarError);
    }
  }

  if (
    !booking.email ||
    !booking.customer_name ||
    !booking.readable_date ||
    !booking.readable_time ||
    !booking.party_label
  ) {
    return new Response("Status updated. No customer email sent (missing data).");
  }

  try {
    console.log("SENDING CUSTOMER EMAIL...");

    const resend = new Resend(process.env.RESEND_API_KEY?.trim());
    const emailSubject =
      action === "reject"
        ? "Your Jumping Jax facility booking request"
        : "Your Jumping Jax facility booking is confirmed";
    const emailMessage =
      action === "reject"
        ? "We are sorry, but we are unable to confirm your facility booking request for this time."
        : "Your facility booking has been confirmed.";

    const { error: emailError } = await resend.emails.send({
      from: "Jumping Jax <onboarding@resend.dev>",
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
        "",
        formatStoredFacilityAddons(booking.addon_selections),
      ].join("\n"),
    });

    if (emailError) {
      console.error("CUSTOMER STATUS EMAIL ERROR", emailError);
      return NextResponse.json(
        { error: "Status changed but customer email failed" },
        { status: 500 },
      );
    }

    console.log("EMAIL SENT SUCCESS");
  } catch (emailError) {
    console.error("EMAIL ERROR:", emailError);
    console.error("CUSTOMER STATUS EMAIL ERROR", emailError);
    return NextResponse.json(
      { error: "Status changed but customer email failed" },
      { status: 500 },
    );
  }

  return new Response(successMessage);
}
