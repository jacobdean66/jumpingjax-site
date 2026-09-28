export const SWIPESIMPLE_FACILITY_DEPOSIT_URL =
  "https://swipesimple.com/links/lnk_b9bb3d8ad1dde33bf500f0ca77665060";

export const SWIPESIMPLE_RENTAL_PAYMENT_URL =
  "https://swipesimple.com/links/lnk_d4026d0630a2bf8965e59035d7f36bf4";

export const SWIPESIMPLE_GENERAL_PAYMENT_URL =
  "https://swipesimple.com/links/lnk_33a4add9eefe124a6ca14a4a40a6bafe";

export const SWIPESIMPLE_CARD_ADJUSTMENT_RATE = 0.03;
export const FACILITY_DEPOSIT_AMOUNT = 50;

export function adjustedCardTotal(amount: number): number {
  return Math.round(amount * (1 + SWIPESIMPLE_CARD_ADJUSTMENT_RATE) * 100) / 100;
}

export function formatPaymentAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function buildPaymentQrCodeUrl(paymentUrl: string, size = 220): string {
  const boundedSize = Math.min(600, Math.max(120, Math.round(size)));
  const url = new URL("https://api.qrserver.com/v1/create-qr-code/");
  url.searchParams.set("size", `${boundedSize}x${boundedSize}`);
  url.searchParams.set("margin", "16");
  url.searchParams.set("data", paymentUrl);
  return url.toString();
}
