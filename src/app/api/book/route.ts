import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  buildRentalListWithPrices,
  estimateCartGrandTotal,
  estimateCartRentalSubtotal,
  estimateMileageFee,
  estimateRentalDeliveryFee,
  formatDeliveryFeeLines,
  formatEstimatedTotalLine,
  normalizeDistanceMiles,
} from "@/lib/rentals/rental-pricing-text";
import {
  rentalConfirmLink,
  resolveRentalEmailSiteUrl,
} from "@/lib/rentals/rental-site-url";
import { getFacilityOwnerEmail, getResendFromAddress } from "@/lib/email/resend";
import { rateLimit } from "@/lib/rate-limit";
import { insertPendingBooking } from "@/lib/supabase/booking-data";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = rateLimit(req, {
    scope: "rental-booking",
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

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

  const requestedDeliveryWindow =
    typeof body.requested_delivery_window === "string" &&
    body.requested_delivery_window.trim()
      ? body.requested_delivery_window.trim()
      : null;
  const eventStartTime =
    typeof body.event_start_time === "string" && body.event_start_time.trim()
      ? body.event_start_time.trim()
      : null;

  if (!requestedDeliveryWindow || !eventStartTime) {
    return new Response(
      JSON.stringify({
        error: "requested_delivery_window and event_start_time are required",
      }),
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
  const distanceMiles = normalizeDistanceMiles(body.distance_miles);
  const mileageFee = estimateMileageFee(distanceMiles);
  const deliveryFee = estimateRentalDeliveryFee(distanceMiles);
  const setupLocation =
    typeof body.setup_location === "string" && body.setup_location.trim()
      ? body.setup_location.trim()
      : eventAddress;
  const setupSurface =
    typeof body.setup_surface === "string" ? body.setup_surface.trim() : "";
  const setupAccess =
    typeof body.setup_access === "string" ? body.setup_access.trim() : "";
  const setupNotes =
    typeof body.setup_notes === "string" ? body.setup_notes.trim() : "";
  const electricityDistance =
    typeof body.electricity_distance === "string"
      ? body.electricity_distance.trim()
      : "";
  const waterDistance =
    typeof body.water_distance === "string" ? body.water_distance.trim() : "";
  const setupNoteLines = [
    electricityDistance
      ? `Electricity distance: ${electricityDistance}`
      : null,
    waterDistance ? `Water distance: ${waterDistance}` : null,
    ...setupNotes.split(/\r?\n/).map((line) => line.trim()),
  ].filter((line): line is string => Boolean(line));
  const savedSetupNotes = Array.from(new Set(setupNoteLines)).join("\n");
  const paymentMethod =
    typeof body.payment_method === "string" ? body.payment_method.trim() : "";
  if (!eventAddress || !setupSurface || !setupAccess || !paymentMethod) {
    return new Response(
      JSON.stringify({
        error:
          "event_address, setup_surface, setup_access, and payment_method are required",
      }),
      { status: 400 },
    );
  }
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
    deliveryFee,
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
    event_start_time: eventStartTime,
    requested_delivery_window: requestedDeliveryWindow,
    distance_miles: distanceMiles,
    delivery_fee: deliveryFee,
    mileage_fee: mileageFee,
    setup_location: setupLocation,
    setup_surface: setupSurface,
    setup_access: setupAccess,
    setup_notes: savedSetupNotes,
    payment_method: paymentMethod,
    subtotal,
    total,
  });

  if (!result.ok) {
    const error = result.message ?? result.code ?? result;
    console.error("BOOK API ERROR:", error);
    const status =
      result.code === "conflict"
        ? 409
        : result.code === "invalid_input"
          ? 400
          : 500;
    return NextResponse.json(
      {
        ok: false,
        error: String(error),
      },
      { status },
    );
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const facilityOwnerEmail = getFacilityOwnerEmail();
  const fromAddress = getResendFromAddress();
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
  const deliveryFeeLines = formatDeliveryFeeLines({
    deliveryFee,
    mileageFee,
    distanceMiles,
  });

  let emailsSent = false;

  if (resendApiKey) {
    const resend = new Resend(resendApiKey);

    if (customerEmail) {
      try {
        const { error: emailError } = await resend.emails.send({
          from: fromAddress,
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
            `Event date: ${eventDateYmd}`,
            durationLine ? `Duration: ${durationLine}` : null,
            `Official party start time: ${eventStartTime}`,
            `Requested delivery window: ${requestedDeliveryWindow}`,
            `Name: ${customerName}`,
            customerPhone ? `Phone: ${customerPhone}` : null,
            eventAddress ? `Event address: ${eventAddress}` : null,
            setupLocation ? `Setup location: ${setupLocation}` : null,
            setupSurface ? `Setup surface: ${setupSurface}` : null,
            setupAccess ? `Setup access: ${setupAccess}` : null,
            setupNotes ? `Setup notes: ${setupNotes}` : null,
            paymentMethod ? `Payment method: ${paymentMethod}` : null,
            "",
            ...deliveryFeeLines,
            estimatedTotalLine,
            "Final quote will be confirmed by Jumping Jax.",
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
          from: fromAddress,
          to: facilityOwnerEmail,
          subject: "New Jumping Jax rental request",
          text: [
            "New rental request — manual review required.",
            "This rental still needs manual review.",
            "",
            `Booking ID: ${result.id}`,
            "Rentals:",
            rentalListText,
            `Event date: ${eventDateYmd}`,
            durationLine ? `Duration: ${durationLine}` : `Span: ${spanDays} day(s)`,
            `Official party start time: ${eventStartTime}`,
            `Requested delivery window: ${requestedDeliveryWindow}`,
            `Customer: ${customerName}`,
            `Email: ${customerEmail || "(not provided)"}`,
            customerPhone ? `Phone: ${customerPhone}` : "Phone: (not provided)",
            eventAddress
              ? `Event address: ${eventAddress}`
              : "Event address: (not provided)",
            setupLocation
              ? `Setup location: ${setupLocation}`
              : "Setup location: (not provided)",
            setupSurface
              ? `Setup surface: ${setupSurface}`
              : "Setup surface: (not provided)",
            setupAccess
              ? `Setup access: ${setupAccess}`
              : "Setup access: (not provided)",
            setupNotes ? `Setup notes: ${setupNotes}` : "Setup notes: (none)",
            paymentMethod
              ? `Payment method: ${paymentMethod}`
              : "Payment method: (not provided)",
            "",
            ...deliveryFeeLines,
            estimatedTotalLine,
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
