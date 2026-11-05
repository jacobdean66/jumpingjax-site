import type { FacilityPricingConfig } from "../facility-parties/pricing";

export type ReceptionistFacilityPricing = {
  pricing: FacilityPricingConfig;
  revision?: number;
};

const priceKeys = [
  "publicRoom10", "publicRoom20Weekday", "publicRoom20Weekend",
  "privateWeekday90", "privateWeekday120", "privateWeekend90",
  "privateWeekend120", "privateAny180",
] as const;

/** Reject missing or malformed saved values instead of substituting defaults. */
export function verifiedFacilityPricing(input: unknown): FacilityPricingConfig {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Facility pricing unavailable");
  }
  const settings = input as Record<string, unknown>;
  const pricing = settings.facilityPricing;
  if (!pricing || typeof pricing !== "object" || Array.isArray(pricing)) {
    throw new Error("Facility pricing unavailable");
  }
  const fields = pricing as Record<string, unknown>;
  for (const key of priceKeys) {
    const value = fields[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 1_000_000 || Math.abs(Math.round(value * 100) - value * 100) > 0.000001) {
      throw new Error("Facility pricing unavailable");
    }
  }
  if (typeof fields.taxRate !== "number" || !Number.isFinite(fields.taxRate) || fields.taxRate < 0 || fields.taxRate > 1) {
    throw new Error("Facility pricing unavailable");
  }
  return Object.fromEntries([...priceKeys, "taxRate"].map(key => [key, fields[key]])) as FacilityPricingConfig;
}

/** The caller provides a validated pricing snapshot. */
export async function facilityPricingResponse(load: () => Promise<ReceptionistFacilityPricing>): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  try {
    const { pricing } = await load();
    return Response.json({ schemaVersion: 1, pricing }, { headers });
  } catch {
    return Response.json({ error: "Facility pricing is temporarily unavailable." }, { status: 503, headers });
  }
}
