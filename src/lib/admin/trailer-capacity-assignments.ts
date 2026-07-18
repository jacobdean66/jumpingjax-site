import {
  evaluateTrailerCapacity,
  trailerLoadKey,
  type TrailerCapacityItem,
  type TrailerCapacityResult,
} from "./trailer-capacity";

export type TrailerAssignmentInput = {
  itemId: string;
  rentalItem: string;
  rentalName: string;
  workType: "delivery" | "pickup";
  workDate: string | null;
  truck: string | null;
  trailerLoad: number | null;
  isInflatable?: boolean;
  categoryId?: TrailerCapacityItem["categoryId"];
};

/**
 * Validate trailer capacity across a batch of assignments.
 * Delivery and pickup loads are counted separately (different workType keys).
 */
export function validateTrailerCapacityAssignments(
  assignments: readonly TrailerAssignmentInput[],
  options?: { allowOwnerOverride?: boolean },
): {
  ok: boolean;
  violations: Array<{
    key: string;
    result: TrailerCapacityResult;
    itemIds: string[];
  }>;
} {
  const groups = new Map<string, TrailerAssignmentInput[]>();
  for (const assignment of assignments) {
    if (!assignment.truck) continue;
    const key = trailerLoadKey({
      truck: assignment.truck,
      trailerLoad: assignment.trailerLoad,
      workType: assignment.workType,
      workDate: assignment.workDate,
    });
    const existing = groups.get(key) ?? [];
    existing.push(assignment);
    groups.set(key, existing);
  }

  const violations: Array<{
    key: string;
    result: TrailerCapacityResult;
    itemIds: string[];
  }> = [];

  for (const [key, group] of groups) {
    const result = evaluateTrailerCapacity(
      group.map((item) => ({
        rentalItem: item.rentalItem,
        rentalName: item.rentalName,
        categoryId: item.categoryId,
        isInflatable: item.isInflatable,
      })),
    );
    if (result.exceedsCapacity && !options?.allowOwnerOverride) {
      violations.push({
        key,
        result,
        itemIds: group.map((item) => item.itemId),
      });
    }
  }

  return { ok: violations.length === 0, violations };
}
