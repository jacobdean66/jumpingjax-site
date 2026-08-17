/**
 * Frontend helpers for the owner Open Play corrections page.
 * Uses existing owner daily-report GET for visit/ledger read context
 * and POST /api/admin/open-play/visits/[id]/corrections for mutations.
 * Does not invent backend contracts or recompute authoritative balances.
 */

import { businessDayYmdFromInstant } from "./business-day";
import { isYmd, type AdmissionClassification } from "./pricing";
import {
  effectivePaymentMethod,
  isChargeVoided,
  remainingChargeValueCents,
  type PaymentEntry,
  type PaymentEntryType,
  type PaymentMethod,
} from "./ledger";
import type { DailyReport } from "./daily-report";

export type { PaymentEntry, PaymentEntryType, PaymentMethod, DailyReport };

export type VisitReportRow = DailyReport["visits"][number];

export type OwnerFacingError = {
  code: string;
  message: string;
  requiresSignIn: boolean;
  forbidden: boolean;
  financialReversalRequired: boolean;
  ambiguous: boolean;
};

export type CorrectionSuccess = {
  ok: true;
  entries: PaymentEntry[];
};

export type MethodCorrectionPayload = {
  type: "method_correction";
  relatedEntryId: string;
  fromMethod: PaymentMethod;
  toMethod: PaymentMethod;
  amountCents: number;
  reason: string;
  attendeeId?: string | null;
};

export type RefundPayload = {
  type: "refund";
  relatedEntryId: string;
  method: PaymentMethod;
  amountCents: number;
  reason: string;
  attendeeId?: string | null;
};

export type VoidPayload = {
  type: "void";
  relatedEntryId: string;
  reason: string;
  attendeeId?: string | null;
  removeAttendeeId?: string | null;
};

export type RemoveAttendeePayload = {
  type: "remove_attendee";
  attendeeId: string;
  relatedEntryId?: string | null;
  reason: string;
};

export type CorrectionPayload =
  | MethodCorrectionPayload
  | RefundPayload
  | VoidPayload
  | RemoveAttendeePayload;

const REPORT_PATH = "/api/admin/open-play/daily-report";
const CORRECTIONS_PATH = "/api/admin/open-play/visits";
const LEGACY_CORRECTIONS_PATH = "/api/admin/open-play/legacy-visits";
const UUID_RE = /^[0-9a-f-]{36}$/i;

export function todayBusinessDayYmd(now: Date = new Date()): string {
  return businessDayYmdFromInstant(now);
}

export function normalizeYmd(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return isYmd(trimmed) ? trimmed : null;
}

export function isVisitUuid(value: string | null | undefined): boolean {
  return UUID_RE.test((value ?? "").trim());
}

export function buildDailyReportUrl(dateYmd: string): string {
  const date = normalizeYmd(dateYmd);
  if (!date) throw new Error("date must be YYYY-MM-DD");
  return `${REPORT_PATH}?${new URLSearchParams({ date }).toString()}`;
}

export function buildCorrectionsUrl(
  visitId: string,
  source: "native" | "legacy_smartwaiver" = "native",
): string {
  const id = (visitId ?? "").trim();
  if (!isVisitUuid(id)) throw new Error("visit id must be a UUID");
  const base = source === "legacy_smartwaiver"
    ? LEGACY_CORRECTIONS_PATH
    : CORRECTIONS_PATH;
  return `${base}/${id}/corrections`;
}

export function parsePaymentMethodChoice(
  value: unknown,
): PaymentMethod | null {
  return value === "cash" || value === "card" ? value : null;
}

export function formatCents(cents: number): string {
  if (!Number.isFinite(cents)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatSignedCents(cents: number): string {
  if (!Number.isFinite(cents)) return "—";
  const formatted = formatCents(Math.abs(cents));
  if (cents < 0) return `−${formatted}`;
  if (cents > 0) return `+${formatted}`;
  return formatCents(0);
}

export function formatTimestamp(iso: string): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(value);
}

export function classificationLabel(value: AdmissionClassification | string): string {
  switch (value) {
    case "child_2_or_under":
      return "Child (2 or under)";
    case "child_3_plus":
      return "Child (3+)";
    case "playing_adult":
      return "Playing adult";
    case "watching_adult":
      return "Watching adult";
    default:
      return String(value);
  }
}

export function entryTypeLabel(entryType: PaymentEntryType | string): string {
  switch (entryType) {
    case "charge":
      return "Original charge";
    case "correction":
      return "Payment-method correction";
    case "void":
      return "Void adjustment";
    case "refund":
      return "Refund";
    default:
      return String(entryType);
  }
}

export function visitStatusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Open";
    case "finalized":
      return "Finalized";
    case "voided":
      return "Voided";
    default:
      return status;
  }
}

export function attendeeStatusLabel(status: string): string {
  return status === "removed" ? "Removed" : "Active";
}

export function isOriginalEntry(entry: PaymentEntry): boolean {
  return entry.entryType === "charge";
}

export function sortLedgerEntries(entries: PaymentEntry[]): PaymentEntry[] {
  return [...entries].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

export function listOriginalCharges(entries: PaymentEntry[]): PaymentEntry[] {
  return sortLedgerEntries(entries).filter((entry) => entry.entryType === "charge");
}

export type ChargeActionView = {
  charge: PaymentEntry;
  voided: boolean;
  remainingCents: number;
  effectiveMethod: PaymentMethod;
  canCorrectMethod: boolean;
  canRefund: boolean;
  canVoid: boolean;
};

/** UI hints derived from the loaded ledger. Server remains authoritative. */
export function toChargeActionView(
  entries: PaymentEntry[],
  charge: PaymentEntry,
): ChargeActionView {
  const voided = isChargeVoided(entries, charge.id);
  let remainingCents = 0;
  let effectiveMethod: PaymentMethod = charge.method;
  try {
    remainingCents = remainingChargeValueCents(entries, charge.id);
    effectiveMethod = effectivePaymentMethod(entries, charge.id);
  } catch {
    remainingCents = 0;
    effectiveMethod = charge.method;
  }
  const alreadyCorrected = effectiveMethod !== charge.method;
  const fullyRetained = remainingCents === charge.amountCents;
  return {
    charge,
    voided,
    remainingCents,
    effectiveMethod,
    canCorrectMethod: !voided && fullyRetained && !alreadyCorrected,
    canRefund: !voided && remainingCents > 0,
    canVoid: !voided && fullyRetained,
  };
}

export type ChargeActionKind = "method" | "refund" | "void";

/**
 * Owner-safe explanation for why a charge action is unavailable, or null when
 * the action is eligible. Mirrors the reviewed backend rules: no method
 * correction after a prior correction or refunds, no refund without remaining
 * value, no void after refunds, nothing on voided charges. Server remains the
 * final authority.
 */
export function chargeActionBlockedReason(
  view: ChargeActionView,
  action: ChargeActionKind,
): string | null {
  const fullyRetained = view.remainingCents === view.charge.amountCents;
  const alreadyCorrected = view.effectiveMethod !== view.charge.method;

  if (action === "method") {
    if (view.canCorrectMethod) return null;
    if (view.voided) {
      return "This charge is voided, so its payment method can no longer be corrected.";
    }
    if (alreadyCorrected) {
      return "This charge's payment method has already been corrected.";
    }
    if (!fullyRetained) {
      return "Method corrections are unavailable after refunds because the charge is no longer fully retained.";
    }
    return "Method correction is unavailable for this charge.";
  }

  if (action === "refund") {
    if (view.canRefund) return null;
    if (view.voided) {
      return "This charge is voided, so there is nothing left to refund.";
    }
    return "No remaining charge value is available to refund.";
  }

  if (view.canVoid) return null;
  if (view.voided) return "This charge is already voided.";
  if (!fullyRetained) {
    return "Voids are unavailable after refunds. Refund the remaining value instead.";
  }
  return "Void is unavailable for this charge.";
}

/**
 * Duplicate-submit and reload-gate rule used by the corrections page:
 * no new correction may be sent while one is in flight, and none may be
 * sent after a success or ambiguous outcome until the ledger is reloaded.
 */
export function canSubmitCorrection(state: {
  submitting: boolean;
  needsReload: boolean;
}): boolean {
  return !state.submitting && !state.needsReload;
}

/**
 * Interactive corrections-page gate. The real CorrectionsClient applies these
 * transitions; tests exercise the same functions the component calls.
 */
export type CorrectionsGateState = {
  submitting: boolean;
  needsReload: boolean;
  /** Increments when a mutation settles with success or ambiguous outcome. */
  mutationEpoch: number;
  selectedVisitId: string;
  /** Visit id that owns the current mutation result panel, if any. */
  mutationVisitId: string | null;
};

export type ReportLoadKind = "browse" | "post_mutation_reload";

export type ReportRequestHandle = {
  requestId: number;
  kind: ReportLoadKind;
  /** mutationEpoch captured when the GET was initiated. */
  startedAtEpoch: number;
};

export function createCorrectionsGateState(
  overrides: Partial<CorrectionsGateState> = {},
): CorrectionsGateState {
  return {
    submitting: false,
    needsReload: false,
    mutationEpoch: 0,
    selectedVisitId: "",
    mutationVisitId: null,
    ...overrides,
  };
}

export function canBrowseVisitsAndDates(state: CorrectionsGateState): boolean {
  return !state.submitting && !state.needsReload;
}

export function canSelectVisitFromCachedReport(
  state: CorrectionsGateState,
): boolean {
  return canBrowseVisitsAndDates(state);
}

export function canStartPostMutationReload(
  state: CorrectionsGateState,
): boolean {
  return !state.submitting && state.needsReload;
}

export function canStartBrowseReportLoad(state: CorrectionsGateState): boolean {
  return canBrowseVisitsAndDates(state);
}

/** Begin a POST. Locks browse/selection via submitting. */
export function beginCorrectionMutation(
  state: CorrectionsGateState,
  visitId: string,
): CorrectionsGateState {
  if (!canSubmitCorrection(state)) return state;
  return {
    ...state,
    submitting: true,
    mutationVisitId: visitId,
  };
}

/**
 * Successful or ambiguous mutation settlement: arm reload gate and bump epoch
 * so older in-flight GETs cannot clear the newer requirement.
 */
export function settleCorrectionMutation(
  state: CorrectionsGateState,
  outcome: "success" | "ambiguous" | "error",
): CorrectionsGateState {
  if (!state.submitting) return state;
  if (outcome === "error") {
    return { ...state, submitting: false };
  }
  return {
    ...state,
    submitting: false,
    needsReload: true,
    mutationEpoch: state.mutationEpoch + 1,
  };
}

/**
 * Visit selection from cached report data. Never clears needsReload.
 * Rejected while submitting or while a reload is required.
 */
export function selectVisitFromCachedReport(
  state: CorrectionsGateState,
  visitId: string,
): CorrectionsGateState {
  if (!canSelectVisitFromCachedReport(state)) return state;
  return {
    ...state,
    selectedVisitId: visitId,
    mutationVisitId: null,
  };
}

export function beginReportRequest(
  state: CorrectionsGateState,
  input: { kind: ReportLoadKind; nextRequestId: number },
): { state: CorrectionsGateState; request: ReportRequestHandle } | null {
  if (input.kind === "browse") {
    if (!canStartBrowseReportLoad(state)) return null;
  } else if (!canStartPostMutationReload(state)) {
    return null;
  }
  return {
    state,
    request: {
      requestId: input.nextRequestId,
      kind: input.kind,
      startedAtEpoch: state.mutationEpoch,
    },
  };
}

export type ReportResolveDecision =
  | { action: "ignore" }
  | { action: "discard_stale_browse"; state: CorrectionsGateState }
  | {
      action: "apply";
      state: CorrectionsGateState;
      clearMutationPanel: boolean;
    };

/**
 * Resolve a daily-report GET against the current gate.
 * Only a post_mutation_reload that started at the current mutationEpoch may
 * clear needsReload. Older browse/reload GETs cannot unlock a newer gate.
 */
export function resolveReportRequest(
  state: CorrectionsGateState,
  request: ReportRequestHandle,
  currentRequestId: number,
): ReportResolveDecision {
  if (request.requestId !== currentRequestId) {
    return { action: "ignore" };
  }

  if (request.kind === "post_mutation_reload") {
    if (
      !state.needsReload ||
      state.submitting ||
      request.startedAtEpoch !== state.mutationEpoch
    ) {
      return { action: "ignore" };
    }
    return {
      action: "apply",
      state: {
        ...state,
        needsReload: false,
      },
      clearMutationPanel: true,
    };
  }

  // Browse / day load
  if (state.submitting) {
    return { action: "ignore" };
  }
  if (state.needsReload || request.startedAtEpoch !== state.mutationEpoch) {
    return { action: "discard_stale_browse", state };
  }
  return {
    action: "apply",
    state,
    clearMutationPanel: true,
  };
}

export function shouldShowMutationForVisit(input: {
  mutationVisitId: string | null | undefined;
  selectedVisitId: string | null | undefined;
}): boolean {
  const mutationVisitId = (input.mutationVisitId ?? "").trim();
  const selectedVisitId = (input.selectedVisitId ?? "").trim();
  return Boolean(mutationVisitId) && mutationVisitId === selectedVisitId;
}

export function dollarsInputToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const cents = Math.round(Number(trimmed) * 100);
  if (!Number.isInteger(cents) || cents <= 0) return null;
  return cents;
}

export function buildMethodCorrectionPayload(input: {
  relatedEntryId: string;
  fromMethod: PaymentMethod;
  toMethod: PaymentMethod;
  amountCents: number;
  reason: string;
  attendeeId?: string | null;
}): MethodCorrectionPayload {
  const fromMethod = parsePaymentMethodChoice(input.fromMethod);
  const toMethod = parsePaymentMethodChoice(input.toMethod);
  if (!fromMethod || !toMethod) {
    throw new Error("Payment method must be cash or card");
  }
  if (fromMethod === toMethod) {
    throw new Error("Correction methods must differ");
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("Correction amount must be a positive integer in cents");
  }
  const reason = input.reason.trim();
  if (!reason) throw new Error("A reason is required");
  return {
    type: "method_correction",
    relatedEntryId: input.relatedEntryId.trim(),
    fromMethod,
    toMethod,
    amountCents: input.amountCents,
    reason,
    attendeeId: input.attendeeId ?? null,
  };
}

export function buildRefundPayload(input: {
  relatedEntryId: string;
  method: PaymentMethod;
  amountCents: number;
  reason: string;
  attendeeId?: string | null;
}): RefundPayload {
  const method = parsePaymentMethodChoice(input.method);
  if (!method) throw new Error("Payment method must be cash or card");
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("Refund amount must be a positive integer in cents");
  }
  const reason = input.reason.trim();
  if (!reason) throw new Error("A reason is required");
  return {
    type: "refund",
    relatedEntryId: input.relatedEntryId.trim(),
    method,
    amountCents: input.amountCents,
    reason,
    attendeeId: input.attendeeId ?? null,
  };
}

export function buildVoidPayload(input: {
  relatedEntryId: string;
  reason: string;
  attendeeId?: string | null;
  removeAttendeeId?: string | null;
}): VoidPayload {
  const reason = input.reason.trim();
  if (!reason) throw new Error("A reason is required");
  return {
    type: "void",
    relatedEntryId: input.relatedEntryId.trim(),
    reason,
    attendeeId: input.attendeeId ?? null,
    removeAttendeeId: input.removeAttendeeId ?? null,
  };
}

export function buildRemoveAttendeePayload(input: {
  attendeeId: string;
  reason: string;
  relatedEntryId?: string | null;
}): RemoveAttendeePayload {
  const reason = input.reason.trim();
  if (!reason) throw new Error("A reason is required");
  const attendeeId = input.attendeeId.trim();
  if (!attendeeId) throw new Error("Attendee is required");
  return {
    type: "remove_attendee",
    attendeeId,
    relatedEntryId: input.relatedEntryId ?? null,
    reason,
  };
}

export function mapCorrectionApiError(options: {
  status: number;
  payload: { ok?: false; error?: string; code?: string } | null;
}): OwnerFacingError {
  const code = options.payload?.code ?? "";
  const raw = (options.payload?.error ?? "").trim();
  const lower = raw.toLowerCase();

  if (options.status === 401 || code === "unauthorized") {
    return {
      code: "unauthorized",
      message: "Your staff session expired. Sign in again to continue.",
      requiresSignIn: true,
      forbidden: false,
      financialReversalRequired: false,
      ambiguous: false,
    };
  }

  if (options.status === 403 || code === "forbidden") {
    return {
      code: "forbidden",
      message: "Owner access is required to correct Open Play visits.",
      requiresSignIn: false,
      forbidden: true,
      financialReversalRequired: false,
      ambiguous: false,
    };
  }

  if (options.status === 429) {
    return {
      code: "rate_limited",
      message: "Too many requests. Wait a moment and try again.",
      requiresSignIn: false,
      forbidden: false,
      financialReversalRequired: false,
      ambiguous: false,
    };
  }

  if (/financial reversal/i.test(raw) || code === "financial_reversal_required") {
    return {
      code: "financial_reversal_required",
      message:
        "This attendee still has remaining paid balance. Refund or void the related charge before removing them.",
      requiresSignIn: false,
      forbidden: false,
      financialReversalRequired: true,
      ambiguous: false,
    };
  }

  if (/refund cannot exceed/i.test(lower)) {
    return {
      code: "refund_exceeds_remaining",
      message: "Refund cannot exceed the remaining charge value.",
      requiresSignIn: false,
      forbidden: false,
      financialReversalRequired: false,
      ambiguous: false,
    };
  }

  if (/already voided/i.test(lower)) {
    return {
      code: "charge_already_voided",
      message: "That charge is already voided.",
      requiresSignIn: false,
      forbidden: false,
      financialReversalRequired: false,
      ambiguous: false,
    };
  }

  if (/cash or card/i.test(lower)) {
    return {
      code: "invalid_payment_method",
      message: "Payment method must be cash or card.",
      requiresSignIn: false,
      forbidden: false,
      financialReversalRequired: false,
      ambiguous: false,
    };
  }

  if (/visit not found/i.test(lower)) {
    return {
      code: "visit_not_found",
      message: "Visit not found.",
      requiresSignIn: false,
      forbidden: false,
      financialReversalRequired: false,
      ambiguous: false,
    };
  }

  if (/attendee not found|already removed/i.test(lower)) {
    return {
      code: "attendee_not_found_or_removed",
      message: "Attendee not found or already removed.",
      requiresSignIn: false,
      forbidden: false,
      financialReversalRequired: false,
      ambiguous: false,
    };
  }

  if (/voided visits cannot/i.test(lower)) {
    return {
      code: "visit_voided",
      message: "Voided visits cannot accept corrections.",
      requiresSignIn: false,
      forbidden: false,
      financialReversalRequired: false,
      ambiguous: false,
    };
  }

  if (/already been corrected|after refunds|method mismatch|related payment/i.test(lower)) {
    return {
      code: "conflict",
      message: raw || "This correction conflicts with the current ledger. Reload the visit and try again.",
      requiresSignIn: false,
      forbidden: false,
      financialReversalRequired: false,
      ambiguous: false,
    };
  }

  if (code === "database" || options.status === 503) {
    return {
      code: "database",
      message: "Corrections are temporarily unavailable. Try again in a moment.",
      requiresSignIn: false,
      forbidden: false,
      financialReversalRequired: false,
      ambiguous: false,
    };
  }

  if (options.status >= 500) {
    return {
      code: "server_error",
      message: "Something went wrong on the server. Try again in a moment.",
      requiresSignIn: false,
      forbidden: false,
      financialReversalRequired: false,
      ambiguous: false,
    };
  }

  return {
    code: code || `http_${options.status}`,
    message: raw || "The correction could not be applied. Try again.",
    requiresSignIn: false,
    forbidden: false,
    financialReversalRequired: false,
    ambiguous: false,
  };
}

export function ambiguousNetworkFailure(): OwnerFacingError {
  return {
    code: "ambiguous_network",
    message:
      "The result is uncertain because the network failed after the request was sent. Reload the visit before retrying. Do not resend until you confirm the current ledger.",
    requiresSignIn: false,
    forbidden: false,
    financialReversalRequired: false,
    ambiguous: true,
  };
}

export function malformedSuccessError(): OwnerFacingError {
  return {
    code: "malformed_success",
    message:
      "The server returned an unexpected success payload. Reload the visit before continuing.",
    requiresSignIn: false,
    forbidden: false,
    financialReversalRequired: false,
    ambiguous: true,
  };
}

export function malformedReportError(): OwnerFacingError {
  return {
    code: "malformed_report",
    message:
      "The server returned an unexpected report payload. Reload and try again.",
    requiresSignIn: false,
    forbidden: false,
    financialReversalRequired: false,
    ambiguous: false,
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Strict runtime validation for one ledger row against the PaymentEntry
 * contract. Returns null for any row this UI must not trust: missing/empty
 * ids, unsupported entryType or method, non-integer amounts, or invalid
 * nullable identity fields. Legitimate null attendeeId/relatedEntryId/reason
 * are preserved.
 */
export function parsePaymentEntryRow(
  value: unknown,
  options?: { expectedVisitId?: string },
): PaymentEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;

  if (!isNonEmptyString(row.id)) return null;
  if (!isNonEmptyString(row.visitId)) return null;
  if (options?.expectedVisitId && row.visitId !== options.expectedVisitId) {
    return null;
  }

  const entryType = row.entryType;
  if (
    entryType !== "charge" &&
    entryType !== "correction" &&
    entryType !== "void" &&
    entryType !== "refund"
  ) {
    return null;
  }

  const method = row.method;
  if (method !== "cash" && method !== "card") return null;

  const amountCents = row.amountCents;
  if (typeof amountCents !== "number" || !Number.isInteger(amountCents)) {
    return null;
  }

  const attendeeId = row.attendeeId ?? null;
  if (attendeeId !== null && !isNonEmptyString(attendeeId)) return null;

  const relatedEntryId = row.relatedEntryId ?? null;
  if (relatedEntryId !== null && !isNonEmptyString(relatedEntryId)) return null;

  const reason = row.reason ?? null;
  if (reason !== null && typeof reason !== "string") return null;

  if (!isNonEmptyString(row.createdByStaffId)) return null;
  if (!isNonEmptyString(row.createdAt)) return null;

  return {
    id: row.id,
    visitId: row.visitId,
    attendeeId,
    entryType,
    method,
    amountCents,
    relatedEntryId,
    reason,
    createdByStaffId: row.createdByStaffId,
    createdAt: row.createdAt,
  };
}

function isValidReportAttendee(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const attendee = value as Record<string, unknown>;
  if (!isNonEmptyString(attendee.id)) return false;
  if (!isNonEmptyString(attendee.classification)) return false;
  if (
    typeof attendee.unitPriceCents !== "number" ||
    !Number.isInteger(attendee.unitPriceCents)
  ) {
    return false;
  }
  return attendee.status === "active" || attendee.status === "removed";
}

function isValidReportVisit(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const visit = value as Record<string, unknown>;
  if (!isNonEmptyString(visit.visitId)) return false;
  if (
    visit.source !== undefined &&
    visit.source !== "native" &&
    visit.source !== "legacy_smartwaiver"
  ) {
    return false;
  }
  if (
    visit.status !== "open" &&
    visit.status !== "finalized" &&
    visit.status !== "voided"
  ) {
    return false;
  }
  if (
    !Number.isInteger(visit.cashTotalCents) ||
    !Number.isInteger(visit.cardTotalCents) ||
    !Number.isInteger(visit.combinedTotalCents)
  ) {
    return false;
  }
  if (!Array.isArray(visit.attendees) || !visit.attendees.every(isValidReportAttendee)) {
    return false;
  }
  if (
    !Array.isArray(visit.payments) ||
    !visit.payments.every((row) => parsePaymentEntryRow(row) !== null)
  ) {
    return false;
  }
  return true;
}

/**
 * Runtime validation for the minimum DailyReport structure this page uses:
 * a visits array whose rows carry valid ids, statuses, integer totals,
 * attendees, and PaymentEntry ledgers. Does not modify the backend contract.
 */
export function isValidDailyReportForCorrections(
  value: unknown,
): value is DailyReport {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const report = value as Record<string, unknown>;
  return Array.isArray(report.visits) && report.visits.every(isValidReportVisit);
}

function parseJsonSafe(response: Response): Promise<Record<string, unknown> | null> {
  return response
    .json()
    .then((value) =>
      value && typeof value === "object" ? (value as Record<string, unknown>) : null,
    )
    .catch(() => null);
}

/** GET-only daily report fetch for visit/ledger context. */
export async function fetchVisitsForBusinessDay(
  dateYmd: string,
  signal?: AbortSignal,
): Promise<DailyReport> {
  const response = await fetch(buildDailyReportUrl(dateYmd), {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  const payload = await parseJsonSafe(response);
  if (!response.ok || payload?.ok === false || !payload?.report) {
    throw mapCorrectionApiError({
      status: response.status,
      payload: payload as { ok?: false; error?: string; code?: string } | null,
    });
  }
  if (!isValidDailyReportForCorrections(payload.report)) {
    throw malformedReportError();
  }
  return payload.report;
}

/**
 * POST correction. Returns new ledger entries from the server.
 * Callers must disable duplicate submits while in flight.
 */
export async function postVisitCorrection(
  visitId: string,
  body: CorrectionPayload,
  sourceOrSignal: "native" | "legacy_smartwaiver" | AbortSignal = "native",
  explicitSignal?: AbortSignal,
): Promise<CorrectionSuccess> {
  const source = typeof sourceOrSignal === "string" ? sourceOrSignal : "native";
  const signal = typeof sourceOrSignal === "string" ? explicitSignal : sourceOrSignal;
  let response: Response;
  try {
    response = await fetch(buildCorrectionsUrl(visitId, source), {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw ambiguousNetworkFailure();
  }

  const payload = await parseJsonSafe(response);
  if (!response.ok || payload?.ok === false) {
    throw mapCorrectionApiError({
      status: response.status,
      payload: payload as { ok?: false; error?: string; code?: string } | null,
    });
  }

  if (payload?.ok !== true || !Array.isArray(payload.entries)) {
    throw malformedSuccessError();
  }

  const entries: PaymentEntry[] = [];
  for (const row of payload.entries as unknown[]) {
    const entry = parsePaymentEntryRow(row, { expectedVisitId: visitId });
    if (!entry) throw malformedSuccessError();
    entries.push(entry);
  }

  return { ok: true, entries };
}

export function findVisitInReport(
  report: DailyReport,
  visitId: string,
): VisitReportRow | null {
  return report.visits.find((visit) => visit.visitId === visitId) ?? null;
}
