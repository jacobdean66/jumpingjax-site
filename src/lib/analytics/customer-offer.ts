export type GoogleOfferKind = "rental" | "facility";
export function personalGoogleCode(value: unknown): string {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^JAX-[A-F0-9]{32}$/.test(code) ? code : "";
}
export function facilityGoogleDiscount<
  T extends {
    packagePrice: number;
    addonSubtotal: number;
    subtotal: number;
    tax: number;
    total: number;
    taxRate: number;
  },
>(pricing: T, code: unknown): T & { googleDiscount: number } {
  const googleDiscount = personalGoogleCode(code)
    ? Math.round(pricing.packagePrice * 15) / 100
    : 0;
  const subtotal = Math.round((pricing.subtotal - googleDiscount) * 100) / 100;
  const tax = Math.round(subtotal * pricing.taxRate * 100) / 100;
  return {
    ...pricing,
    googleDiscount,
    subtotal,
    tax,
    total: Math.round((subtotal + tax) * 100) / 100,
  };
}
