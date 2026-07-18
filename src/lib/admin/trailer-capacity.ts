import type { RentalCategoryId } from "@/data/rentals";
import {
  isInflatableCategory,
  type InventoryRouteKind,
} from "./inventory-ops";
import { isAccessoryProduct } from "./schedule-products";

/** Business rule: each trailer/load holds at most four inflatables. */
export const MAX_TRAILER_INFLATABLES = 4;

export type TrailerCapacityItem = {
  rentalItem: string;
  rentalName: string;
  categoryId?: RentalCategoryId | null;
  routeKind?: InventoryRouteKind | null;
  /** When set, overrides category/route heuristics. */
  isInflatable?: boolean;
};

export type TrailerCapacityResult = {
  inflatableCount: number;
  capacity: number;
  remaining: number;
  atCapacity: boolean;
  exceedsCapacity: boolean;
  warning: string | null;
  blockedMessage: string | null;
};

export function countsTowardTrailerCapacity(item: TrailerCapacityItem): boolean {
  if (typeof item.isInflatable === "boolean") return item.isInflatable;
  if (isAccessoryProduct(item.rentalItem, item.rentalName)) return false;
  if (item.categoryId) {
    return isInflatableCategory(
      item.categoryId,
      item.routeKind ?? "standard",
    );
  }
  const slug = item.rentalItem.toLowerCase();
  const name = item.rentalName.toLowerCase();
  if (
    slug.includes("foam") ||
    name.includes("foam") ||
    slug.includes("yard-game") ||
    name.includes("yard game")
  ) {
    return false;
  }
  return true;
}

export function countTrailerInflatables(
  items: readonly TrailerCapacityItem[],
): number {
  return items.reduce(
    (count, item) => count + (countsTowardTrailerCapacity(item) ? 1 : 0),
    0,
  );
}

export function evaluateTrailerCapacity(
  items: readonly TrailerCapacityItem[],
  capacity = MAX_TRAILER_INFLATABLES,
): TrailerCapacityResult {
  const inflatableCount = countTrailerInflatables(items);
  const remaining = capacity - inflatableCount;
  const atCapacity = inflatableCount >= capacity;
  const exceedsCapacity = inflatableCount > capacity;
  return {
    inflatableCount,
    capacity,
    remaining: Math.max(0, remaining),
    atCapacity,
    exceedsCapacity,
    warning:
      inflatableCount === capacity
        ? `Trailer is at the ${capacity}-inflatable limit.`
        : inflatableCount === capacity - 1
          ? `Trailer has ${inflatableCount} of ${capacity} inflatables — one slot left.`
          : null,
    blockedMessage: exceedsCapacity
      ? `Cannot assign ${inflatableCount} inflatables to one trailer (max ${capacity}).`
      : null,
  };
}

export function canAssignInflatableToTrailer(input: {
  currentItems: readonly TrailerCapacityItem[];
  nextItem: TrailerCapacityItem;
  capacity?: number;
  allowOwnerOverride?: boolean;
}): {
  ok: boolean;
  result: TrailerCapacityResult;
  requiresOverride: boolean;
} {
  const projected = [...input.currentItems, input.nextItem];
  const result = evaluateTrailerCapacity(projected, input.capacity);
  if (!result.exceedsCapacity) {
    return { ok: true, result, requiresOverride: false };
  }
  if (input.allowOwnerOverride) {
    return { ok: true, result, requiresOverride: true };
  }
  return { ok: false, result, requiresOverride: false };
}

export function trailerLoadKey(input: {
  truck: string | null | undefined;
  trailerLoad: number | null | undefined;
  workType?: string | null;
  workDate?: string | null;
}): string {
  const truck = input.truck?.trim() || "unassigned";
  const load =
    typeof input.trailerLoad === "number" && Number.isFinite(input.trailerLoad)
      ? String(input.trailerLoad)
      : "0";
  const workType = input.workType?.trim() || "any";
  const workDate = input.workDate?.trim() || "any";
  return `${workDate}|${workType}|${truck}|${load}`;
}
