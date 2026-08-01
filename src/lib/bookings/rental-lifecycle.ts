/**
 * Central rental lifecycle policy.
 *
 * `blocked` is an inventory hold, but not customer work. Pending rentals keep
 * their existing operational behavior until the business explicitly changes
 * that policy.
 */
export const RENTAL_INVENTORY_BLOCKING_STATUSES = [
  "pending",
  "approved",
  "blocked",
] as const;

export const RENTAL_OPERATIONAL_STATUSES = ["pending", "approved"] as const;

const INVENTORY_BLOCKING_STATUS_SET = new Set<string>(
  RENTAL_INVENTORY_BLOCKING_STATUSES,
);
const OPERATIONAL_STATUS_SET = new Set<string>(RENTAL_OPERATIONAL_STATUSES);
const CANCELLED_STATUS_SET = new Set(["cancelled", "canceled"]);
const REJECTED_STATUS_SET = new Set(["rejected", "denied"]);

export function normalizeRentalStatus(
  status: string | null | undefined,
): string {
  return status?.trim().toLowerCase() ?? "";
}

export function rentalBlocksInventory(
  status: string | null | undefined,
): boolean {
  return INVENTORY_BLOCKING_STATUS_SET.has(normalizeRentalStatus(status));
}

export function rentalAppearsInActiveSchedule(
  status: string | null | undefined,
): boolean {
  return OPERATIONAL_STATUS_SET.has(normalizeRentalStatus(status));
}

export const rentalAppearsInRoutePlanner = rentalAppearsInActiveSchedule;
export const rentalAppearsInDriverApp = rentalAppearsInActiveSchedule;
export const rentalContributesToOperationalTotals =
  rentalAppearsInActiveSchedule;

export function rentalIsCancelled(
  status: string | null | undefined,
): boolean {
  return CANCELLED_STATUS_SET.has(normalizeRentalStatus(status));
}

export function rentalIsRejected(status: string | null | undefined): boolean {
  return REJECTED_STATUS_SET.has(normalizeRentalStatus(status));
}

export function rentalIsHistorical(
  status: string | null | undefined,
): boolean {
  return rentalIsCancelled(status) || rentalIsRejected(status);
}

/** Historical/admin views retain every stored booking regardless of status. */
export function rentalRemainsVisibleInHistory(
  status: string | null | undefined,
): true {
  void status;
  return true;
}
