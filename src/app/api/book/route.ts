import { prepareRentalBooking } from "@/lib/rental-agreements/prepare-booking";
import { loadAgreementTemplate, loadAgreementHistory, customerAgreementPath } from "@/lib/rental-agreements/store";
import { buildRentalAgreementSnapshot } from "@/lib/rental-agreements/snapshot";
import { validSignerName } from "@/lib/rental-agreements/types";
import { agreementToken, hashToken, verifyPreviewToken } from "@/lib/rental-agreements/security";
import { hmacIpAddress } from "@/lib/waivers/tokens";
import { after, NextResponse } from "next/server";
import {
  buildRentalListWithPrices,
  formatDeliveryFeeLines,
  formatEstimatedTotalLine,
} from "@/lib/rentals/rental-pricing-text";
import {
  rentalConfirmLink,
  resolveRentalEmailSiteUrl,
} from "@/lib/rentals/rental-site-url";
import { getFacilityOwnerEmails } from "@/lib/email/resend";
import { rateLimit } from "@/lib/rate-limit";
import { insertPendingBooking } from "@/lib/supabase/booking-data";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  initializeBookingWorkflow,
  recordWorkflowOutcome,
} from "@/lib/bookings/workflow-state";
import { sendBookingOperationalAlert } from "@/lib/bookings/operational-alert";
import { sendDurableBookingEmail } from "@/lib/bookings/durable-email";
import { runRoutePlannerAgent } from "@/lib/admin/route-planner-agent";

export const dynamic = "force-dynamic";

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

  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid booking request." }, { status: 400 });
  const prepared = await prepareRentalBooking(body);
  if (prepared instanceof Response) return prepared;
  const { input, lineItems, notes } = prepared;
  const { customerName, email: customerEmail, phone: customerPhone, eventDateYmd, durationLabel, spanDays, foamDurationLabel, eventAddress, event_start_time: eventStartTime, requested_delivery_window: requestedDeliveryWindow, setup_location: setupLocation, setup_surface: setupSurface, setup_access: setupAccess, setup_notes: setupNotes, payment_method: paymentMethod, total, delivery_fee: deliveryFee, mileage_fee: mileageFee, distance_miles: distanceMiles } = input;
  if (body.agreement_acknowledged !== true || !validSignerName(body.agreement_signer_name)) {
    return NextResponse.json({ ok: false, error: "Review the rental agreement, check the acknowledgment, and type your full legal name to sign." }, { status: 400 });
  }
  const template = await loadAgreementTemplate();
  const snapshot = buildRentalAgreementSnapshot(input, template);
  if (!verifyPreviewToken(body.agreement_preview_token, snapshot)) {
    return NextResponse.json({ ok: false, error: "Your booking details or agreement have changed. Review the agreement again before signing.", agreementRefreshRequired: true }, { status: 409 });
  }
  const agreementId = crypto.randomUUID();
  const token = agreementToken(agreementId);
  const result = await insertPendingBooking({ ...input, agreement: { id: agreementId, tokenHash: hashToken(token), snapshot, templateVersion: template.version, signerName: body.agreement_signer_name.trim(), ipHmac: hmacIpAddress(req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()), userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null } });

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

  after(() =>
    runRoutePlannerAgent({
      bookingId: result.id,
      eventDates: [eventDateYmd],
      trigger: "rental.created",
    }),
  );

  const savedAgreement = (await loadAgreementHistory([result.id])).get(result.id)?.[0];
  const signedAgreementPath = savedAgreement ? customerAgreementPath(savedAgreement.id) : null;
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
  const foamDurationLine =
    foamDurationLabel && foamDurationLabel !== durationLabel
      ? `Foam time: ${foamDurationLabel}`
      : null;

  const rentalListText = buildRentalListWithPrices(
    lineItems,
    durationLabel,
    spanDays,
    foamDurationLabel,
  );
  const estimatedTotalLine = formatEstimatedTotalLine(total);
  const deliveryFeeLines = formatDeliveryFeeLines({
    deliveryFee,
    mileageFee,
    distanceMiles: distanceMiles ?? null,
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
            foamDurationLine,
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
            signedAgreementPath ? `Your signed rental agreement: ${new URL(signedAgreementPath, resolveRentalEmailSiteUrl(req.url)).toString()}` : null,
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
            foamDurationLine,
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

  return NextResponse.json({ ok: true, id: result.id, emailsSent, signedAgreementPath });
}
