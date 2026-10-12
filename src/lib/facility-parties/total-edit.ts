import type { FacilityPricingResult } from "./pricing";

export function parsePartyTotal(value: unknown): number | null {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(text)) return null;
  const amount = Number(text);
  return Number.isFinite(amount) && amount <= 1_000_000 ? amount : null;
}

export function overridePartyTotal(pricing: FacilityPricingResult, total: number): FacilityPricingResult {
  const subtotal = Math.round((total / (1 + pricing.taxRate)) * 100) / 100;
  return { ...pricing, subtotal, tax: Math.round((total - subtotal) * 100) / 100, total };
}

export function partyPriceAdjustment(packagePrice: number, addonSubtotal: number, subtotal: number): number {
  return Math.round((subtotal - packagePrice - addonSubtotal) * 100) / 100;
}
