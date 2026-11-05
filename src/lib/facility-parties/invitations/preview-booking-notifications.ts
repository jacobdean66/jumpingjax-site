import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isValidEmailAddress } from "@/lib/email/address";
import { getFacilityOwnerEmails } from "@/lib/email/resend";
import { CANONICAL_PRODUCTION_SITE_URL } from "@/lib/site-url";
import { formatStoredFacilityAddons } from "../addons";
import { sendFacilityBookingNotifications } from "../booking-notifications";
import { formatInvitationDeliveryPreferences, normalizeInvitationDeliveryPreferences } from "../invitations";
import { formatFacilityPricingLines } from "../pricing";
import { options, previewEnabled } from "../preview-email";
import { bindApprovedFacilityPreview, type ApprovedFacilityPreview } from "./preview-binding";
import { isInvitationSnapshot } from "./snapshot";
import { confirmedThemeSchema } from "./theme-search";

const contact = z.string().trim().min(1);
const optional = z.string().nullable();
const money = z.number().nonnegative();
const uuid = z.uuid();

const claimSchema = z.discriminatedUnion("status", [
  z.object({ status: z.enum(["pending", "provider-accepted", "requires-staff", "unavailable"]) }),
  z.object({
    status: z.literal("claimed"),
    owners: z.array(z.string().refine(isValidEmailAddress)).min(1).max(20),
    booking: z.object({
      customer_name: contact, email: z.string().refine(isValidEmailAddress), phone: contact,
      child_name: optional, child_gender: optional, child_age: optional, party_theme: contact,
      balloon_colors: optional, table_cloth_colors: optional, drink_choice: optional, payment_method: optional,
      deposit_acknowledged: z.literal(true), notes: optional, party_kind: z.literal("public"),
      room: z.enum(["room-10", "room-20"]), start_time: z.iso.datetime({ offset: true }), end_time: z.iso.datetime({ offset: true }),
      readable_date: z.iso.date(), readable_time: contact, party_label: contact, addon_selections: z.unknown(),
      facility_package_price: money, addon_subtotal: money, subtotal: money, tax: money, total: money,
      tax_rate: z.number().min(0).max(1), invitation: z.unknown(), invitation_delivery_preference: contact,
      invitation_quantity: z.number().int().min(4).max(28).multipleOf(4),
      preview_option_index: z.number().int().min(0).max(2),
    }),
  }),
]);

export type PreviewBookingNotificationStatus = {
  status: "disabled" | "pending" | "provider-accepted" | "requires-staff";
  customerReceiptAccepted?: boolean;
  ownerNotificationAccepted?: boolean;
};

/** Runs only after the trusted caller has authorized this saved preview booking. */
export async function deliverSavedPreviewBookingNotifications(
  db: SupabaseClient,
  previewId: string,
  bookingId: string,
): Promise<PreviewBookingNotificationStatus> {
  if (!previewEnabled()) return { status: "disabled" };
  if (!uuid.safeParse(previewId).success || !uuid.safeParse(bookingId).success) return { status: "requires-staff" };

  const lease = randomUUID();
  let releaseLease = false;
  try {
    const { data, error } = await db.rpc("claim_facility_preview_notifications", {
      p_preview_id: previewId, p_booking_id: bookingId, p_lease_id: lease, p_owner_recipients: getFacilityOwnerEmails(),
    });
    if (error) return { status: "requires-staff" };
    releaseLease = data?.status === "claimed";
    const claim = claimSchema.safeParse(data);
    if (!claim.success) return { status: "requires-staff" };
    if (claim.data.status !== "claimed") {
      if (claim.data.status === "provider-accepted") {
        return { status: "provider-accepted", customerReceiptAccepted: true, ownerNotificationAccepted: true };
      }
      return { status: claim.data.status === "pending" ? "pending" : "requires-staff" };
    }

    const { booking, owners } = claim.data;
    const snapshot = booking.invitation;
    const layout = options.find(option => option.optionIndex === booking.preview_option_index);
    const delivery = normalizeInvitationDeliveryPreferences(booking.invitation_delivery_preference);
    if (!isInvitationSnapshot(snapshot) || !layout || snapshot.optionIndex !== layout.optionIndex ||
      snapshot.sourceText !== booking.party_theme || !delivery.length ||
      !confirmedThemeSchema.safeParse(snapshot.confirmedTheme).success ||
      snapshot.confirmedTheme?.label !== booking.party_theme) {
      return { status: "requires-staff" };
    }

    const outcome = await sendFacilityBookingNotifications({
      ...booking,
      supabase: db, bookingId, facilityOwnerEmails: owners, siteUrl: CANONICAL_PRODUCTION_SITE_URL,
      bookingContactName: booking.customer_name,
      startIso: booking.start_time, endIso: booking.end_time,
      storedReadableDate: booking.readable_date, storedReadableTime: booking.readable_time, storedPartyLabel: booking.party_label,
      addonsEmailText: formatStoredFacilityAddons(booking.addon_selections),
      pricingLines: formatFacilityPricingLines({
        packagePrice: booking.facility_package_price, addonSubtotal: booking.addon_subtotal,
        subtotal: booking.subtotal, tax: booking.tax, total: booking.total, taxRate: booking.tax_rate, missingPrice: null,
      }),
      invitationPreferenceLabel: formatInvitationDeliveryPreferences(delivery),
      invitationTemplateName: layout.label, invitationQuantity: booking.invitation_quantity,
      invitationCreationPreference: "create", invitationSnapshot: snapshot,
    });
    const { customerReceiptAccepted, ownerNotificationAccepted } = outcome;
    return {
      status: customerReceiptAccepted && ownerNotificationAccepted ? "provider-accepted" : "requires-staff",
      customerReceiptAccepted,
      ownerNotificationAccepted,
    };
  } catch {
    return { status: "requires-staff" };
  } finally {
    if (releaseLease) {
      try {
        await db.from("facility_invitation_previews")
          .update({ notification_lease_id: null, notification_lease_until: null })
          .eq("id", previewId).eq("booking_id", bookingId).eq("notification_lease_id", lease);
      } catch {
        // The lease expires automatically. Do not obscure an existing booking.
      }
    }
  }
}

/** Dormant orchestration. The caller must first establish and record final approval. */
export async function bindApprovedFacilityPreviewAndNotify(db: SupabaseClient, approval: ApprovedFacilityPreview) {
  if (!previewEnabled()) throw new Error("preview_booking_unavailable");
  const { bookingId } = await bindApprovedFacilityPreview(db, approval);
  const notifications = await deliverSavedPreviewBookingNotifications(db, approval.previewId, bookingId);
  return { bookingId, notifications };
}
