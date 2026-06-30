import {
  validateSocialPublicationLedgerPersistenceModel,
  type SocialPublicationLedgerAttemptRecord,
  type SocialPublicationLedgerEvidenceRecord,
  type SocialPublicationLedgerOutcomeRecord,
  type SocialPublicationLedgerPersistenceError,
  type SocialPublicationLedgerPersistenceModel,
} from "./social-publication-ledger-persistence";

export const SOCIAL_PUBLICATION_LEDGER_REPLAY_DIAGNOSTIC_CODES = [
  "persistence_validation_failed",
  "duplicate_identity",
  "invalid_ordering",
  "missing_parent",
  "orphan_attempt",
  "orphan_outcome",
  "orphan_evidence",
  "append_only_violation",
  "impossible_transition",
] as const;

export type SocialPublicationLedgerReplayDiagnosticCode =
  (typeof SOCIAL_PUBLICATION_LEDGER_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialPublicationLedgerPublicationStatus =
  | "no_history"
  | "attempted"
  | "retry_requested"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "invalid";

export type SocialPublicationLedgerTerminalState =
  | "none"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "invalid";

export type SocialPublicationLedgerReplayEventKind =
  | "attempt"
  | "outcome"
  | "evidence";

export type SocialPublicationLedgerReplayDiagnostic = Readonly<{
  code: SocialPublicationLedgerReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "error" | "warning";
}>;

export type SocialPublicationLedgerReplayTimelineEvent = Readonly<{
  sequence: number;
  kind: SocialPublicationLedgerReplayEventKind;
  recordedAt: string;
  ledgerEntryId: string;
  publicationAttemptId: string;
  outcomeId: string | null;
  evidenceId: string | null;
  eventType: string | null;
}>;

export type SocialPublicationLedgerAttemptProjection = Readonly<{
  publicationAttemptId: string;
  attemptSequence: number;
  startedAt: string;
  latestStatus: SocialPublicationLedgerPublicationStatus;
  terminalState: SocialPublicationLedgerTerminalState;
  latestOutcomeId: string | null;
  evidenceCount: number;
  computedOnly: true;
  authoritative: false;
}>;

export type SocialPublicationLedgerEvidenceAggregate = Readonly<{
  totalEvidenceCount: number;
  requestSummaryCount: number;
  resultSummaryCount: number;
  errorSummaryCount: number;
  operatorNoteCount: number;
  externalReferences: readonly string[];
  computedOnly: true;
  authoritative: false;
}>;

export type SocialPublicationLedgerReplaySummary = Readonly<{
  currentPublicationStatus: SocialPublicationLedgerPublicationStatus;
  currentTerminalState: SocialPublicationLedgerTerminalState;
  latestAttemptId: string | null;
  latestOutcomeId: string | null;
  latestSuccessfulPublicationId: string | null;
  latestSuccessfulPublicationUrl: string | null;
  latestFailureCode: string | null;
  pendingAttemptIds: readonly string[];
  cancelledAttemptIds: readonly string[];
  diagnosticCount: number;
  errorCount: number;
  computedOnly: true;
  authoritative: false;
  persistsNothing: true;
  publishesNothing: true;
  schedulesNothing: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
}>;

export type SocialPublicationLedgerReadModel = Readonly<{
  currentPublicationStatus: SocialPublicationLedgerPublicationStatus;
  currentTerminalState: SocialPublicationLedgerTerminalState;
  latestAttempt: SocialPublicationLedgerAttemptProjection | null;
  latestOutcome: SocialPublicationLedgerOutcomeRecord | null;
  latestSuccessfulOutcome: SocialPublicationLedgerOutcomeRecord | null;
  latestFailedOutcome: SocialPublicationLedgerOutcomeRecord | null;
  pendingAttempts: readonly SocialPublicationLedgerAttemptProjection[];
  cancelledAttempts: readonly SocialPublicationLedgerAttemptProjection[];
  evidenceSummary: SocialPublicationLedgerEvidenceAggregate;
  timeline: readonly SocialPublicationLedgerReplayTimelineEvent[];
  diagnostics: readonly SocialPublicationLedgerReplayDiagnostic[];
  summary: SocialPublicationLedgerReplaySummary;
  replayIntegrity: Readonly<{
    valid: boolean;
    deterministic: true;
    source: "publication_ledger_replay";
    computedOnly: true;
    authoritative: false;
  }>;
  computedOnly: true;
  authoritative: false;
  persistsNothing: true;
  publishesNothing: true;
  schedulesNothing: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
}>;

export type SocialPublicationLedgerReplayResult = Readonly<{
  ok: true;
  value: SocialPublicationLedgerReadModel;
}>;

type TimelineInput = Readonly<{
  kind: SocialPublicationLedgerReplayEventKind;
  recordedAt: string;
  ledgerEntryId: string;
  publicationAttemptId: string;
  outcomeId: string | null;
  evidenceId: string | null;
  eventType: string | null;
}>;

export function replaySocialPublicationLedger(
  model: SocialPublicationLedgerPersistenceModel,
): SocialPublicationLedgerReplayResult {
  const diagnostics = generateSocialPublicationLedgerReplayDiagnostics(model);
  const timeline = generateSocialPublicationLedgerReplayTimeline(model);
  const attempts = projectAttempts(model, diagnostics);
  const latestAttempt = attempts.at(-1) ?? null;
  const latestOutcome = latestByRecordedAt(model.outcomes);
  const latestSuccessfulOutcome = latestByRecordedAt(
    model.outcomes.filter(isSuccessfulOutcome),
  );
  const latestFailedOutcome = latestByRecordedAt(
    model.outcomes.filter(isFailedOutcome),
  );
  const evidenceSummary = aggregateSocialPublicationLedgerEvidence(model.evidence);
  const hasErrors = diagnostics.some((diagnostic) => diagnostic.severity === "error");
  const currentTerminalState = hasErrors
    ? "invalid"
    : latestAttempt?.terminalState ?? "none";
  const currentPublicationStatus = hasErrors
    ? "invalid"
    : latestAttempt?.latestStatus ?? "no_history";
  const summary = summarizeSocialPublicationLedgerReplay({
    currentPublicationStatus,
    currentTerminalState,
    latestAttempt,
    latestOutcome,
    latestSuccessfulOutcome,
    latestFailedOutcome,
    pendingAttempts: attempts.filter((attempt) => attempt.latestStatus === "attempted"),
    cancelledAttempts: attempts.filter(
      (attempt) => attempt.terminalState === "cancelled",
    ),
    evidenceSummary,
    diagnostics,
  });

  return {
    ok: true,
    value: immutableClone({
      currentPublicationStatus,
      currentTerminalState,
      latestAttempt,
      latestOutcome,
      latestSuccessfulOutcome,
      latestFailedOutcome,
      pendingAttempts: attempts.filter(
        (attempt) => attempt.latestStatus === "attempted",
      ),
      cancelledAttempts: attempts.filter(
        (attempt) => attempt.terminalState === "cancelled",
      ),
      evidenceSummary,
      timeline,
      diagnostics,
      summary,
      replayIntegrity: {
        valid: !hasErrors,
        deterministic: true,
        source: "publication_ledger_replay",
        computedOnly: true,
        authoritative: false,
      },
      computedOnly: true,
      authoritative: false,
      persistsNothing: true,
      publishesNothing: true,
      schedulesNothing: true,
      recordsNoMetrics: true,
      performsNoLearning: true,
    }),
  };
}

export function generateSocialPublicationLedgerReplayTimeline(
  model: SocialPublicationLedgerPersistenceModel,
): readonly SocialPublicationLedgerReplayTimelineEvent[] {
  const inputs: TimelineInput[] = [
    ...model.attempts.map((attempt) => ({
      kind: "attempt" as const,
      recordedAt: attempt.recorded_at,
      ledgerEntryId: attempt.ledger_entry_id,
      publicationAttemptId: attempt.publication_attempt_id,
      outcomeId: null,
      evidenceId: null,
      eventType: attempt.event_type,
    })),
    ...model.outcomes.map((outcome) => ({
      kind: "outcome" as const,
      recordedAt: outcome.recorded_at,
      ledgerEntryId: outcome.ledger_entry_id,
      publicationAttemptId: outcome.publication_attempt_id,
      outcomeId: outcome.outcome_id,
      evidenceId: null,
      eventType: outcome.event_type,
    })),
    ...model.evidence.map((evidence) => ({
      kind: "evidence" as const,
      recordedAt: evidence.recorded_at,
      ledgerEntryId: evidence.ledger_entry_id,
      publicationAttemptId: evidence.publication_attempt_id,
      outcomeId: evidence.outcome_id,
      evidenceId: evidence.evidence_id,
      eventType: null,
    })),
  ];

  return immutableClone(
    inputs
      .sort(compareTimelineInput)
      .map((event, index) => ({
        sequence: index + 1,
        ...event,
      })),
  );
}

export function aggregateSocialPublicationLedgerEvidence(
  evidence: readonly SocialPublicationLedgerEvidenceRecord[],
): SocialPublicationLedgerEvidenceAggregate {
  const externalReferences = evidence
    .map((record) => record.evidence_summary.externalReference)
    .filter((reference): reference is string => hasText(reference))
    .sort();

  return immutableClone({
    totalEvidenceCount: evidence.length,
    requestSummaryCount: countEvidenceKind(evidence, "request_summary"),
    resultSummaryCount: countEvidenceKind(evidence, "result_summary"),
    errorSummaryCount: countEvidenceKind(evidence, "error_summary"),
    operatorNoteCount: countEvidenceKind(evidence, "operator_note"),
    externalReferences,
    computedOnly: true,
    authoritative: false,
  });
}

export function generateSocialPublicationLedgerReplayDiagnostics(
  model: SocialPublicationLedgerPersistenceModel,
): readonly SocialPublicationLedgerReplayDiagnostic[] {
  const diagnostics: SocialPublicationLedgerReplayDiagnostic[] = [];
  const persistenceValidation = validateSocialPublicationLedgerPersistenceModel(model);

  if (!persistenceValidation.ok) {
    diagnostics.push(
      ...persistenceValidation.errors.map((error) =>
        diagnosticFromPersistenceError(error),
      ),
    );
  }

  detectDuplicateIdentities(model, diagnostics);
  detectAppendOnlyViolations(model, diagnostics);
  detectOrderingAndParents(model, diagnostics);
  detectImpossibleTransitions(model, diagnostics);
  detectOrphanAttempts(model, diagnostics);

  return immutableClone(sortDiagnostics(diagnostics));
}

export function verifySocialPublicationLedgerReplayConsistency(
  model: SocialPublicationLedgerPersistenceModel,
): Readonly<{
  valid: boolean;
  diagnosticCount: number;
  errorCount: number;
  deterministic: true;
  computedOnly: true;
  authoritative: false;
}> {
  const diagnostics = generateSocialPublicationLedgerReplayDiagnostics(model);
  const errorCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;

  return immutableClone({
    valid: errorCount === 0,
    diagnosticCount: diagnostics.length,
    errorCount,
    deterministic: true,
    computedOnly: true,
    authoritative: false,
  });
}

export function summarizeSocialPublicationLedgerReplay(input: {
  currentPublicationStatus: SocialPublicationLedgerPublicationStatus;
  currentTerminalState: SocialPublicationLedgerTerminalState;
  latestAttempt: SocialPublicationLedgerAttemptProjection | null;
  latestOutcome: SocialPublicationLedgerOutcomeRecord | null;
  latestSuccessfulOutcome: SocialPublicationLedgerOutcomeRecord | null;
  latestFailedOutcome: SocialPublicationLedgerOutcomeRecord | null;
  pendingAttempts: readonly SocialPublicationLedgerAttemptProjection[];
  cancelledAttempts: readonly SocialPublicationLedgerAttemptProjection[];
  evidenceSummary: SocialPublicationLedgerEvidenceAggregate;
  diagnostics: readonly SocialPublicationLedgerReplayDiagnostic[];
}): SocialPublicationLedgerReplaySummary {
  const errorCount = input.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;

  return immutableClone({
    currentPublicationStatus: input.currentPublicationStatus,
    currentTerminalState: input.currentTerminalState,
    latestAttemptId: input.latestAttempt?.publicationAttemptId ?? null,
    latestOutcomeId: input.latestOutcome?.outcome_id ?? null,
    latestSuccessfulPublicationId:
      input.latestSuccessfulOutcome?.result_summary?.externalPublicationId ?? null,
    latestSuccessfulPublicationUrl:
      input.latestSuccessfulOutcome?.result_summary?.externalUrl ?? null,
    latestFailureCode:
      input.latestFailedOutcome?.error_summary?.errorCode ?? null,
    pendingAttemptIds: input.pendingAttempts.map(
      (attempt) => attempt.publicationAttemptId,
    ),
    cancelledAttemptIds: input.cancelledAttempts.map(
      (attempt) => attempt.publicationAttemptId,
    ),
    diagnosticCount: input.diagnostics.length,
    errorCount,
    computedOnly: true,
    authoritative: false,
    persistsNothing: true,
    publishesNothing: true,
    schedulesNothing: true,
    recordsNoMetrics: true,
    performsNoLearning: true,
  });
}

function projectAttempts(
  model: SocialPublicationLedgerPersistenceModel,
  diagnostics: readonly SocialPublicationLedgerReplayDiagnostic[],
): readonly SocialPublicationLedgerAttemptProjection[] {
  const hasErrors = diagnostics.some((diagnostic) => diagnostic.severity === "error");

  return immutableClone(
    [...model.attempts]
      .sort(compareAttempts)
      .map((attempt) => {
        const outcomes = model.outcomes
          .filter(
            (outcome) =>
              outcome.publication_attempt_id === attempt.publication_attempt_id,
          )
          .sort(compareOutcomes);
        const latestOutcome = outcomes.at(-1) ?? null;
        const status = hasErrors
          ? "invalid"
          : statusFromOutcome(latestOutcome) ?? "attempted";
        const evidenceCount = model.evidence.filter(
          (evidence) =>
            evidence.publication_attempt_id === attempt.publication_attempt_id,
        ).length;

        return {
          publicationAttemptId: attempt.publication_attempt_id,
          attemptSequence: attempt.attempt_sequence,
          startedAt: attempt.recorded_at,
          latestStatus: status,
          terminalState: terminalStateFromStatus(status),
          latestOutcomeId: latestOutcome?.outcome_id ?? null,
          evidenceCount,
          computedOnly: true,
          authoritative: false,
        };
      }),
  );
}

function detectDuplicateIdentities(
  model: SocialPublicationLedgerPersistenceModel,
  diagnostics: SocialPublicationLedgerReplayDiagnostic[],
): void {
  detectDuplicateValues(
    model.attempts.map((attempt) => [
      attempt.publication_attempt_id,
      `attempts.${attempt.publication_attempt_id}`,
    ] as const),
    "duplicate publication attempt identity",
    diagnostics,
  );
  detectDuplicateValues(
    model.outcomes.map((outcome) => [
      outcome.outcome_id,
      `outcomes.${outcome.outcome_id}`,
    ] as const),
    "duplicate outcome identity",
    diagnostics,
  );
  detectDuplicateValues(
    model.evidence.map((evidence) => [
      evidence.evidence_id,
      `evidence.${evidence.evidence_id}`,
    ] as const),
    "duplicate evidence identity",
    diagnostics,
  );
  detectDuplicateValues(
    [
      ...model.attempts.map((attempt) => [
        attempt.ledger_entry_id,
        `attempts.${attempt.ledger_entry_id}`,
      ] as const),
      ...model.outcomes.map((outcome) => [
        outcome.ledger_entry_id,
        `outcomes.${outcome.ledger_entry_id}`,
      ] as const),
    ],
    "duplicate ledger entry identity",
    diagnostics,
  );
}

function detectDuplicateValues(
  values: readonly (readonly [string, string])[],
  message: string,
  diagnostics: SocialPublicationLedgerReplayDiagnostic[],
): void {
  const seen = new Set<string>();

  for (const [value, path] of values) {
    if (seen.has(value)) {
      diagnostics.push(
        replayDiagnostic("duplicate_identity", path, message, "error"),
      );
    }
    seen.add(value);
  }
}

function detectAppendOnlyViolations(
  model: SocialPublicationLedgerPersistenceModel,
  diagnostics: SocialPublicationLedgerReplayDiagnostic[],
): void {
  const records = [
    ...model.attempts.map((record) => ["attempts", record] as const),
    ...model.outcomes.map((record) => ["outcomes", record] as const),
    ...model.evidence.map((record) => ["evidence", record] as const),
  ];

  for (const [path, record] of records) {
    if (record.append_only !== true || record.immutable !== true) {
      diagnostics.push(
        replayDiagnostic(
          "append_only_violation",
          path,
          "Replay can only read immutable append-only ledger records.",
          "error",
        ),
      );
    }
  }
}

function detectOrderingAndParents(
  model: SocialPublicationLedgerPersistenceModel,
  diagnostics: SocialPublicationLedgerReplayDiagnostic[],
): void {
  const attemptsById = new Map(
    model.attempts.map((attempt) => [attempt.publication_attempt_id, attempt]),
  );
  const outcomesById = new Map(
    model.outcomes.map((outcome) => [outcome.outcome_id, outcome]),
  );

  for (const outcome of model.outcomes) {
    const attempt = attemptsById.get(outcome.publication_attempt_id);
    if (!attempt) {
      diagnostics.push(
        replayDiagnostic(
          "orphan_outcome",
          `outcomes.${outcome.outcome_id}`,
          "Outcome record has no parent attempt.",
          "error",
        ),
      );
      diagnostics.push(
        replayDiagnostic(
          "missing_parent",
          `outcomes.${outcome.outcome_id}.publication_attempt_id`,
          "Outcome parent attempt is missing.",
          "error",
        ),
      );
    } else if (compareIsoText(outcome.recorded_at, attempt.recorded_at) < 0) {
      diagnostics.push(
        replayDiagnostic(
          "invalid_ordering",
          `outcomes.${outcome.outcome_id}.recorded_at`,
          "Outcome cannot be recorded before its parent attempt.",
          "error",
        ),
      );
    }
  }

  for (const evidence of model.evidence) {
    const attempt = attemptsById.get(evidence.publication_attempt_id);
    if (!attempt) {
      diagnostics.push(
        replayDiagnostic(
          "orphan_evidence",
          `evidence.${evidence.evidence_id}`,
          "Evidence record has no parent attempt.",
          "error",
        ),
      );
      diagnostics.push(
        replayDiagnostic(
          "missing_parent",
          `evidence.${evidence.evidence_id}.publication_attempt_id`,
          "Evidence parent attempt is missing.",
          "error",
        ),
      );
    } else if (compareIsoText(evidence.recorded_at, attempt.recorded_at) < 0) {
      diagnostics.push(
        replayDiagnostic(
          "invalid_ordering",
          `evidence.${evidence.evidence_id}.recorded_at`,
          "Evidence cannot be recorded before its parent attempt.",
          "error",
        ),
      );
    }

    if (evidence.outcome_id) {
      const outcome = outcomesById.get(evidence.outcome_id);
      if (!outcome) {
        diagnostics.push(
          replayDiagnostic(
            "orphan_evidence",
            `evidence.${evidence.evidence_id}.outcome_id`,
            "Evidence references a missing outcome.",
            "error",
          ),
        );
      } else if (compareIsoText(evidence.recorded_at, outcome.recorded_at) < 0) {
        diagnostics.push(
          replayDiagnostic(
            "invalid_ordering",
            `evidence.${evidence.evidence_id}.recorded_at`,
            "Evidence cannot be recorded before its referenced outcome.",
            "error",
          ),
        );
      }
    }
  }
}

function detectImpossibleTransitions(
  model: SocialPublicationLedgerPersistenceModel,
  diagnostics: SocialPublicationLedgerReplayDiagnostic[],
): void {
  const terminalOutcomeCounts = new Map<string, number>();

  for (const outcome of model.outcomes) {
    if (!isTerminalOutcome(outcome)) continue;

    const current = terminalOutcomeCounts.get(outcome.publication_attempt_id) ?? 0;
    terminalOutcomeCounts.set(outcome.publication_attempt_id, current + 1);
  }

  for (const [attemptId, count] of terminalOutcomeCounts) {
    if (count > 1) {
      diagnostics.push(
        replayDiagnostic(
          "impossible_transition",
          `attempts.${attemptId}`,
          "A single publication attempt cannot have multiple terminal outcomes.",
          "error",
        ),
      );
    }
  }
}

function detectOrphanAttempts(
  model: SocialPublicationLedgerPersistenceModel,
  diagnostics: SocialPublicationLedgerReplayDiagnostic[],
): void {
  const orderedAttempts = [...model.attempts].sort(compareAttempts);
  const retryRequestedSequences = new Set(
    model.outcomes
      .filter((outcome) => outcome.event_type === "publication_attempt_retry_requested")
      .map((outcome) => outcome.attempt_sequence + 1),
  );

  for (const attempt of orderedAttempts) {
    if (
      attempt.event_type === "publication_attempt_retry_started" &&
      !retryRequestedSequences.has(attempt.attempt_sequence)
    ) {
      diagnostics.push(
        replayDiagnostic(
          "orphan_attempt",
          `attempts.${attempt.publication_attempt_id}`,
          "Retry attempt has no preceding retry request outcome.",
          "warning",
        ),
      );
    }
  }
}

function diagnosticFromPersistenceError(
  error: SocialPublicationLedgerPersistenceError,
): SocialPublicationLedgerReplayDiagnostic {
  const code =
    error.code === "identity_not_separated"
      ? "duplicate_identity"
      : error.code === "append_only_invariant_failed"
        ? "append_only_violation"
        : error.code === "relationship_invalid"
          ? "missing_parent"
          : "persistence_validation_failed";

  return replayDiagnostic(code, error.path, error.message, "error");
}

function statusFromOutcome(
  outcome: SocialPublicationLedgerOutcomeRecord | null,
): SocialPublicationLedgerPublicationStatus | null {
  if (!outcome) return null;

  if (
    outcome.event_type === "publication_attempt_succeeded" ||
    outcome.event_type === "publication_attempt_retry_succeeded"
  ) {
    return "succeeded";
  }

  if (
    outcome.event_type === "publication_attempt_failed" ||
    outcome.event_type === "publication_attempt_retry_failed"
  ) {
    return "failed";
  }

  if (outcome.event_type === "publication_attempt_cancelled") {
    return "cancelled";
  }

  if (outcome.event_type === "publication_attempt_retry_requested") {
    return "retry_requested";
  }

  return null;
}

function terminalStateFromStatus(
  status: SocialPublicationLedgerPublicationStatus,
): SocialPublicationLedgerTerminalState {
  if (status === "succeeded" || status === "failed" || status === "cancelled") {
    return status;
  }
  if (status === "invalid") return "invalid";
  return "none";
}

function isTerminalOutcome(outcome: SocialPublicationLedgerOutcomeRecord): boolean {
  return terminalStateFromStatus(statusFromOutcome(outcome) ?? "attempted") !== "none";
}

function isSuccessfulOutcome(outcome: SocialPublicationLedgerOutcomeRecord): boolean {
  return statusFromOutcome(outcome) === "succeeded";
}

function isFailedOutcome(outcome: SocialPublicationLedgerOutcomeRecord): boolean {
  return statusFromOutcome(outcome) === "failed";
}

function latestByRecordedAt<T extends { readonly recorded_at: string }>(
  records: readonly T[],
): T | null {
  return [...records].sort((left, right) =>
    compareIsoText(left.recorded_at, right.recorded_at),
  ).at(-1) ?? null;
}

function countEvidenceKind(
  evidence: readonly SocialPublicationLedgerEvidenceRecord[],
  kind: SocialPublicationLedgerEvidenceRecord["evidence_summary"]["evidenceKind"],
): number {
  return evidence.filter((record) => record.evidence_summary.evidenceKind === kind)
    .length;
}

function compareTimelineInput(left: TimelineInput, right: TimelineInput): number {
  return (
    compareIsoText(left.recordedAt, right.recordedAt) ||
    kindOrder(left.kind) - kindOrder(right.kind) ||
    left.publicationAttemptId.localeCompare(right.publicationAttemptId) ||
    (left.outcomeId ?? "").localeCompare(right.outcomeId ?? "") ||
    (left.evidenceId ?? "").localeCompare(right.evidenceId ?? "") ||
    left.ledgerEntryId.localeCompare(right.ledgerEntryId)
  );
}

function compareAttempts(
  left: SocialPublicationLedgerAttemptRecord,
  right: SocialPublicationLedgerAttemptRecord,
): number {
  return (
    left.attempt_sequence - right.attempt_sequence ||
    compareIsoText(left.recorded_at, right.recorded_at) ||
    left.publication_attempt_id.localeCompare(right.publication_attempt_id)
  );
}

function compareOutcomes(
  left: SocialPublicationLedgerOutcomeRecord,
  right: SocialPublicationLedgerOutcomeRecord,
): number {
  return (
    compareIsoText(left.recorded_at, right.recorded_at) ||
    left.outcome_id.localeCompare(right.outcome_id)
  );
}

function compareIsoText(left: string, right: string): number {
  return left.localeCompare(right);
}

function kindOrder(kind: SocialPublicationLedgerReplayEventKind): number {
  if (kind === "attempt") return 0;
  if (kind === "outcome") return 1;
  return 2;
}

function sortDiagnostics(
  diagnostics: readonly SocialPublicationLedgerReplayDiagnostic[],
): readonly SocialPublicationLedgerReplayDiagnostic[] {
  return [...diagnostics].sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message),
  );
}

function replayDiagnostic(
  code: SocialPublicationLedgerReplayDiagnosticCode,
  path: string,
  message: string,
  severity: "error" | "warning",
): SocialPublicationLedgerReplayDiagnostic {
  return { code, path, message, severity };
}

function immutableClone<T>(value: T): T {
  return deepFreeze(JSON.parse(JSON.stringify(value)) as T);
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
