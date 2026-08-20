import { NextRequest, NextResponse } from "next/server";

import {
  listPrivateSlotDispositions,
  listPublicSaturdaySlotDispositions,
} from "@/lib/facility-parties/availability";
import { isFacilityBookingYmdWithinHorizon } from "@/lib/facility-parties/booking-horizon";
import { FACILITY_PARTY_BUFFER_MINUTES } from "@/lib/facility-parties/constants";
import type {
  FacilityRoomId,
  PrivateDurationMinutes,
} from "@/lib/facility-parties/types";
import {
  facilityAddonsForStorage,
  formatFacilityAddonsForEmail,
  resolveFacilityAddons,
} from "@/lib/facility-parties/addons";
import {
  formatFacilityPricingLines,
  priceFacilityPartyWithConfig,
} from "@/lib/facility-parties/pricing";
import {
  buildFacilityWaiverInvitationUrl,
  invitationTemplateLabel,
  invitationDeliveryPreferenceLabel,
  normalizeInvitationCreationPreference,
  normalizeInvitationDeliveryPreference,
  normalizeInvitationTemplateId,
} from "@/lib/facility-parties/invitations";
import { loadSiteSettings } from "@/lib/admin/site-settings";
import { getFacilityOwnerEmails } from "@/lib/email/resend";
import {
  facilityConfirmLink,
  resolveRentalEmailSiteUrl,
} from "@/lib/rentals/rental-site-url";
import { rateLimit } from "@/lib/rate-limit";
import { FACILITY_AVAILABILITY_BLOCKING_STATUSES } from "@/lib/facility-parties/availability-source";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  FACILITY_TIME_ZONE,
  facilityLocalDateTimeToUtc,
} from "@/lib/facility-parties/zoned-time";
import { formatMinutesLabel } from "@/lib/facility-parties/time";
import {
  initializeBookingWorkflow,
  recordWorkflowOutcome,
} from "@/lib/bookings/workflow-state";
import { sendBookingOperationalAlert } from "@/lib/bookings/operational-alert";
import { sendDurableBookingEmail } from "@/lib/bookings/durable-email";
import {
  invitationSnapshotFromChoice,
  facilityInvitationShareUrl,
} from "@/lib/facility-parties/invitations/snapshot";

const FACILITY_BOOKING_HORIZON_ERROR =
  "Facility party requests are available from today through December 31, 2027.";

function getFacilityDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FACILITY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
    minutes: Number(getPart("hour")) * 60 + Number(getPart("minute")),
  };
}

function isFacilityRoomId(value: string): value is FacilityRoomId {
  return value === "room-10" || value === "room-20";
}

function isPrivateDuration(value: number): value is PrivateDurationMinutes {
  return value === 90 || value === 120 || value === 180;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidEmail(value: unknown): value is string {
  return isNonEmptyString(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildAbsoluteAdminInvitationLink(
  siteUrl: string,
  bookingId: string,
): string {
  const url = new URL(
    `/admin/facility/${encodeURIComponent(bookingId)}/invitations`,
    `${siteUrl.replace(/\/+$/, "")}/`,
  );
  return url.toString();
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    scope: "facility-booking",
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
    return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
  }

  try {
    const body = await req.json();

    const {
      party_kind,
      room,
      booking_date,
      start_minutes,
      end_minutes,
      customer_name,
      email,
      phone,
      parent_name,
      child_name,
      child_gender,
      child_age,
      party_theme,
      invitation_option_index,
      invitation_alternates_used,
      balloon_colors,
      table_cloth_colors,
      drink_choice,
      payment_method,
      invitation_delivery_preference,
      invitation_creation_preference,
      invitation_template_id,
      deposit_acknowledged,
      notes,
      addon_selections,
      idempotency_key,
    } = body;

    if (!isFacilityBookingYmdWithinHorizon(booking_date, new Date())) {
      return NextResponse.json(
        { error: FACILITY_BOOKING_HORIZON_ERROR },
        { status: 400 },
      );
    }

    const resolvedAddons = resolveFacilityAddons(addon_selections);
    const storedAddons = facilityAddonsForStorage(resolvedAddons);
    const addonsEmailText = formatFacilityAddonsForEmail(resolvedAddons);
    const invitationPreference = normalizeInvitationDeliveryPreference(
      invitation_delivery_preference,
    );
    const invitationCreationPreference = normalizeInvitationCreationPreference(
      invitation_creation_preference,
    );
    const invitationTemplateId = normalizeInvitationTemplateId(
      invitation_template_id,
    );
    const invitationPreferenceLabel =
      invitationDeliveryPreferenceLabel(invitationPreference);
    const invitationTemplateName = invitationTemplateLabel(invitationTemplateId);
    const bookingContactName = isNonEmptyString(parent_name)
      ? parent_name.trim()
      : isNonEmptyString(customer_name)
        ? customer_name.trim()
        : "";

    if (
      (party_kind !== "public" && party_kind !== "private") ||
      typeof room !== "string" ||
      !isNonEmptyString(booking_date) ||
      !Number.isInteger(start_minutes) ||
      !Number.isInteger(end_minutes) ||
      start_minutes < 0 ||
      end_minutes > 24 * 60 ||
      !isNonEmptyString(idempotency_key) ||
      idempotency_key.length > 128
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (
      !bookingContactName ||
      !isValidEmail(email) ||
      !isNonEmptyString(phone) ||
      !isNonEmptyString(child_name) ||
      !isNonEmptyString(child_gender) ||
      !isNonEmptyString(child_age) ||
      !isNonEmptyString(drink_choice) ||
      !isNonEmptyString(payment_method) ||
      bookingContactName.length > 120 ||
      email.length > 254 ||
      phone.length > 40 ||
      String(notes ?? "").length > 2000
    ) {
      return NextResponse.json(
        { error: "Missing or invalid customer booking fields" },
        { status: 400 },
      );
    }

    const startDate = facilityLocalDateTimeToUtc(booking_date, start_minutes);
    const endDate = facilityLocalDateTimeToUtc(booking_date, end_minutes);
    if (
      !startDate ||
      !endDate ||
      startDate >= endDate
    ) {
      return NextResponse.json(
        { error: "Invalid booking window" },
        { status: 400 },
      );
    }

    const facilityOwnerEmails = getFacilityOwnerEmails();
    const siteUrl = resolveRentalEmailSiteUrl(req.url);

    const supabase = createServiceRoleClient();
    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();
    const startParts = getFacilityDateParts(startDate);
    const durationMinutes = (endDate.getTime() - startDate.getTime()) / 60000;
    const siteSettings = await loadSiteSettings();
    const pricing = priceFacilityPartyWithConfig(
      {
        partyKind: party_kind,
        roomId: room as FacilityRoomId,
        date: startParts.date,
        durationMinutes,
        addonSubtotal: resolvedAddons.subtotal,
      },
      siteSettings.facilityPricing,
    );

    if (pricing.missingPrice) {
      return NextResponse.json(
        { error: "Facility pricing is not configured for this party option" },
        { status: 400 },
      );
    }

    const pricingLines = formatFacilityPricingLines(pricing);
    const storedReadableDate = booking_date;
    const storedReadableTime = `${formatMinutesLabel(start_minutes)} - ${formatMinutesLabel(end_minutes)}`;
    const storedPartyLabel = party_kind === "private" ? "Private Party" : "Public Play Party";

    if (party_kind === "public") {
      if (!isFacilityRoomId(room)) {
        return NextResponse.json(
          { error: "Invalid public booking room" },
          { status: 400 },
        );
      }

      const validPublicSlot = listPublicSaturdaySlotDispositions(
        startParts.date,
        room,
        [],
      ).some(
        (slot) =>
          slot.startMinutes === startParts.minutes &&
          slot.endMinutes - slot.startMinutes === durationMinutes,
      );

      if (!validPublicSlot) {
        return NextResponse.json(
          { error: "Invalid public booking window" },
          { status: 400 },
        );
      }

      const bufferedStartIso = new Date(
        startDate.getTime() - FACILITY_PARTY_BUFFER_MINUTES * 60 * 1000,
      ).toISOString();
      const bufferedEndIso = new Date(
        endDate.getTime() + FACILITY_PARTY_BUFFER_MINUTES * 60 * 1000,
      ).toISOString();
      const { data: conflicts, error: conflictError } = await supabase
        .from("facility_bookings")
        .select("id,party_kind,room,start_time,end_time")
        .in("status", [...FACILITY_AVAILABILITY_BLOCKING_STATUSES])
        .lt("start_time", bufferedEndIso)
        .gt("end_time", bufferedStartIso);

      if (conflictError) {
        return NextResponse.json(
          { error: "Unable to verify facility availability" },
          { status: 503 },
        );
      }

      const hasConflict = (conflicts ?? []).some((booking) => {
        if (booking.party_kind === "private") return true;
        return (
          booking.room === room &&
          new Date(booking.start_time).getTime() < endDate.getTime() &&
          new Date(booking.end_time).getTime() > startDate.getTime()
        );
      });
      if (hasConflict) {
        return NextResponse.json(
          { error: "Booking window is unavailable" },
          { status: 409 },
        );
      }
    }

    if (party_kind === "private") {
      if (room !== "room-20" || !isPrivateDuration(durationMinutes)) {
        return NextResponse.json(
          { error: "Invalid private booking window" },
          { status: 400 },
        );
      }

      const validPrivateSlot = listPrivateSlotDispositions(
        startParts.date,
        durationMinutes,
        [],
      ).some((slot) => slot.startMinutes === startParts.minutes);

      if (!validPrivateSlot) {
        return NextResponse.json(
          { error: "Invalid private booking window" },
          { status: 400 },
        );
      }

      const bufferedStartIso = new Date(
        startDate.getTime() - FACILITY_PARTY_BUFFER_MINUTES * 60 * 1000,
      ).toISOString();
      const bufferedEndIso = new Date(
        endDate.getTime() + FACILITY_PARTY_BUFFER_MINUTES * 60 * 1000,
      ).toISOString();

      const { data: conflicts, error: conflictError } = await supabase
        .from("facility_bookings")
        .select("id")
        .in("status", [...FACILITY_AVAILABILITY_BLOCKING_STATUSES])
        .lt("start_time", bufferedEndIso)
        .gt("end_time", bufferedStartIso)
        .limit(1);

      if (conflictError) {
        return NextResponse.json(
          { error: "Unable to verify facility availability" },
          { status: 503 },
        );
      }

      if (conflicts && conflicts.length > 0) {
        return NextResponse.json(
          { error: "Booking window is unavailable" },
          { status: 409 },
        );
      }
    }

    const bookingData = {
          party_kind,
          room,
          start_time: startIso,
          end_time: endIso,
          customer_name: bookingContactName,
          email,
          phone,
          parent_name: bookingContactName,
          child_name: String(child_name).trim(),
          child_gender: String(child_gender).trim(),
          child_age: String(child_age).trim(),
          party_theme: String(party_theme ?? "").trim(),
          invitation: {
            ...invitationSnapshotFromChoice(
              String(party_theme ?? ""),
              invitation_option_index,
              invitation_alternates_used,
            ),
            ...(invitationCreationPreference
              ? { creationPreference: invitationCreationPreference }
              : {}),
            deliveryPreference: invitationPreference,
          },
          balloon_colors: String(balloon_colors).trim(),
          table_cloth_colors: String(table_cloth_colors).trim(),
          drink_choice: String(drink_choice).trim(),
          payment_method: String(payment_method).trim(),
          invitation_delivery_preference: invitationPreference,
          invitation_template_id: invitationTemplateId,
          deposit_acknowledged: deposit_acknowledged === true,
          notes,
          readable_date: storedReadableDate,
          readable_time: storedReadableTime,
          party_label: storedPartyLabel,
          addon_selections: storedAddons,
          facility_package_price: pricing.packagePrice,
          addon_subtotal: pricing.addonSubtotal,
          subtotal: pricing.subtotal,
          tax: pricing.tax,
          total: pricing.total,
          pricing_details: {
            taxRate: pricing.taxRate,
            source: "facility-party-price-sheet",
          },
        };
    const { data, error } = await supabase.rpc("create_facility_booking_atomic", {
      p_booking: bookingData,
      p_idempotency_key: idempotency_key.trim(),
    });

    if (error) {
      if (error.message?.includes("booking_conflict")) {
        return NextResponse.json(
          { error: "Booking window is unavailable" },
          { status: 409 },
        );
      }
      console.error("[facility] atomic booking RPC failed", {
        code: error.code,
        details: error.details,
      });
      return NextResponse.json(
        { error: "Unable to save facility booking" },
        { status: 503 },
      );
    }
    const bookingId = typeof data === "string" ? data : "";
    if (!bookingId) {
      return NextResponse.json(
        { error: "Unable to save facility booking" },
        { status: 503 },
      );
    }
    const { error: invitationUpdateError } = await supabase
      .from("facility_bookings")
      .update({
        invitation_delivery_preference: invitationPreference,
        invitation_template_id: invitationTemplateId,
      })
      .eq("id", bookingId);
    if (invitationUpdateError) {
      console.error("[facility] invitation choice update failed", {
        code: invitationUpdateError.code,
      });
    }
    await initializeBookingWorkflow(supabase, "facility", bookingId);

    let emailsSent = false;
    let ownerNotificationFailed = facilityOwnerEmails.length === 0;
    let ownerNotificationSent = false;
    let customerReceiptFailed = false;

    try {
      const confirmLink = siteUrl
        ? facilityConfirmLink(siteUrl, bookingId, "confirm")
        : "Unavailable - use the authenticated admin dashboard";
      const rejectLink = siteUrl
        ? facilityConfirmLink(siteUrl, bookingId, "reject")
        : "Unavailable - use the authenticated admin dashboard";
      const waiverInvitationLink = buildFacilityWaiverInvitationUrl({
        siteUrl,
        bookingId,
        partyDate: storedReadableDate,
      });
      const adminInvitationLink = buildAbsoluteAdminInvitationLink(
        siteUrl,
        bookingId,
      );

      const adminEmailText = [
        "New facility booking request",
        "",
        `Booking ID: ${bookingId}`,
        `Customer: ${bookingContactName}`,
        `Parent name: ${bookingContactName}`,
        `Email: ${email}`,
        `Phone: ${phone}`,
        `Child name: ${String(child_name).trim()}`,
        `Child gender: ${String(child_gender).trim()}`,
        `Child age: ${String(child_age).trim()}`,
        `Party theme: ${String(party_theme).trim()}`,
        `Invitations: ${invitationPreferenceLabel}`,
        `Invitation design: ${invitationTemplateName}`,
        `Balloon colors: ${String(balloon_colors).trim()}`,
        `Table cloth colors: ${String(table_cloth_colors).trim()}`,
        `Drink choice: ${String(drink_choice).trim()}`,
        `Payment method: ${String(payment_method).trim()}`,
        `Deposit acknowledgement: ${
          deposit_acknowledged === true ? "Checked" : "Not checked"
        }`,
        `Party: ${storedPartyLabel}`,
        `Date: ${storedReadableDate}`,
        `Time: ${storedReadableTime}`,
        `Party kind: ${party_kind}`,
        `Room: ${room}`,
        `Start time: ${startIso}`,
        `End time: ${endIso}`,
        notes?.trim() ? `Notes: ${String(notes).trim()}` : "Notes: (none)",
        "",
        addonsEmailText,
        ...pricingLines,
        "",
        `Invitation preview: ${adminInvitationLink}`,
        `Guest waiver link: ${waiverInvitationLink}`,
        `Confirm link: ${confirmLink}`,
        `Reject link: ${rejectLink}`,
      ].join("\n");

      for (const ownerEmail of facilityOwnerEmails) {
        const { error: adminEmailError } = await sendDurableBookingEmail({
          supabase,
          messageKey: `facility-${bookingId}-owner-${ownerEmail}-v1`,
          kind: "facility",
          bookingId,
          purpose: "owner_notification",
          to: ownerEmail,
          subject: "New facility booking request",
          text: adminEmailText,
        });

        if (adminEmailError) {
          ownerNotificationFailed = true;
          console.error("BOOKING EMAIL ERROR", {
            ownerEmail,
            adminEmailError,
          });
        } else {
          ownerNotificationSent = true;
          emailsSent = true;
        }
      }

      const invitationUrl = siteUrl
        ? facilityInvitationShareUrl(siteUrl, bookingId)
        : "";

      const { error: customerEmailError } = await sendDurableBookingEmail({
        supabase,
        messageKey: `facility-${bookingId}-customer-receipt-v1`,
        kind: "facility",
        bookingId,
        purpose: "initial_customer_receipt",
        to: email,
        subject: "Your Jumping Jax facility booking request was received",
        text: [
          `Hi ${bookingContactName},`,
          "",
          "We received your facility booking request. It is waiting for confirmation from Jumping Jax.",
          "",
          `Party: ${storedPartyLabel}`,
          `Date: ${storedReadableDate}`,
          `Time: ${storedReadableTime}`,
          `Parent name: ${bookingContactName}`,
          `Child name: ${String(child_name).trim()}`,
          `Child age: ${String(child_age).trim()}`,
          `Party theme: ${String(party_theme).trim()}`,
          `Invitations: ${invitationPreferenceLabel}`,
          `Invitation design: ${invitationTemplateName}`,
          invitationUrl ? `Invitation: ${invitationUrl}` : null,
          `Drink choice: ${String(drink_choice).trim()}`,
          `Payment method: ${String(payment_method).trim()}`,
          `Deposit: $50 due within one week of making this reservation, paid directly to Jumping Jax.`,
          `Guest waiver link for the party: ${waiverInvitationLink}`,
          "",
          addonsEmailText,
          ...pricingLines,
          "",
          "A second email will be sent once your booking is confirmed.",
        ]
          .filter((line): line is string => line !== null)
          .join("\n"),
      });

      if (customerEmailError) {
        customerReceiptFailed = true;
        console.error("CUSTOMER BOOKING REQUEST EMAIL ERROR", customerEmailError);
      } else {
        emailsSent = true;
      }
    } catch (emailError) {
      customerReceiptFailed = true;
      ownerNotificationFailed = true;
      console.error("BOOKING EMAIL ERROR", emailError);
    }

    await recordWorkflowOutcome({
      supabase,
      kind: "facility",
      bookingId,
      step: "initial_customer_email",
      outcome: customerReceiptFailed ? "failed" : "sent",
      safeErrorClass: customerReceiptFailed ? "email_delivery_failed" : undefined,
    });
    await recordWorkflowOutcome({
      supabase,
      kind: "facility",
      bookingId,
      step: "owner_notification",
      outcome: ownerNotificationFailed || !ownerNotificationSent ? "failed" : "sent",
      safeErrorClass:
        ownerNotificationFailed || !ownerNotificationSent
          ? "owner_notification_failed"
          : undefined,
    });
    if (customerReceiptFailed) {
      await sendBookingOperationalAlert({
        kind: "facility",
        bookingId,
        step: "initial_customer_email",
        safeErrorClass: "email_delivery_failed",
      });
    }
    if (ownerNotificationFailed || !ownerNotificationSent) {
      await sendBookingOperationalAlert({
        kind: "facility",
        bookingId,
        step: "owner_notification",
        safeErrorClass: "owner_notification_failed",
      });
    }

    return NextResponse.json({ success: true, id: bookingId, emailsSent });
  } catch {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 },
    );
  }
}
