import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { FacilityPricingConfig } from "./pricing";

const packagePrice = z.number().finite().nonnegative()
  .refine(value => Math.round(value * 100) / 100 === value);
const pricingSchema = z.object({
  publicRoom10: packagePrice,
  publicRoom20Weekday: packagePrice,
  publicRoom20Weekend: packagePrice,
  privateWeekday90: packagePrice,
  privateWeekday120: packagePrice,
  privateWeekend90: packagePrice,
  privateWeekend120: packagePrice,
  privateAny180: packagePrice,
  taxRate: z.number().min(0).max(1)
    .refine(value => Math.round(value * 10000) / 10000 === value),
}).strict();
const snapshotSchema = z.object({
  pricing: pricingSchema,
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});

export class FacilityPricingUnavailableError extends Error {
  constructor() {
    super("Facility pricing is temporarily unavailable.");
  }
}

export function databaseFacilityPricingEnabled() {
  return process.env.FACILITY_PRICING_DATABASE_ENABLED === "true";
}

export async function readFacilityPricingSnapshot(db: SupabaseClient = createServiceRoleClient()) {
  const { data, error } = await db.from("facility_pricing_settings")
    .select("pricing,revision").eq("singleton", true).maybeSingle();
  const snapshot = snapshotSchema.safeParse(data);
  if (error || !snapshot.success) throw new FacilityPricingUnavailableError();
  return snapshot.data;
}

export async function saveFacilityPricingSnapshot(
  db: SupabaseClient,
  pricing: FacilityPricingConfig,
  revision: number,
) {
  if (!pricingSchema.safeParse(pricing).success) throw new FacilityPricingUnavailableError();
  const { data, error } = await db.rpc("update_facility_pricing_settings", {
    p_pricing: pricing,
    p_expected_revision: revision,
  });
  if (error) throw new FacilityPricingUnavailableError();
  if (data !== true) throw new Error("Facility pricing changed. Reload the settings and try again.");
}
