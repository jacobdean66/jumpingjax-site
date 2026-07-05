import type { SocialExecutionAuthorizationPersistenceSnapshot } from "../execution-authorization/social-execution-authorization-store";
import { SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VERSION } from "./social-execution-attempt-evidence-domain";
import { validateExecutionAttemptEvidenceRecord } from "./social-execution-attempt-evidence-domain";
import {
  EMPTY_SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_PERSISTENCE_SNAPSHOT,
  loadSocialExecutionAttemptEvidenceSnapshot,
  type SocialExecutionAttemptEvidencePersistenceSnapshot,
} from "./social-execution-attempt-evidence-store";
import type { SocialExecutionAttemptPersistenceSnapshot } from "./social-execution-attempt-store";
import { EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT } from "./social-execution-attempt-store";
import {
  deriveExecutionAttemptCompositeStates,
  type SocialExecutionAttemptDerivedStateProjection,
} from "./social-execution-attempt-state-domain";
import {
  SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_VERSION,
  validateExecutionAttemptStateTransitionRecord,
  validateExecutionAttemptStateTransitionSequence,
} from "./social-execution-attempt-state-transition-domain";

export const SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_REPLAY_VERSION =
  SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VERSION;

export type SocialExecutionAttemptEvidenceReplaySummary = Readonly<{
  replayVersion: typeof SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_REPLAY_VERSION;
  evidenceCount: number;
  transitionCount: number;
  attemptCountWithEvidence: number;
  attemptCountWithTransitions: number;
  evidenceAlignedAttemptCount: number;
  evidenceGapDetectedCount: number;
}>;

export type SocialExecutionAttemptEvidenceReplayDiagnostic = Readonly<{
  code: string;
  severity: "info" | "warning" | "error";
  path: string;
  message: string;
}>;

export type SocialExecutionAttemptEvidenceReplayResult = Readonly<{
  replayVersion: typeof SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_REPLAY_VERSION;
  summary: SocialExecutionAttemptEvidenceReplaySummary;
  evidenceRecords: readonly {
    evidenceId: string;
    attemptId: string;
    correlationId: string;
    transitionId: string | null;
    evidenceKind: string;
    sanitizedSummary: string;
    recordedAt: string;
    recordedByActor: string;
    recordedSource: string;
  }[];
  stateTransitions: readonly {
    transitionId: string;
    attemptId: string;
    correlationId: string;
    fromState: string;
    toState: string;
    transitionKind: string;
    evidenceId: string | null;
    createdAt: string;
  }[];
  derivedAttemptStates: readonly SocialExecutionAttemptDerivedStateProjection[];
  diagnostics: readonly SocialExecutionAttemptEvidenceReplayDiagnostic[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export async function replaySocialExecutionAttemptEvidence(input: {
  attemptSnapshot?: SocialExecutionAttemptPersistenceSnapshot | null;
  evidenceSnapshot?: SocialExecutionAttemptEvidencePersistenceSnapshot | null;
  authorizationSnapshot?: SocialExecutionAuthorizationPersistenceSnapshot;
  now?: Date;
} = {}): Promise<SocialExecutionAttemptEvidenceReplayResult> {
  const attemptPersistence =
    input.attemptSnapshot ?? EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT;
  const evidencePersistence =
    input.evidenceSnapshot ?? (await loadSocialExecutionAttemptEvidenceSnapshot());
  const diagnostics: SocialExecutionAttemptEvidenceReplayDiagnostic[] = [];

  for (const [index, record] of evidencePersistence.evidenceRecords.entries()) {
    const validation = validateExecutionAttemptEvidenceRecord(record, `evidenceRecords.${index}`);
    if (!validation.ok) {
      for (const error of validation.errors) {
        diagnostics.push({
          code: error.code,
          severity: "error",
          path: error.path,
          message: error.message,
        });
      }
    }
  }

  for (const [index, record] of evidencePersistence.stateTransitions.entries()) {
    const validation = validateExecutionAttemptStateTransitionRecord(
      record,
      `stateTransitions.${index}`,
    );
    if (!validation.ok) {
      for (const error of validation.errors) {
        diagnostics.push({
          code: error.code,
          severity: "error",
          path: error.path,
          message: error.message,
        });
      }
    }
  }

  const transitionsByAttempt = new Map<string, (typeof evidencePersistence.stateTransitions)[number][]>();
  for (const transition of evidencePersistence.stateTransitions) {
    const current = transitionsByAttempt.get(transition.attemptId) ?? [];
    current.push(transition);
    transitionsByAttempt.set(transition.attemptId, current);
  }

  for (const [attemptId, transitions] of transitionsByAttempt.entries()) {
    for (const error of validateExecutionAttemptStateTransitionSequence(transitions)) {
      diagnostics.push({
        code: error.code,
        severity: "error",
        path: `stateTransitions.${attemptId}`,
        message: error.message,
      });
    }
  }

  const derivedAttemptStates = deriveExecutionAttemptCompositeStates({
    attempts: attemptPersistence.attempts,
    lifecycleEvents: attemptPersistence.lifecycleEvents,
    evidenceRecords: evidencePersistence.evidenceRecords,
    stateTransitions: evidencePersistence.stateTransitions,
    authorizationSnapshot: input.authorizationSnapshot,
    now: input.now,
  });

  for (const projection of derivedAttemptStates) {
    diagnostics.push({
      code: `evidence_coverage_${projection.evidenceCoverageStatus}`,
      severity:
        projection.evidenceCoverageStatus === "evidence_gap_detected" ? "warning" : "info",
      path: `d16.w8.attempt.${projection.attemptId}`,
      message: `Execution attempt evidence coverage is ${projection.evidenceCoverageStatus} for ${projection.attemptId}.`,
    });
  }

  const attemptIdsWithEvidence = new Set(
    evidencePersistence.evidenceRecords.map((record) => record.attemptId),
  );
  const attemptIdsWithTransitions = new Set(
    evidencePersistence.stateTransitions.map((record) => record.attemptId),
  );

  const summary: SocialExecutionAttemptEvidenceReplaySummary = {
    replayVersion: SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_REPLAY_VERSION,
    evidenceCount: evidencePersistence.evidenceRecords.length,
    transitionCount: evidencePersistence.stateTransitions.length,
    attemptCountWithEvidence: attemptIdsWithEvidence.size,
    attemptCountWithTransitions: attemptIdsWithTransitions.size,
    evidenceAlignedAttemptCount: derivedAttemptStates.filter((record) => record.evidenceAligned).length,
    evidenceGapDetectedCount: derivedAttemptStates.filter(
      (record) => record.evidenceCoverageStatus === "evidence_gap_detected",
    ).length,
  };

  return {
    replayVersion: SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_REPLAY_VERSION,
    summary,
    evidenceRecords: evidencePersistence.evidenceRecords.map((record) => ({
      evidenceId: record.evidenceId,
      attemptId: record.attemptId,
      correlationId: record.correlationId,
      transitionId: record.transitionId,
      evidenceKind: record.evidenceKind,
      sanitizedSummary: record.sanitizedSummary,
      recordedAt: record.recordedAt,
      recordedByActor: record.recordedByActor,
      recordedSource: record.recordedSource,
    })),
    stateTransitions: evidencePersistence.stateTransitions.map((record) => ({
      transitionId: record.transitionId,
      attemptId: record.attemptId,
      correlationId: record.correlationId,
      fromState: record.fromState,
      toState: record.toState,
      transitionKind: record.transitionKind,
      evidenceId: record.evidenceId,
      createdAt: record.createdAt,
    })),
    derivedAttemptStates,
    diagnostics,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

export function replaySocialExecutionAttemptEvidenceByCorrelationId(
  correlationId: string,
  evidenceSnapshot: SocialExecutionAttemptEvidencePersistenceSnapshot = EMPTY_SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_PERSISTENCE_SNAPSHOT,
): Readonly<{
  correlationId: string;
  evidenceRecords: SocialExecutionAttemptEvidenceReplayResult["evidenceRecords"];
  stateTransitions: SocialExecutionAttemptEvidenceReplayResult["stateTransitions"];
}> {
  return {
    correlationId,
    evidenceRecords: evidenceSnapshot.evidenceRecords
      .filter((record) => record.correlationId === correlationId)
      .map((record) => ({
        evidenceId: record.evidenceId,
        attemptId: record.attemptId,
        correlationId: record.correlationId,
        transitionId: record.transitionId,
        evidenceKind: record.evidenceKind,
        sanitizedSummary: record.sanitizedSummary,
        recordedAt: record.recordedAt,
        recordedByActor: record.recordedByActor,
        recordedSource: record.recordedSource,
      })),
    stateTransitions: evidenceSnapshot.stateTransitions
      .filter((record) => record.correlationId === correlationId)
      .map((record) => ({
        transitionId: record.transitionId,
        attemptId: record.attemptId,
        correlationId: record.correlationId,
        fromState: record.fromState,
        toState: record.toState,
        transitionKind: record.transitionKind,
        evidenceId: record.evidenceId,
        createdAt: record.createdAt,
      })),
  };
}

export const SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_REPLAY_VERSION =
  SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_VERSION;
