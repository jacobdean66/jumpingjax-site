import { RENTALS } from "@/data/rentals";
import { estimateRentalLineSubtotal, type RentalLineInput } from "./rental-pricing-text";
import { INFLATABLE_PROMOTION_CODE, INFLATABLE_PROMOTION_PERCENT, normalizeInflatablePromotionCode } from "./ad-promotion-state";
export { INFLATABLE_PROMOTION_CODE, INFLATABLE_PROMOTION_PERCENT, INFLATABLE_PROMOTION_PATH, PROMOTION_STORAGE_KEY, PROMOTION_STORAGE_EVENT, normalizeInflatablePromotionCode } from "./ad-promotion-state";

export function isInflatablePromotionCategory(category: string): boolean {
  return ["bounce-houses", "combos", "obstacle-courses"].includes(category);
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
  if (!normalizeInflatablePromotionCode(code)) return 0;
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
