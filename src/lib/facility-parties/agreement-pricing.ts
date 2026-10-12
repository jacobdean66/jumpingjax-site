function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function nonnegativeInteger(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Math.floor(parsed), 100);
}

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateAgreementPricing(input: {
  packagePrice: number | null;
  addonSubtotal: number | null;
  storedSubtotal: number | null;
  storedTax: number | null;
  additionalChildrenAge3Plus: unknown;
  additionalChildrenAge2Under: unknown;
}) {
  const age3Plus = nonnegativeInteger(input.additionalChildrenAge3Plus);
  const age2Under = nonnegativeInteger(input.additionalChildrenAge2Under);
  const packagePrice = money(numeric(input.packagePrice));
  const addonSubtotal = money(numeric(input.addonSubtotal));
  const storedSubtotal = numeric(input.storedSubtotal);
  const storedTax = numeric(input.storedTax);
  const taxRate = storedSubtotal > 0 && storedTax >= 0
    ? Math.round((storedTax / storedSubtotal) * 10000) / 10000
    : 0.07;
  const additionalChildrenCharge = money(age3Plus * 10 + age2Under * 7);
  const baseSubtotal = input.storedSubtotal !== null && Number.isFinite(input.storedSubtotal) ? input.storedSubtotal : packagePrice + addonSubtotal;
  const priceAdjustment = money(baseSubtotal - packagePrice - addonSubtotal);
  const subtotal = money(baseSubtotal + additionalChildrenCharge);
  const tax = money(subtotal * taxRate);
  return {
    additionalChildrenAge3Plus: age3Plus,
    additionalChildrenAge2Under: age2Under,
    additionalChildrenCharge,
    packagePrice,
    ...(priceAdjustment !== 0 ? { priceAdjustment } : {}),
    addonSubtotal,
    subtotal,
    taxRate,
    tax,
    total: money(subtotal + tax),
  };
}

