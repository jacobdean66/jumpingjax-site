import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { loadSavedFacilityPricing } from "@/lib/admin/site-settings";
import { isValidEmailAddress } from "@/lib/email/address";
import { facilityAddonsForStorage, resolveFacilityAddons } from "../addons";
import { evaluateCustomerFacingFacilitySlot } from "../availability-source";
import { CHILD_GENDER_CHOICES, FACILITY_DRINK_CHOICES, PAYMENT_METHOD_CHOICES } from "../booking-choices";
import { isFacilityBookingYmdWithinHorizon } from "../booking-horizon";
import { normalizeInvitationTemplateId } from "../invitations";
import { priceFacilityPartyWithConfig } from "../pricing";
import { formatMinutesLabel } from "../time";
import { facilityLocalDateTimeToUtc } from "../zoned-time";
import { assertConfirmedArtworkAvailable } from "./booking-evidence";
import { invitationSnapshotFromChoice } from "./snapshot";
import { confirmedThemeSchema } from "./theme-search";

const money = z.number().finite().nonnegative();
const quoteSchema = z.object({
  packagePrice: money, addonSubtotal: money, subtotal: money, tax: money, total: money,
  taxRate: z.number().min(0).max(1),
}).strict();

const approvalSchema = z.object({
  previewId: z.string().uuid(),
  requestKey: z.string().regex(/^[A-Za-z0-9._:-]{16,128}$/),
  customerName: z.string().trim().min(1).max(120),
  email: z.string().trim().max(254).toLowerCase().refine(isValidEmailAddress),
  phone: z.string().trim().min(1).max(40),
  room: z.enum(["room-10", "room-20"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMinutes: z.number().int().min(0).max(1350),
  optionIndex: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  deliveryPreference: z.enum(["print", "email", "office_pickup"]),
  quantity: z.union([z.literal(4), z.literal(8), z.literal(12), z.literal(16), z.literal(20), z.literal(24), z.literal(28)]),
  depositAcknowledged: z.literal(true),
  childGender: z.enum([...CHILD_GENDER_CHOICES, ""]).default(""),
  drinkChoice: z.enum([...FACILITY_DRINK_CHOICES, ""]).default(""),
  paymentMethod: z.enum([...PAYMENT_METHOD_CHOICES, ""]).default(""),
  notes: z.string().trim().max(2000).default(""),
  addons: z.object({
    customBirthdayBalloons: z.boolean(),
    goodieBagsQuantity: z.number().int().min(0).max(100),
    cottonCandyPackage: z.enum(["none", "10_kids", "20_kids"]),
  }).strict(),
  quote: quoteSchema,
}).strict();

export type ApprovedFacilityPreview = z.input<typeof approvalSchema>;

const previewSchema = z.object({
  booking_id: z.string().uuid().nullable(),
  status: z.string(),
  expires_at: z.string(),
  recipient: z.string(),
  customer_phone: z.string(),
  child_name: z.string(),
  child_age: z.string(),
  party_theme: z.string(),
  party_date: z.string(),
  party_time: z.string(),
  balloon_colors: z.string(),
  table_cloth_colors: z.string(),
  confirmed_theme: confirmedThemeSchema,
  selected_option_index: z.number().int().nullable(),
  delivery_preferences: z.array(z.string()).nullable(),
  invitation_quantity: z.number().int().nullable(),
});

export class FacilityPreviewBindingError extends Error {}

/**
 * Internal adapter for a server-authenticated, explicitly approved intent.
 * The caller must establish authorization before supplying an approval, even
 * for retries. The adapter remains disconnected from public routes.
 */
export async function bindApprovedFacilityPreview(db: SupabaseClient, approval: ApprovedFacilityPreview) {
  const parsed = approvalSchema.safeParse(approval);
  if (!parsed.success) throw new FacilityPreviewBindingError("invalid_binding_approval");
  const intent = parsed.data;
  const { data, error } = await db.from("facility_invitation_previews")
    .select("booking_id,status,expires_at,recipient,customer_phone,child_name,child_age,party_theme,party_date,party_time,balloon_colors,table_cloth_colors,confirmed_theme,selected_option_index,delivery_preferences,invitation_quantity")
    .eq("id", intent.previewId).maybeSingle();
  if (error) throw new FacilityPreviewBindingError("preview_unavailable");
  const preview = previewSchema.safeParse(data);
  if (!preview.success) throw new FacilityPreviewBindingError("preview_unavailable");
  const selected = preview.data;
  const endMinutes = intent.startMinutes + 90;
  const start = facilityLocalDateTimeToUtc(intent.date, intent.startMinutes);
  const end = facilityLocalDateTimeToUtc(intent.date, endMinutes);
  const time = `${formatMinutesLabel(intent.startMinutes)} - ${formatMinutesLabel(endMinutes)}`;
  if (!start || !end || end.getTime() - start.getTime() !== 90 * 60000 ||
    selected.party_date !== intent.date || selected.party_time !== time ||
    selected.recipient !== intent.email || selected.customer_phone !== intent.phone ||
    selected.selected_option_index !== intent.optionIndex ||
    !isDeepStrictEqual(selected.delivery_preferences, [intent.deliveryPreference]) ||
    selected.invitation_quantity !== intent.quantity || selected.confirmed_theme.label !== selected.party_theme) {
    throw new FacilityPreviewBindingError("preview_binding_mismatch");
  }

  const addons = resolveFacilityAddons(intent.addons);
  let quote: z.infer<typeof quoteSchema>;
  if (selected.booking_id) {
    // Use the stored monetary values on replay. If a staff edit changed these
    // since the binding, reject and let the authorized caller reconcile.
    const receipt = await db.from("facility_bookings")
      .select("facility_package_price,addon_subtotal,subtotal,tax,total,pricing_details")
      .eq("id", selected.booking_id).maybeSingle();
    if (receipt.error || !receipt.data) throw new FacilityPreviewBindingError("binding_receipt_unavailable");
    const saved = quoteSchema.safeParse({
      packagePrice: receipt.data.facility_package_price,
      addonSubtotal: receipt.data.addon_subtotal,
      subtotal: receipt.data.subtotal,
      tax: receipt.data.tax,
      total: receipt.data.total,
      taxRate: receipt.data.pricing_details?.taxRate,
    });
    if (!saved.success) throw new FacilityPreviewBindingError("binding_receipt_unavailable");
    quote = saved.data;
  } else {
    if (selected.status !== "accepted" || !(Date.parse(selected.expires_at) > Date.now())) {
      throw new FacilityPreviewBindingError("preview_unavailable");
    }
    if (!isFacilityBookingYmdWithinHorizon(intent.date) || start.getTime() <= Date.now() ||
      !evaluateCustomerFacingFacilitySlot({
        query: { date: intent.date, kind: "public", roomId: intent.room, startMinutes: intent.startMinutes, endMinutes },
        blocks: [],
      }).validTemplate) {
      throw new FacilityPreviewBindingError("invalid_booking_slot");
    }
    const { missingPrice, ...currentQuote } = priceFacilityPartyWithConfig({
      partyKind: "public", roomId: intent.room, date: intent.date, durationMinutes: 90, addonSubtotal: addons.subtotal,
    }, await loadSavedFacilityPricing(db, randomUUID()));
    if (missingPrice) throw new FacilityPreviewBindingError("pricing_unavailable");
    quote = currentQuote;
  }
  if (!isDeepStrictEqual(quote, intent.quote)) throw new FacilityPreviewBindingError("approved_price_changed");
  if (!selected.booking_id) await assertConfirmedArtworkAvailable(db, selected.confirmed_theme);

  const snapshot = invitationSnapshotFromChoice(
    selected.party_theme, intent.optionIndex, 0,
    `${selected.balloon_colors} ${selected.table_cloth_colors}`, selected.confirmed_theme,
  );
  const { data: bookingId, error: bindingError } = await db.rpc("bind_facility_invitation_preview_atomic", {
    p_preview_id: intent.previewId,
    p_request_key: intent.requestKey,
    p_booking: {
      party_kind: "public", room: intent.room, start_time: start.toISOString(), end_time: end.toISOString(),
      customer_name: intent.customerName, parent_name: intent.customerName, email: intent.email, phone: intent.phone,
      child_name: selected.child_name, child_age: selected.child_age, child_gender: intent.childGender,
      party_theme: selected.party_theme,
      drink_choice: intent.drinkChoice, payment_method: intent.paymentMethod, notes: intent.notes,
      balloon_colors: selected.balloon_colors, table_cloth_colors: selected.table_cloth_colors,
      invitation: { ...snapshot, creationPreference: "create", deliveryPreference: intent.deliveryPreference },
      invitation_delivery_preference: intent.deliveryPreference,
      invitation_template_id: normalizeInvitationTemplateId(undefined),
      invitation_quantity: intent.quantity,
      deposit_acknowledged: intent.depositAcknowledged, party_label: "Public Play Party",
      addon_selections: facilityAddonsForStorage(addons),
      facility_package_price: quote.packagePrice, addon_subtotal: quote.addonSubtotal, subtotal: quote.subtotal,
      tax: quote.tax, total: quote.total, pricing_details: { taxRate: quote.taxRate, source: "facility-party-price-sheet" },
    },
  });
  const result = z.string().uuid().safeParse(bookingId);
  if (bindingError || !result.success) {
    const code = bindingError?.message ?? "";
    const conflict = ["preview_binding_conflict", "preview_binding_mismatch", "booking_conflict"].includes(code);
    throw new FacilityPreviewBindingError(conflict ? code : "binding_unavailable");
  }
  return { bookingId: result.data };
}
