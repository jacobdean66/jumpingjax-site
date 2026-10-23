import { createServiceRoleClient } from "@/lib/supabase/admin";
import { personalGoogleCode, type GoogleOfferKind } from "./customer-offer";

export async function validateCustomerOffer(
  code: unknown,
  email: string,
  kind: GoogleOfferKind,
  requestKey?: string,
) {
  const normalized = personalGoogleCode(code);
  if (!normalized)
    throw new Error(
      "Claim your personal Google code using your booking email first.",
    );
  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("google_customer_offers")
    .select("id,email,kind")
    .eq("code", normalized)
    .maybeSingle();
  if (error)
    throw new Error("Google offers could not be checked. Please retry.");
  if (!data || data.email !== email.trim().toLowerCase() || data.kind !== kind)
    throw new Error(
      "Use the email and booking type you claimed this code for.",
    );
  const active = await db
    .from("google_offer_redemptions")
    .select("request_key,status")
    .eq("offer_id", data.id)
    .neq("status", "released");
  if (active.error)
    throw new Error("Google offers could not be checked. Please retry.");
  if (active.data?.some((row) => row.request_key !== requestKey))
    throw new Error(
      "This Google offer is already attached to another booking.",
    );
  return normalized;
}

export type SavedGoogleOffer = {
  code: string;
  discount: number;
  status: string;
};
export async function loadBookingGoogleOffers(
  kind: GoogleOfferKind,
  ids: string[],
) {
  const result = new Map<string, SavedGoogleOffer>();
  if (!ids.length) return result;
  const { data, error } = await createServiceRoleClient()
    .from("google_offer_redemptions")
    .select("booking_id,discount,status,google_customer_offers(code)")
    .eq("kind", kind)
    .in("booking_id", ids);
  if (error) throw new Error("Saved Google offers could not load.");
  for (const row of data ?? []) {
    const offer = row.google_customer_offers as unknown as { code: string };
    result.set(row.booking_id, {
      code: offer.code,
      discount: Number(row.discount),
      status: row.status,
    });
  }
  return result;
}
