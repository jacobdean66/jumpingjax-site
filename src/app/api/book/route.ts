import { NextResponse } from "next/server";
import {
  buildRentalListWithPrices,
  estimateCartGrandTotal,
  estimateCartRentalSubtotal,
  estimateMileageFee,
  estimateRentalDeliveryFee,
  formatDeliveryFeeLines,
  formatEstimatedTotalLine,
  normalizeDistanceMiles,
  resolveNewRentalDuration,
} from "@/lib/rentals/rental-pricing-text";
import {
  rentalConfirmLink,
  resolveRentalEmailSiteUrl,
} from "@/lib/rentals/rental-site-url";
import { getFacilityOwnerEmails } from "@/lib/email/resend";
import { rateLimit } from "@/lib/rate-limit";
import { insertPendingBooking } from "@/lib/supabase/booking-data";
import { getRentalBySlug } from "@/data/rentals";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  initializeBookingWorkflow,
  recordWorkflowOutcome,
} from "@/lib/bookings/workflow-state";
import { sendBookingOperationalAlert } from "@/lib/bookings/operational-alert";
import { sendDurableBookingEmail } from "@/lib/bookings/durable-email";

export const dynamic = "force-dynamic";

function isValidYmd(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidClockTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function POST(req: Request) {
  const limited = rateLimit(req, {
    scope: "rental-booking",
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
    return NextResponse.json({ ok: false, error: "Request body is too large" }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON request body" },
      { status: 400 },
    );
  }

  const { rental_items } = body;

  const rental_item =
    typeof body.rental_item === "string" && body.rental_item.trim()
      ? body.rental_item.trim()
      : null;

  const requestedRentalItems =
    Array.isArray(rental_items) && rental_items.length > 0
      ? rental_items
      : rental_item
        ? [{ rental_item, rental_name: rental_item }]
        : [];

  if (requestedRentalItems.length > 20) {
    return NextResponse.json({ error: "Too many rental items" }, { status: 400 });
  }

  const normalizedRentalItems = requestedRentalItems.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const slug = (item as { rental_item?: unknown }).rental_item;
    if (typeof slug !== "string") return [];
    const rental = getRentalBySlug(slug.trim());
    return rental ? [{ rental_item: rental.slug, rental_name: rental.title }] : [];
  });

  if (
    normalizedRentalItems.length === 0 ||
    normalizedRentalItems.length !== requestedRentalItems.length ||
    new Set(normalizedRentalItems.map((item) => item.rental_item)).size !==
      normalizedRentalItems.length
  ) {
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
  if (requestedDeliveryWindow.length > 100 || !isValidClockTime(eventStartTime)) {
    return NextResponse.json({ error: "Invalid delivery or event time" }, { status: 400 });
  }

  const customerName =
    typeof body.customer_name === "string" && body.customer_name.trim()
      ? body.customer_name.trim()
      : "Guest";
  const customerEmail =
    typeof body.customer_email === "string" && body.customer_email.trim()
      ? body.customer_email.trim()
      : "";
  const idempotencyKey =
    typeof body.idempotency_key === "string" ? body.idempotency_key.trim() : "";
  const customerPhone =
    typeof body.customer_phone === "string" ? body.customer_phone.trim() : "";
  const eventDateYmd =
    typeof body.event_date === "string" && body.event_date.trim()
      ? body.event_date.trim()
      : "";
  if (
    !isValidYmd(eventDateYmd) ||
    !idempotencyKey ||
    idempotencyKey.length > 128 ||
    !customerName || customerName === "Guest" || customerName.length > 120 ||
    !customerPhone || customerPhone.length > 40 ||
    !customerEmail || customerEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
  ) {
    return NextResponse.json(
      { error: "A valid event date, email, and request key are required" },
      { status: 400 },
    );
  }
  const requestedDurationLabel =
    typeof body.duration === "string" ? body.duration.trim() : "";
  const resolvedDuration = resolveNewRentalDuration(
    normalizedRentalItems as { rental_item?: string; rental_name?: string }[],
    requestedDurationLabel,
  );
  const durationLabel = resolvedDuration.label;
  const spanDays = resolvedDuration.spanDays;
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
  if (
    !eventAddress || eventAddress.length > 500 ||
    !setupSurface || setupSurface.length > 120 ||
    !setupAccess || setupAccess.length > 500 ||
    !paymentMethod || paymentMethod.length > 80 ||
    savedSetupNotes.length > 2000 ||
    (distanceMiles != null && distanceMiles > 500)
  ) {
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
    durationLabel,
    spanDays,
  );
  const total = estimateCartGrandTotal(
    normalizedRentalItems as { rental_item?: string; rental_name?: string }[],
    durationLabel,
    spanDays,
    deliveryFee,
  );

  const result = await insertPendingBooking({
    idempotencyKey,
    rental_items: normalizedRentalItems,
    customerName,
    email: customerEmail || "unknown@example.com",
    phone: customerPhone,
    eventDateYmd,
    durationLabel,
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
        error:
          result.code === "conflict"
            ? String(error)
            : result.code === "invalid_input"
              ? "Invalid booking request"
              : "Unable to save the rental request",
      },
      { status },
    );
  }

  const workflowSupabase = createServiceRoleClient();
  await initializeBookingWorkflow(workflowSupabase, "rental", result.id);

  const facilityOwnerEmails = getFacilityOwnerEmails();
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
    durationLabel,
    spanDays,
  );
  const estimatedTotalLine = formatEstimatedTotalLine(total);
  const deliveryFeeLines = formatDeliveryFeeLines({
    deliveryFee,
    mileageFee,
    distanceMiles,
  });

  let emailsSent = false;
  let customerReceiptFailed = false;
  let ownerNotificationFailed = facilityOwnerEmails.length === 0;
  let ownerNotificationSent = false;

  if (customerEmail) {
      try {
        const { error: emailError } = await sendDurableBookingEmail({
          supabase: workflowSupabase,
          messageKey: `rental-${result.id}-customer-receipt-v1`,
          kind: "rental",
          bookingId: result.id,
          purpose: "initial_customer_receipt",
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
          customerReceiptFailed = true;
          console.error("[api/book] rental customer email error", emailError);
        } else {
          customerReceiptFailed = false;
          emailsSent = true;
        }
      } catch (emailError) {
        customerReceiptFailed = true;
        console.error("[api/book] rental customer email error", emailError);
      }
  }

  if (facilityOwnerEmails.length > 0) {
      if (!siteUrl) {
        console.error(
          "[api/book] rental admin confirm links skipped: set NEXT_PUBLIC_SITE_URL (non-localhost) or deploy on Vercel",
        );
      }
      for (const ownerEmail of facilityOwnerEmails) {
        try {
          const { error: emailError } = await sendDurableBookingEmail({
            supabase: workflowSupabase,
            messageKey: `rental-${result.id}-owner-${ownerEmail}-v1`,
            kind: "rental",
            bookingId: result.id,
            purpose: "owner_notification",
            to: ownerEmail,
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
            ownerNotificationFailed = true;
            console.error("[api/book] rental admin email error", {
              ownerEmail,
              emailError,
            });
          } else {
            ownerNotificationSent = true;
            emailsSent = true;
          }
        } catch (emailError) {
          ownerNotificationFailed = true;
          console.error("[api/book] rental admin email error", {
            ownerEmail,
            emailError,
          });
        }
      }
  }

  await recordWorkflowOutcome({
    supabase: workflowSupabase,
    kind: "rental",
    bookingId: result.id,
    step: "initial_customer_email",
    outcome: customerReceiptFailed ? "failed" : "sent",
    safeErrorClass: customerReceiptFailed ? "email_delivery_failed" : undefined,
  });
  await recordWorkflowOutcome({
    supabase: workflowSupabase,
    kind: "rental",
    bookingId: result.id,
    step: "owner_notification",
    outcome: ownerNotificationFailed || !ownerNotificationSent ? "failed" : "sent",
    safeErrorClass:
      ownerNotificationFailed || !ownerNotificationSent
        ? "owner_notification_failed"
        : undefined,
  });
  if (customerReceiptFailed) {
    await sendBookingOperationalAlert({
      kind: "rental",
      bookingId: result.id,
      step: "initial_customer_email",
      safeErrorClass: "email_delivery_failed",
    });
  }
  if (ownerNotificationFailed || !ownerNotificationSent) {
    await sendBookingOperationalAlert({
      kind: "rental",
      bookingId: result.id,
      step: "owner_notification",
      safeErrorClass: "owner_notification_failed",
    });
  }

  return NextResponse.json({ ok: true, id: result.id, emailsSent });
}
