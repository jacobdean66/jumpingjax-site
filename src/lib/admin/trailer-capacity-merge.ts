import type { TrailerAssignmentInput } from "./trailer-capacity-assignments";
import { trailerLoadKey } from "./trailer-capacity";

/**
 * Merge PATCH assignments with existing DB occupancy for the same trailer keys.
 * Items included in the patch replace their DB rows; other DB occupants remain.
 */
export function mergeTrailerCapacityOccupancy(input: {
  patchAssignments: readonly TrailerAssignmentInput[];
  existingAssignments: readonly TrailerAssignmentInput[];
}): TrailerAssignmentInput[] {
  const patchedIds = new Set(
    input.patchAssignments.map((assignment) => assignment.itemId),
  );
  const affectedKeys = new Set(
    input.patchAssignments
      .filter((assignment) => assignment.truck)
      .map((assignment) =>
        trailerLoadKey({
          truck: assignment.truck,
          trailerLoad: assignment.trailerLoad,
          workType: assignment.workType,
          workDate: assignment.workDate,
        }),
      ),
  );

  const retained = input.existingAssignments.filter((assignment) => {
    if (patchedIds.has(assignment.itemId)) return false;
    if (!assignment.truck) return false;
    const key = trailerLoadKey({
      truck: assignment.truck,
      trailerLoad: assignment.trailerLoad,
      workType: assignment.workType,
      workDate: assignment.workDate,
    });
    return affectedKeys.has(key);
  });

  return [...input.patchAssignments, ...retained];
}
