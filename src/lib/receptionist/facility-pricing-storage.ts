import { createServiceRoleClient, isSupabaseServiceConfigured } from "@/lib/supabase/admin";
import { databaseFacilityPricingEnabled, readFacilityPricingSnapshot } from "@/lib/facility-parties/saved-pricing";
import { randomUUID } from "node:crypto";
import { verifiedFacilityPricing, type ReceptionistFacilityPricing } from "./facility-pricing";

/** Load saved pricing without the website's default-on-error fallback. */
export async function loadReceptionistFacilityPricing(): Promise<ReceptionistFacilityPricing> {
  if (!isSupabaseServiceConfigured()) throw new Error("Unavailable");
  if (databaseFacilityPricingEnabled()) return readFacilityPricingSnapshot();
  const { data, error } = await createServiceRoleClient().storage.from("site-settings").download("public-settings.json", { cacheNonce: randomUUID() }, { cache: "no-store" });
  if (error || !data || data.size > 1_000_000) throw new Error("Unavailable");
  return { pricing: verifiedFacilityPricing(JSON.parse(await data.text())) };
}
