// Lightweight shared code/state identifiers; no catalog or pricing dependencies.
export const INFLATABLE_PROMOTION_CODE = "GOOGLE15";
export const INFLATABLE_PROMOTION_PERCENT = 15;
export const INFLATABLE_PROMOTION_PATH = "/offers/inflatables-15";
export const PROMOTION_STORAGE_KEY = "jax-inflatables-promotion";
export const PROMOTION_STORAGE_EVENT = "jax-promotion-change";

export function normalizeInflatablePromotionCode(value: unknown): string {
  return typeof value === "string" && value.trim().toUpperCase() === INFLATABLE_PROMOTION_CODE ? INFLATABLE_PROMOTION_CODE : "";
}
