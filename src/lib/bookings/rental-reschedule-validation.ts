import { rentalBlocksInventory } from "./rental-lifecycle";

export type RentalConflictCandidate = {
  id: string;
  status: string;
  eventDate: string;
  spanDays: number;
  rentalItems: readonly string[];
};

export type RentalScheduleProposal = {
  bookingId: string;
  eventDate: string;
  spanDays: number;
  rentalItems: readonly string[];
};

function addDays(ymd: string, days: number): string {
  const date = new Date(`${ymd}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function rentalRangesOverlap(
  left: Pick<RentalScheduleProposal, "eventDate" | "spanDays">,
  right: Pick<RentalScheduleProposal, "eventDate" | "spanDays">,
): boolean {
  const leftEnd = addDays(left.eventDate, Math.max(1, left.spanDays) - 1);
  const rightEnd = addDays(right.eventDate, Math.max(1, right.spanDays) - 1);
  return left.eventDate <= rightEnd && right.eventDate <= leftEnd;
}

export function findRentalRescheduleConflicts(
  proposal: RentalScheduleProposal,
  candidates: readonly RentalConflictCandidate[],
): RentalConflictCandidate[] {
  const proposedItems = new Set(proposal.rentalItems);
  return candidates.filter(
    (candidate) =>
      candidate.id !== proposal.bookingId &&
      rentalBlocksInventory(candidate.status) &&
      candidate.rentalItems.some((item) => proposedItems.has(item)) &&
      rentalRangesOverlap(proposal, candidate),
  );
}

export function planRentalReschedule(
  current: RentalConflictCandidate,
  proposal: RentalScheduleProposal,
  candidates: readonly RentalConflictCandidate[],
):
  | { ok: true; update: RentalScheduleProposal }
  | {
      ok: false;
      conflicts: RentalConflictCandidate[];
      preservedOriginal: RentalConflictCandidate;
    } {
  const conflicts = findRentalRescheduleConflicts(proposal, candidates);
  if (conflicts.length > 0) {
    return { ok: false, conflicts, preservedOriginal: current };
  }
  return { ok: true, update: proposal };
}
