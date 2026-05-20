import { NextResponse } from "next/server";
import { Resend } from "resend";

import { createGoogleCalendarEvent } from "@/lib/google/calendar";
import {
  formatStoredFacilityAddons,
  type ResolvedFacilityAddonLine,
} from "@/lib/facility-parties/addons";
import { createServiceRoleClient } from "@/lib/supabase/admin";

type FacilityBookingCalendarFields = {
  customer_name: string;
  email: string | null;
  phone: string | null;
  party_label: string | null;
  room: string | null;
  readable_date: string | null;
  readable_time: string | null;
  start_time: string;
  end_time: string;
  notes: string | null;
  addon_selections: unknown;
};

function addonLinesFromStored(stored: unknown): ResolvedFacilityAddonLine[] {
  if (!stored || typeof stored !== "object") {
    return [];
  }
  const record = stored as { lines?: ResolvedFacilityAddonLine[] };
  return Array.isArray(record.lines) ? record.lines : [];
}

function formatCalendarAddonLine(line: ResolvedFacilityAddonLine): string {
  const price = `$${Number.isInteger(line.lineTotal) ? line.lineTotal : line.lineTotal.toFixed(2)}`;

  if (line.key === "goodieBags") {
    return `- Goodie Bags (x${line.quantity}) (${price})`;
  }

  if (line.key === "cottonCandy10" || line.key === "cottonCandy20") {
    const kids = line.detail ?? "";
    return `- Cotton Candy (${kids}) (${price})`;
  }

  return `- ${line.label} (${price})`;
}

function formatFacilityCalendarDescription(
  booking: FacilityBookingCalendarFields,
): string {
  const sections: string[] = [
    "Customer:",
    `Name: ${booking.customer_name}`,
  ];

  if (booking.email) {
    sections.push(`Email: ${booking.email}`);
  }
  if (booking.phone) {
    sections.push(`Phone: ${booking.phone}`);
  }

  sections.push("", "Booking:");
  if (booking.party_label) {
    sections.push(`Type: ${booking.party_label}`);
  }
  if (booking.room) {
    sections.push(`Room: ${booking.room}`);
  }

  const timeValue =
    booking.readable_time && booking.readable_date
      ? `${booking.readable_date}, ${booking.readable_time}`
      : booking.readable_time
        ? booking.readable_time
        : `${booking.start_time} - ${booking.end_time}`;
  sections.push(`Time: ${timeValue}`);

  const addonLines = addonLinesFromStored(booking.addon_selections);
  if (addonLines.length > 0) {
    sections.push("", "Add-ons:");
    for (const line of addonLines) {
      sections.push(formatCalendarAddonLine(line));
    }
  }

  const notes = booking.notes?.trim();
  if (notes) {
    sections.push("", "Notes:", notes);
  }

  return sections.join("\n");
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
        const eventId = await createGoogleCalendarEvent({
          title: `${booking.party_label} - ${booking.customer_name}`,
          description: formatFacilityCalendarDescription(booking),
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
