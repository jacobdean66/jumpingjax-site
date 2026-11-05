import type { SupabaseClient } from "@supabase/supabase-js";
import { sendDurableBookingEmail } from "@/lib/bookings/durable-email";
import { sendBookingOperationalAlert } from "@/lib/bookings/operational-alert";
import { initializeBookingWorkflow, recordWorkflowOutcome } from "@/lib/bookings/workflow-state";
import { facilityConfirmLink } from "@/lib/rentals/rental-site-url";
import { buildHostGuestListUrl } from "./host-guest-list";
import { buildFacilityWaiverInvitationUrl } from "./invitations";
import { buildCustomerInvitationEmailSection } from "./invitations/content";
import { buildOptionalInvitationEmailHtml } from "./invitations/email-html";
import { facilityInvitationShareUrl, facilityInvitationSheetShareUrl, type InvitationSnapshot } from "./invitations/snapshot";

type FacilityBookingNotifications = {
  supabase: SupabaseClient;
  bookingId: string;
  facilityOwnerEmails: string[];
  siteUrl: string;
  bookingContactName: string;
  email: string;
  phone: string;
  child_name?: string | null;
  child_gender?: string | null;
  child_age?: string | null;
  party_theme?: string | null;
  balloon_colors?: string | null;
  table_cloth_colors?: string | null;
  drink_choice?: string | null;
  payment_method?: string | null;
  deposit_acknowledged?: boolean;
  notes?: string | null;
  party_kind: "public" | "private";
  room: string;
  startIso: string;
  endIso: string;
  storedReadableDate: string;
  storedReadableTime: string;
  storedPartyLabel: string;
  addonsEmailText: string;
  pricingLines: string[];
  total: number;
  invitationPreferenceLabel: string;
  invitationTemplateName: string;
  invitationQuantity: number;
  invitationCreationPreference: unknown;
  invitationSnapshot: InvitationSnapshot;
};

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

/** Initial pending-booking messages. This helper never creates a booking. */
export async function sendFacilityBookingNotifications({
  supabase, bookingId, facilityOwnerEmails, siteUrl, bookingContactName, email, phone,
  child_name, child_gender, child_age, party_theme, balloon_colors, table_cloth_colors,
  drink_choice, payment_method, deposit_acknowledged, notes, party_kind, room, startIso, endIso,
  storedReadableDate, storedReadableTime, storedPartyLabel, addonsEmailText, pricingLines, total,
  invitationPreferenceLabel, invitationTemplateName, invitationQuantity, invitationCreationPreference, invitationSnapshot,
}: FacilityBookingNotifications) {
  await initializeBookingWorkflow(supabase, "facility", bookingId);

  let emailsSent = false;
  let ownerNotificationFailed = facilityOwnerEmails.length === 0;
  let ownerNotificationSent = false;
  let customerReceiptFailed = false;
  const waiverInvitationLink = buildFacilityWaiverInvitationUrl({
    siteUrl, bookingId, partyDate: storedReadableDate,
  });

  try {
    const confirmLink = siteUrl
      ? facilityConfirmLink(siteUrl, bookingId, "confirm")
      : "Unavailable - use the authenticated admin dashboard";
    const rejectLink = siteUrl
      ? facilityConfirmLink(siteUrl, bookingId, "reject")
      : "Unavailable - use the authenticated admin dashboard";
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
      `Child name: ${String(child_name ?? "").trim()}`,
      `Child gender: ${String(child_gender ?? "").trim()}`,
      `Child age: ${String(child_age ?? "").trim()}`,
      `Party theme: ${String(party_theme ?? "").trim()}`,
      `Invitations: ${invitationPreferenceLabel}`,
      `Invitation design: ${invitationTemplateName}`,
      `Invitation quantity: ${invitationQuantity}`,
      `Balloon colors: ${String(balloon_colors ?? "").trim()}`,
      `Table cloth colors: ${String(table_cloth_colors ?? "").trim()}`,
      `Drink choice: ${String(drink_choice ?? "").trim()}`,
      `Payment method: ${String(payment_method ?? "").trim()}`,
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
  } catch (emailError) {
    ownerNotificationFailed = true;
    console.error("OWNER BOOKING EMAIL ERROR", emailError);
  }

  try {
    const invitationUrl = siteUrl
      ? facilityInvitationShareUrl(siteUrl, bookingId)
      : "";
    const printableInvitationUrl = siteUrl
      ? facilityInvitationSheetShareUrl(siteUrl, bookingId)
      : "";
    const invitationEmailSection = invitationCreationPreference === "create"
      ? buildCustomerInvitationEmailSection({
          childName: String(child_name ?? "").trim(),
          childAge: String(child_age ?? "").trim(),
          customerPhone: String(phone).trim(),
          dateLabel: storedReadableDate,
          timeLabel: storedReadableTime,
          themeText: String(party_theme ?? "").trim(),
          invitationUrl,
          printableUrl: printableInvitationUrl,
          waiverUrl: waiverInvitationLink,
        })
      : ["We can call or email you to finish your party details and invitations."];

    const hostGuestListUrl = buildHostGuestListUrl(siteUrl, bookingId);
    const customerEmailText = [
      `Hi ${bookingContactName},`,
      "",
      "We received your facility booking request. It is waiting for confirmation from Jumping Jax.",
      `View your party guest list: ${hostGuestListUrl}`,
      "Keep this host link for yourself. Your guest list is available now, even before you choose invitations. Guests can RSVP once your party is confirmed.",
      "",
      `Party: ${storedPartyLabel}`,
      `Date: ${storedReadableDate}`,
      `Time: ${storedReadableTime}`,
      `Invitations: ${invitationPreferenceLabel}`,
      `Invitation design: ${invitationTemplateName}`,
      `Invitation quantity: ${invitationQuantity}`,
      `Drink choice: ${String(drink_choice ?? "").trim()}`,
      `Payment method: ${String(payment_method ?? "").trim()}`,
      total === 0 ? "This party is free. No deposit or payment is due." : `Deposit: $50 due within one week of making this reservation, paid directly to Jumping Jax.`,
      "",
      ...invitationEmailSection,
      "",
      addonsEmailText,
      ...pricingLines,
      "",
      "A second email will be sent once your booking is confirmed.",
    ]
      .filter((line): line is string => line !== null)
      .join("\n");
    const invitationEmailHtml = invitationCreationPreference === "create"
      ? buildOptionalInvitationEmailHtml({
          snapshot: invitationSnapshot,
          siteUrl,
          plainText: customerEmailText,
          childName: String(child_name ?? "").trim(),
          childAge: String(child_age ?? "").trim(),
          customerPhone: String(phone).trim(),
          dateLabel: storedReadableDate,
          timeLabel: storedReadableTime,
          themeText: String(party_theme ?? "").trim(),
          invitationUrl,
          printableUrl: printableInvitationUrl,
          waiverUrl: waiverInvitationLink,
        })
      : undefined;
    const safeHostUrl = hostGuestListUrl.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
    const hostEmailSection = `<p style="font-family:Arial,sans-serif"><a href="${safeHostUrl}" style="display:inline-block;padding:12px 18px;background:#0369a1;color:white;border-radius:12px;text-decoration:none;font-weight:bold">View your party guest list</a><br>Keep this host link for yourself. You can view your list before choosing invitations.</p>`;
    const receiptInvitationHtml = invitationEmailHtml?.replace("Forward this email or use", "Use");
    const customerEmailHtml = receiptInvitationHtml
      ? receiptInvitationHtml.includes("</body>")
        ? receiptInvitationHtml.replace("</body>", `${hostEmailSection}</body>`)
        : receiptInvitationHtml + hostEmailSection
      : hostEmailSection + `<div style="font-family:Arial,sans-serif;white-space:pre-line">${customerEmailText.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</div>`;

    const { error: customerEmailError } = await sendDurableBookingEmail({
      supabase,
      messageKey: `facility-${bookingId}-customer-receipt-v1`,
      kind: "facility",
      bookingId,
      purpose: "initial_customer_receipt",
      to: email,
      subject: "Your Jumping Jax facility booking request was received",
      text: customerEmailText,
      html: customerEmailHtml,
    });

    if (customerEmailError) {
      customerReceiptFailed = true;
      console.error("CUSTOMER BOOKING REQUEST EMAIL ERROR", customerEmailError);
    } else {
      emailsSent = true;
    }
  } catch (emailError) {
    customerReceiptFailed = true;
    console.error("CUSTOMER BOOKING EMAIL ERROR", emailError);
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

  return {
    emailsSent,
    customerReceiptAccepted: !customerReceiptFailed,
    ownerNotificationAccepted: ownerNotificationSent && !ownerNotificationFailed,
  };
}
