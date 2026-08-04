/**
 * Append-only Open Play admission payment ledger.
 * Original charge rows are never mutated; corrections, voids, and refunds
 * are represented as new entries that reference earlier ones.
 */

export type PaymentMethod = "cash" | "card";
export type PaymentEntryType = "charge" | "correction" | "void" | "refund";

export type PaymentEntry = {
  id: string;
  visitId: string;
  attendeeId: string | null;
  entryType: PaymentEntryType;
  method: PaymentMethod;
  amountCents: number;
  relatedEntryId: string | null;
  reason: string | null;
  createdByStaffId: string;
  createdAt: string;
};

export type ChargeDraft = {
  visitId: string;
  attendeeId: string;
  method: PaymentMethod;
  amountCents: number;
  createdByStaffId: string;
};

export type MethodCorrectionDraft = {
  visitId: string;
  relatedEntryId: string;
  fromMethod: PaymentMethod;
  toMethod: PaymentMethod;
  amountCents: number;
  reason: string;
  createdByStaffId: string;
  attendeeId?: string | null;
};

export type VoidDraft = {
  visitId: string;
  relatedEntryId: string;
  reason: string;
  createdByStaffId: string;
  attendeeId?: string | null;
};

export type RefundDraft = {
  visitId: string;
  relatedEntryId: string;
  method: PaymentMethod;
  amountCents: number;
  reason: string;
  createdByStaffId: string;
  attendeeId?: string | null;
};

export type DailyPaymentTotals = {
  cashTotalCents: number;
  cardTotalCents: number;
  combinedTotalCents: number;
  correctionCount: number;
  voidCount: number;
  refundCount: number;
};

export class LedgerValidationError extends Error {
  readonly code = "ledger_validation" as const;
  constructor(message: string) {
    super(message);
    this.name = "LedgerValidationError";
  }
}

function requirePositiveCents(amountCents: number, label: string): void {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new LedgerValidationError(`${label} must be a positive integer in cents`);
  }
}

function requireReason(reason: string): string {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new LedgerValidationError("A reason is required for corrective ledger entries");
  }
  if (trimmed.length > 500) {
    throw new LedgerValidationError("Reason must be 500 characters or fewer");
  }
  return trimmed;
}

function findEntry(entries: PaymentEntry[], id: string): PaymentEntry {
  const entry = entries.find((item) => item.id === id);
  if (!entry) {
    throw new LedgerValidationError(`Related payment entry not found: ${id}`);
  }
  return entry;
}

function assertSameVisit(visitId: string, entry: PaymentEntry): void {
  if (entry.visitId !== visitId) {
    throw new LedgerValidationError("Related payment entry belongs to a different visit");
  }
}

export function shouldCreateCharge(unitPriceCents: number): boolean {
  return unitPriceCents > 0;
}

export function buildChargeEntry(
  draft: ChargeDraft,
  id: string,
  createdAt: string,
): PaymentEntry {
  requirePositiveCents(draft.amountCents, "Charge amount");
  if (!draft.attendeeId.trim()) {
    throw new LedgerValidationError("Charge entries must reference an attendee");
  }
  return {
    id,
    visitId: draft.visitId,
    attendeeId: draft.attendeeId,
    entryType: "charge",
    method: draft.method,
    amountCents: draft.amountCents,
    relatedEntryId: null,
    reason: null,
    createdByStaffId: draft.createdByStaffId,
    createdAt,
  };
}

/**
 * Cash↔card correction is modeled as:
 * 1) a negative correction on the original method
 * 2) a positive correction on the destination method
 * Both reference the original charge and keep the original row unchanged.
 */
export function buildMethodCorrectionEntries(
  draft: MethodCorrectionDraft,
  existing: PaymentEntry[],
  ids: { debitId: string; creditId: string },
  createdAt: string,
): PaymentEntry[] {
  if (draft.fromMethod === draft.toMethod) {
    throw new LedgerValidationError("Correction methods must differ");
  }
  requirePositiveCents(draft.amountCents, "Correction amount");
  const reason = requireReason(draft.reason);
  const related = findEntry(existing, draft.relatedEntryId);
  assertSameVisit(draft.visitId, related);
  if (related.entryType !== "charge") {
    throw new LedgerValidationError("Method corrections must reference an original charge");
  }
  if (related.method !== draft.fromMethod) {
    throw new LedgerValidationError("fromMethod must match the original charge method");
  }
  if (related.amountCents !== draft.amountCents) {
    throw new LedgerValidationError(
      "Method corrections must move the full original charge amount",
    );
  }

  return [
    {
      id: ids.debitId,
      visitId: draft.visitId,
      attendeeId: draft.attendeeId ?? related.attendeeId,
      entryType: "correction",
      method: draft.fromMethod,
      amountCents: -draft.amountCents,
      relatedEntryId: related.id,
      reason,
      createdByStaffId: draft.createdByStaffId,
      createdAt,
    },
    {
      id: ids.creditId,
      visitId: draft.visitId,
      attendeeId: draft.attendeeId ?? related.attendeeId,
      entryType: "correction",
      method: draft.toMethod,
      amountCents: draft.amountCents,
      relatedEntryId: related.id,
      reason,
      createdByStaffId: draft.createdByStaffId,
      createdAt,
    },
  ];
}

export function buildVoidEntry(
  draft: VoidDraft,
  existing: PaymentEntry[],
  id: string,
  createdAt: string,
): PaymentEntry {
  const reason = requireReason(draft.reason);
  const related = findEntry(existing, draft.relatedEntryId);
  assertSameVisit(draft.visitId, related);
  if (related.entryType !== "charge") {
    throw new LedgerValidationError("Voids must reference an original charge");
  }
  return {
    id,
    visitId: draft.visitId,
    attendeeId: draft.attendeeId ?? related.attendeeId,
    entryType: "void",
    method: related.method,
    amountCents: -Math.abs(related.amountCents),
    relatedEntryId: related.id,
    reason,
    createdByStaffId: draft.createdByStaffId,
    createdAt,
  };
}

export function buildRefundEntry(
  draft: RefundDraft,
  existing: PaymentEntry[],
  id: string,
  createdAt: string,
): PaymentEntry {
  requirePositiveCents(draft.amountCents, "Refund amount");
  const reason = requireReason(draft.reason);
  const related = findEntry(existing, draft.relatedEntryId);
  assertSameVisit(draft.visitId, related);
  if (related.entryType !== "charge") {
    throw new LedgerValidationError("Refunds must reference an original charge");
  }
  if (draft.amountCents > related.amountCents) {
    throw new LedgerValidationError("Refund cannot exceed the original charge amount");
  }
  return {
    id,
    visitId: draft.visitId,
    attendeeId: draft.attendeeId ?? related.attendeeId,
    entryType: "refund",
    method: draft.method,
    amountCents: -draft.amountCents,
    relatedEntryId: related.id,
    reason,
    createdByStaffId: draft.createdByStaffId,
    createdAt,
  };
}

export function sumMethodTotals(entries: PaymentEntry[]): DailyPaymentTotals {
  let cashTotalCents = 0;
  let cardTotalCents = 0;
  let correctionCount = 0;
  let voidCount = 0;
  let refundCount = 0;

  for (const entry of entries) {
    if (entry.method === "cash") cashTotalCents += entry.amountCents;
    if (entry.method === "card") cardTotalCents += entry.amountCents;
    if (entry.entryType === "correction") correctionCount += 1;
    if (entry.entryType === "void") voidCount += 1;
    if (entry.entryType === "refund") refundCount += 1;
  }

  return {
    cashTotalCents,
    cardTotalCents,
    combinedTotalCents: cashTotalCents + cardTotalCents,
    correctionCount,
    voidCount,
    refundCount,
  };
}

export function cloneEntries(entries: PaymentEntry[]): PaymentEntry[] {
  return entries.map((entry) => ({ ...entry }));
}
