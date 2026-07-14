import type { FacilityPartyKind, FacilityRoomId } from "./types";
import { getLocalDayOfWeek } from "./time";

export const FACILITY_TAX_RATE = 0.07;

export type FacilityPricingConfig = {
  publicRoom10: number;
  publicRoom20Weekday: number;
  publicRoom20Weekend: number;
  privateWeekday90: number;
  privateWeekday120: number;
  privateWeekend90: number;
  privateWeekend120: number;
  privateAny180: number;
  taxRate: number;
};

export const DEFAULT_FACILITY_PRICING: FacilityPricingConfig = {
  publicRoom10: 120,
  publicRoom20Weekday: 165,
  publicRoom20Weekend: 190,
  privateWeekday90: 195,
  privateWeekday120: 210,
  privateWeekend90: 220,
  privateWeekend120: 255,
  privateAny180: 380,
  taxRate: FACILITY_TAX_RATE,
};

export type FacilityPricingInput = {
  partyKind: FacilityPartyKind;
  roomId: FacilityRoomId;
  date: string;
  durationMinutes: number;
  addonSubtotal: number;
};

export type FacilityPricingResult = {
  packagePrice: number;
  addonSubtotal: number;
  subtotal: number;
  tax: number;
  total: number;
  taxRate: number;
  missingPrice: string | null;
};

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function privateBasePrice(
  day: number,
  durationMinutes: number,
  config: FacilityPricingConfig,
): number | null {
  if (durationMinutes === 180) {
    return config.privateAny180;
  }

  if (day === 1 || day === 2) {
    if (durationMinutes === 90) return config.privateWeekday90;
    if (durationMinutes === 120) return config.privateWeekday120;
  }

  if (day === 0 || day === 5 || day === 6) {
    if (durationMinutes === 90) return config.privateWeekend90;
    if (durationMinutes === 120) return config.privateWeekend120;
  }

  return null;
}

function publicBasePrice(
  day: number,
  roomId: FacilityRoomId,
  durationMinutes: number,
  config: FacilityPricingConfig,
): number | null {
  if (durationMinutes !== 90) {
    return null;
  }

  if (roomId === "room-10") {
    return config.publicRoom10;
  }

  if (day === 3 || day === 4) {
    return config.publicRoom20Weekday;
  }

  if (day === 5 || day === 6) {
    return config.publicRoom20Weekend;
  }

  return null;
}

export function priceFacilityPartyWithConfig(
  input: FacilityPricingInput,
  config: FacilityPricingConfig = DEFAULT_FACILITY_PRICING,
): FacilityPricingResult {
  const day = getLocalDayOfWeek(input.date);
  const packagePrice =
    input.partyKind === "private"
      ? privateBasePrice(day, input.durationMinutes, config)
      : publicBasePrice(day, input.roomId, input.durationMinutes, config);

  const resolvedPackagePrice = packagePrice ?? 0;
  const addonSubtotal = money(input.addonSubtotal);
  const subtotal = money(resolvedPackagePrice + addonSubtotal);
  const tax = money(subtotal * config.taxRate);

  return {
    packagePrice: resolvedPackagePrice,
    addonSubtotal,
    subtotal,
    tax,
    total: money(subtotal + tax),
    taxRate: config.taxRate,
    missingPrice: packagePrice === null ? "Missing facility package price" : null,
  };
}

export function priceFacilityParty(
  input: FacilityPricingInput,
): FacilityPricingResult {
  return priceFacilityPartyWithConfig(input, DEFAULT_FACILITY_PRICING);
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatFacilityPricingLines(
  pricing: FacilityPricingResult,
): string[] {
  return [
    `Package price: ${formatUsd(pricing.packagePrice)}`,
    `Add-ons subtotal: ${formatUsd(pricing.addonSubtotal)}`,
    `Subtotal: ${formatUsd(pricing.subtotal)}`,
    `Tax (${(pricing.taxRate * 100).toFixed(0)}%): ${formatUsd(pricing.tax)}`,
    `Total price: ${formatUsd(pricing.total)}`,
  ];
}
