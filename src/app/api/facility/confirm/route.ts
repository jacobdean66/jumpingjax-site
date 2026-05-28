import { NextResponse } from "next/server";
import { Resend } from "resend";

import { createGoogleCalendarEvent } from "@/lib/google/calendar";
import {
  formatStoredFacilityAddons,
  type ResolvedFacilityAddonLine,
} from "@/lib/facility-parties/addons";
import {
  formatFacilityPricingLines,
  type FacilityPricingResult,
} from "@/lib/facility-parties/pricing";
import { getResendFromAddress } from "@/lib/email/resend";
import { createServiceRoleClient } from "@/lib/supabase/admin";

type FacilityBookingCalendarFields = {
  customer_name: string;
  email: string | null;
  phone: string | null;
  parent_name: string | null;
  child_name: string | null;
  child_gender: string | null;
  child_age: string | null;
  party_theme: string | null;
  balloon_colors: string | null;
  table_cloth_colors: string | null;
  drink_choice: string | null;
  payment_method: string | null;
  deposit_acknowledged: boolean | null;
  party_label: string | null;
  room: string | null;
  readable_date: string | null;
  readable_time: string | null;
  start_time: string;
  end_time: string;
  notes: string | null;
  addon_selections: unknown;
  facility_package_price: number | null;
  addon_subtotal: number | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  pricing_details: unknown;
};

function numberOrZero(value: number | null): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function pricingFromBooking(
  booking: FacilityBookingCalendarFields,
): FacilityPricingResult {
  const taxRate =
    booking.pricing_details &&
    typeof booking.pricing_details === "object" &&
    typeof (booking.pricing_details as { taxRate?: unknown }).taxRate === "number"
      ? (booking.pricing_details as { taxRate: number }).taxRate
      : 0.07;

  return {
    packagePrice: numberOrZero(booking.facility_package_price),
    addonSubtotal: numberOrZero(booking.addon_subtotal),
    subtotal: numberOrZero(booking.subtotal),
    tax: numberOrZero(booking.tax),
    total: numberOrZero(booking.total),
    taxRate,
    missingPrice: null,
  };
}

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
  if (booking.parent_name) {
    sections.push(`Parent: ${booking.parent_name}`);
  }

  sections.push("", "Booking:");
  if (booking.party_label) {
    sections.push(`Type: ${booking.party_label}`);
  }
  if (booking.child_name) {
    sections.push(`Child: ${booking.child_name}`);
  }
  if (booking.child_gender) {
    sections.push(`Child gender: ${booking.child_gender}`);
  }
  if (booking.child_age) {
    sections.push(`Child age: ${booking.child_age}`);
  }
  if (booking.party_theme) {
    sections.push(`Theme: ${booking.party_theme}`);
  }
  if (booking.balloon_colors) {
    sections.push(`Balloon colors: ${booking.balloon_colors}`);
  }
  if (booking.table_cloth_colors) {
    sections.push(`Table cloth colors: ${booking.table_cloth_colors}`);
  }
  if (booking.drink_choice) {
    sections.push(`Drink choice: ${booking.drink_choice}`);
  }
  if (booking.payment_method) {
    sections.push(`Payment method: ${booking.payment_method}`);
  }
  sections.push(
    `Deposit acknowledgement: ${
      booking.deposit_acknowledged ? "Checked" : "Not checked"
    }`,
  );
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
  sections.push("", ...formatFacilityPricingLines(pricingFromBooking(booking)));

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

  const { data: booking, error } = await supabase
    .from("facility_bookings")
    .update({ status })
    .eq("id", id)
    .eq("status", "pending")
    .select(
      "id, email, customer_name, readable_date, readable_time, party_label, start_time, end_time, phone, parent_name, child_name, child_gender, child_age, party_theme, balloon_colors, table_cloth_colors, drink_choice, payment_method, deposit_acknowledged, room, notes, addon_selections, facility_package_price, addon_subtotal, subtotal, tax, total, pricing_details, google_calendar_event_id",
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
          calendarId: facilityCalendarId,
        });
        const { error: calendarIdError } = await supabase
          .from("facility_bookings")
          .update({ google_calendar_event_id: eventId })
          .eq("id", booking.id);
        if (calendarIdError) {
          console.error(
            "[api/facility/confirm] facility calendar id save error",
            calendarIdError,
          );
        }
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
    const pricingLines = formatFacilityPricingLines(pricingFromBooking(booking));

    const { error: emailError } = await resend.emails.send({
      from: getResendFromAddress(),
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
          ? "Deposit: $50 due two weeks before the party date, paid directly to Jumping Jax."
          : null,
        "",
        formatStoredFacilityAddons(booking.addon_selections),
        ...pricingLines,
      ]
        .filter((line): line is string => line !== null)
        .join("\n"),
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
