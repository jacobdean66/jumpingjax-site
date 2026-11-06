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

// Bind the price used for a write to one unchanged storage version. The
// corresponding database transaction locks and rechecks that version.
export async function loadSavedFacilitySettingsForWrite(): Promise<{value:ReceptionistFacilityPricing;version:string}> {
  if (!isSupabaseServiceConfigured() || databaseFacilityPricingEnabled()) throw new Error("Unavailable");
  const supabase=createServiceRoleClient();
  const version=async()=>{
    const {data,error}=await supabase.rpc("receptionist_facility_settings_version_v1");
    if(error||typeof data!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data))throw new Error("Unavailable");
    return data;
  };
  const before=await version();
  const {data,error}=await supabase.storage.from("site-settings").download("public-settings.json",{cacheNonce:randomUUID()},{cache:"no-store"});
  if(error||!data||data.size>1_000_000)throw new Error("Unavailable");
  const value={pricing:verifiedFacilityPricing(JSON.parse(await data.text()))},after=await version();
  if(before!==after)throw new Error("Unavailable");
  return {value,version:before};
}
