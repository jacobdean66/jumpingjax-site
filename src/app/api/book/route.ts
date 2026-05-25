import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  buildRentalListWithPrices,
  estimateCartGrandTotal,
  estimateCartRentalSubtotal,
  formatEstimatedTotalLine,
} from "@/lib/rentals/rental-pricing-text";
import {
  rentalConfirmLink,
  resolveRentalEmailSiteUrl,
} from "@/lib/rentals/rental-site-url";
import { insertPendingBooking } from "@/lib/supabase/booking-data";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  console.log("[api/book] request received");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (error) {
    console.error("BOOK API ERROR:", error);
    return NextResponse.json(
      {
        ok: false,
        error: String(error),
      },
      { status: 500 },
    );
  }

  console.log("[api/book] request body", body);

  const { rental_items } = body;

  const rental_item =
    typeof body.rental_item === "string" && body.rental_item.trim()
      ? body.rental_item.trim()
      : null;

  const normalizedRentalItems =
    Array.isArray(rental_items) && rental_items.length > 0
      ? rental_items
      : rental_item
        ? [{ rental_item, rental_name: rental_item }]
        : [];

  if (normalizedRentalItems.length === 0) {
    return new Response(
      JSON.stringify({ error: "rental_items is required" }),
      { status: 400 },
    );
  }

  const delivery_time =
    typeof body.delivery_time === "string" && body.delivery_time.trim()
      ? body.delivery_time.trim()
      : null;

  if (!delivery_time) {
    return new Response(
      JSON.stringify({ error: "delivery_time is required" }),
      { status: 400 },
    );
  }

  const customerName =
    typeof body.customer_name === "string" && body.customer_name.trim()
      ? body.customer_name.trim()
      : "Guest";
  const customerEmail =
    typeof body.customer_email === "string" && body.customer_email.trim()
      ? body.customer_email.trim()
      : "";
  const customerPhone =
    typeof body.customer_phone === "string" ? body.customer_phone.trim() : "";
  const eventDateYmd =
    typeof body.event_date === "string" && body.event_date.trim()
      ? body.event_date.trim()
      : new Date().toISOString().slice(0, 10);
  const durationLabel =
    typeof body.duration === "string" ? body.duration.trim() : "";
  const spanDays =
    typeof body.span_days === "number" && body.span_days >= 1
      ? body.span_days
      : 1;
  const eventAddress =
    typeof body.event_address === "string" ? body.event_address.trim() : "";
  const notes =
    typeof body.notes === "string" && body.notes.trim()
      ? body.notes.trim()
      : "";
  const subtotal = estimateCartRentalSubtotal(
    normalizedRentalItems as { rental_item?: string; rental_name?: string }[],
    durationLabel || "Standard",
    spanDays,
  );
  const total = estimateCartGrandTotal(
    normalizedRentalItems as { rental_item?: string; rental_name?: string }[],
    durationLabel || "Standard",
    spanDays,
  );

  const result = await insertPendingBooking({
    rental_items: normalizedRentalItems,
    customerName,
    email: customerEmail || "unknown@example.com",
    phone: customerPhone,
    eventDateYmd,
    durationLabel: durationLabel || "Standard",
    spanDays,
    eventAddress,
    delivery_time,
    subtotal,
    total,
  });

  console.log("SUPABASE RESULT:", result);

  if (!result.ok) {
    console.error("SUPABASE FULL ERROR:", result);
    const error = result.message ?? result.code ?? result;
    console.error("BOOK API ERROR:", error);
    return NextResponse.json(
      {
        ok: false,
        error: String(error),
      },
      { status: 500 },
    );
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const facilityOwnerEmail = process.env.FACILITY_OWNER_EMAIL?.trim();
  const siteUrl = resolveRentalEmailSiteUrl(req.url);
  console.log(
    "[api/book] rental admin email site URL",
    siteUrl || "(none — confirm/reject links omitted)",
  );

  const durationParts: string[] = [];
  if (durationLabel) durationParts.push(durationLabel);
  if (spanDays > 1) durationParts.push(`${spanDays} days`);
  else if (spanDays === 1 && !durationLabel) durationParts.push("1 day");
  const durationLine =
    durationParts.length > 0 ? durationParts.join(" — ") : null;

  const rentalListText = buildRentalListWithPrices(
    normalizedRentalItems as { rental_item?: string; rental_name?: string }[],
    durationLabel || "Standard",
    spanDays,
  );
  const estimatedTotalLine = formatEstimatedTotalLine(total);

  let emailsSent = false;

  if (resendApiKey) {
    const resend = new Resend(resendApiKey);

    if (customerEmail) {
      try {
        const { error: emailError } = await resend.emails.send({
          from: "Jumping Jax <onboarding@resend.dev>",
          to: customerEmail,
          subject: "We received your Jumping Jax rental request",
          text: [
            `Hi ${customerName},`,
            "",
            "We received your rental request.",
            "It is waiting for confirmation.",
            "Jumping Jax will contact you once your request has been reviewed.",
            "",
            `Booking reference: ${result.id}`,
            "Selected rentals:",
            rentalListText,
            estimatedTotalLine,
            "Final quote will be confirmed by Jumping Jax.",
            `Event date: ${eventDateYmd}`,
            durationLine ? `Duration: ${durationLine}` : null,
            `Name: ${customerName}`,
            customerPhone ? `Phone: ${customerPhone}` : null,
            eventAddress ? `Event address: ${eventAddress}` : null,
          ]
            .filter((line): line is string => line !== null)
            .join("\n"),
        });

        if (emailError) {
          console.error("[api/book] rental customer email error", emailError);
        } else {
          emailsSent = true;
        }
      } catch (emailError) {
        console.error("[api/book] rental customer email error", emailError);
      }
    }

    if (facilityOwnerEmail) {
      if (!siteUrl) {
        console.error(
          "[api/book] rental admin confirm links skipped: set NEXT_PUBLIC_SITE_URL (non-localhost) or deploy on Vercel",
        );
      }
      try {
        const { error: emailError } = await resend.emails.send({
          from: "Jumping Jax <onboarding@resend.dev>",
          to: facilityOwnerEmail,
          subject: "New Jumping Jax rental request",
          text: [
            "New rental request — manual review required.",
            "This rental still needs manual review.",
            "",
            `Booking ID: ${result.id}`,
            "Rentals:",
            rentalListText,
            estimatedTotalLine,
            `Event date: ${eventDateYmd}`,
            durationLine ? `Duration: ${durationLine}` : `Span: ${spanDays} day(s)`,
            `Customer: ${customerName}`,
            `Email: ${customerEmail || "(not provided)"}`,
            customerPhone ? `Phone: ${customerPhone}` : "Phone: (not provided)",
            eventAddress
              ? `Event address: ${eventAddress}`
              : "Event address: (not provided)",
            notes ? `Notes: ${notes}` : "Notes: (none)",
            "",
            ...(siteUrl
              ? [
                  "Confirm this booking:",
                  rentalConfirmLink(siteUrl, result.id, "confirm"),
                  "",
                  "Reject this booking:",
                  rentalConfirmLink(siteUrl, result.id, "reject"),
                ]
              : [
                  "Confirm/reject links unavailable — set NEXT_PUBLIC_SITE_URL on Vercel.",
                ]),
          ].join("\n"),
        });

        if (emailError) {
          console.error("[api/book] rental admin email error", emailError);
        } else {
          emailsSent = true;
        }
      } catch (emailError) {
        console.error("[api/book] rental admin email error", emailError);
      }
    }
  }

  return NextResponse.json({ ok: true, id: result.id, emailsSent });
}
