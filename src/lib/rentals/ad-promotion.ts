import { RENTALS } from "@/data/rentals";
import { estimateRentalLineSubtotal, type RentalLineInput } from "./rental-pricing-text";

export const INFLATABLE_PROMOTION_CODE = "GOOGLE15";
export const INFLATABLE_PROMOTION_PERCENT = 15;
export const INFLATABLE_PROMOTION_PATH = "/offers/inflatables-15";
export const PROMOTION_STORAGE_KEY = "jax-inflatables-promotion";
export const PROMOTION_STORAGE_EVENT = "jax-promotion-change";

export function isInflatablePromotionCategory(category: string): boolean {
  return ["bounce-houses", "combos", "water-slides", "slides", "obstacle-courses", "inflatable-games"].includes(category);
}

export const DEFAULT_PROMOTION_SLUGS = RENTALS.filter((item) =>
  isInflatablePromotionCategory(item.categoryId),
).map((item) => item.slug);

export function calculateInflatableDiscount(
  code: unknown,
  items: RentalLineInput[],
  eligibleSlugs: readonly string[] = DEFAULT_PROMOTION_SLUGS,
  durationLabel = "One Day",
  spanDays = 1,
  foamDurationLabel?: string | null,
): number {
  if (code !== INFLATABLE_PROMOTION_CODE) return 0;
  const eligible = new Set(eligibleSlugs);
  const eligibleSubtotal = items.reduce((sum, item) => {
    if (!item.rental_item || !eligible.has(item.rental_item)) return sum;
    const price = estimateRentalLineSubtotal(item, durationLabel, spanDays, foamDurationLabel);
    return sum + (price != null && Number.isFinite(price) && price > 0 ? price : 0);
  }, 0);
  return Math.round(eligibleSubtotal * INFLATABLE_PROMOTION_PERCENT) / 100;
}

export function promotionDescription(discount: number): string {
  return `Google Ads offer ${INFLATABLE_PROMOTION_CODE}: 15% off eligible inflatable rentals (-$${discount.toFixed(2)}). Delivery, accessories, foam parties, and facility parties excluded.`;
}
