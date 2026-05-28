import type { FacilityPartyKind, FacilityRoomId } from "./types";
import { getLocalDayOfWeek } from "./time";

export const FACILITY_TAX_RATE = 0.07;

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

function privateBasePrice(day: number, durationMinutes: number): number | null {
  if (durationMinutes === 180) {
    return 380;
  }

  if (day === 1 || day === 2) {
    if (durationMinutes === 90) return 195;
    if (durationMinutes === 120) return 210;
  }

  if (day === 0 || day === 5 || day === 6) {
    if (durationMinutes === 90) return 220;
    if (durationMinutes === 120) return 255;
  }

  return null;
}

function publicBasePrice(
  day: number,
  roomId: FacilityRoomId,
  durationMinutes: number,
): number | null {
  if (durationMinutes !== 90) {
    return null;
  }

  if (roomId === "room-10") {
    return 120;
  }

  if (day === 3 || day === 4) {
    return 165;
  }

  if (day === 5 || day === 6) {
    return 190;
  }

  return null;
}

export function priceFacilityParty(
  input: FacilityPricingInput,
): FacilityPricingResult {
  const day = getLocalDayOfWeek(input.date);
  const packagePrice =
    input.partyKind === "private"
      ? privateBasePrice(day, input.durationMinutes)
      : publicBasePrice(day, input.roomId, input.durationMinutes);

  const resolvedPackagePrice = packagePrice ?? 0;
  const addonSubtotal = money(input.addonSubtotal);
  const subtotal = money(resolvedPackagePrice + addonSubtotal);
  const tax = money(subtotal * FACILITY_TAX_RATE);

  return {
    packagePrice: resolvedPackagePrice,
    addonSubtotal,
    subtotal,
    tax,
    total: money(subtotal + tax),
    taxRate: FACILITY_TAX_RATE,
    missingPrice: packagePrice === null ? "Missing facility package price" : null,
  };
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
