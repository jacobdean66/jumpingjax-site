import { SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_APPEND_SERVICE_VERSION } from "./social-execution-attempt-evidence-service";
import {
  loadSocialExecutionAttemptEvidenceSnapshot,
  type SocialExecutionAttemptEvidencePersistenceSnapshot,
} from "./social-execution-attempt-evidence-store";
import {
  loadSocialExecutionAttemptSnapshot,
  type SocialExecutionAttemptPersistenceSnapshot,
} from "./social-execution-attempt-store";

export const SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_APPEND_REPLAY_VERSION =
  SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_APPEND_SERVICE_VERSION;

export type SocialExecutionAttemptEvidenceAppendReplayProjection = Readonly<{
  evidenceId: string;
  attemptId: string;
  correlationId: string;
  transitionId: string | null;
  evidenceKind: string;
  sanitizedSummary: string;
  recordedAt: string;
  recordedByActor: string;
  recordedSource: string;
  appendAuditEventId: string | null;
  appendOutcome: string | null;
  appendDetail: string | null;
}>;

export type SocialExecutionAttemptEvidenceAppendReplaySummary = Readonly<{
  replayVersion: typeof SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_APPEND_REPLAY_VERSION;
  appendedEvidenceCount: number;
  successfulAppendCount: number;
  failedAppendCount: number;
  transitionAppendCount: number;
  auditEventCount: number;
}>;

export type SocialExecutionAttemptEvidenceAppendReplayResult = Readonly<{
  replayVersion: typeof SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_APPEND_REPLAY_VERSION;
  summary: SocialExecutionAttemptEvidenceAppendReplaySummary;
  appendedEvidence: readonly SocialExecutionAttemptEvidenceAppendReplayProjection[];
  recentAppendAuditEvents: readonly {
    auditEventId: string;
    attemptId: string | null;
    correlationId: string | null;
    action: string;
    outcome: string;
    sanitizedDetail: string;
    createdAt: string;
  }[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export async function replaySocialExecutionAttemptEvidenceAppend(input: {
  attemptSnapshot?: SocialExecutionAttemptPersistenceSnapshot | null;
  evidenceSnapshot?: SocialExecutionAttemptEvidencePersistenceSnapshot | null;
} = {}): Promise<SocialExecutionAttemptEvidenceAppendReplayResult> {
  const attemptPersistence =
    input.attemptSnapshot ?? (await loadSocialExecutionAttemptSnapshot());
  const evidencePersistence =
    input.evidenceSnapshot ?? (await loadSocialExecutionAttemptEvidenceSnapshot());

  const appendAuditEvents = attemptPersistence.auditEvents.filter(
    (event) =>
      event.action === "append_evidence" || event.action === "append_evidence_validation_failed",
  );

  const appendAuditByAttemptId = new Map<
    string,
    (typeof attemptPersistence.auditEvents)[number]
  >();
  for (const event of appendAuditEvents) {
    if (event.action !== "append_evidence" || !event.attempt_id) continue;
    const existing = appendAuditByAttemptId.get(event.attempt_id);
    if (!existing || event.created_at > existing.created_at) {
      appendAuditByAttemptId.set(event.attempt_id, event);
    }
  }

  const manualEvidence = evidencePersistence.evidenceRecords.filter(
    (record) => record.recordedSource === "manual_admin" && record.recordedByActor === "owner",
  );

  const appendedEvidence = manualEvidence.map((record) => {
    const audit = appendAuditByAttemptId.get(record.attemptId) ?? null;
    return {
      evidenceId: record.evidenceId,
      attemptId: record.attemptId,
      correlationId: record.correlationId,
      transitionId: record.transitionId,
      evidenceKind: record.evidenceKind,
      sanitizedSummary: record.sanitizedSummary,
      recordedAt: record.recordedAt,
      recordedByActor: record.recordedByActor,
      recordedSource: record.recordedSource,
      appendAuditEventId: audit?.audit_event_id ?? null,
      appendOutcome: audit?.outcome ?? null,
      appendDetail: audit?.sanitized_detail ?? null,
    } satisfies SocialExecutionAttemptEvidenceAppendReplayProjection;
  });

  const transitionAppendCount = appendedEvidence.filter(
    (record) => record.transitionId !== null,
  ).length;

  return {
    replayVersion: SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_APPEND_REPLAY_VERSION,
    summary: {
      replayVersion: SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_APPEND_REPLAY_VERSION,
      appendedEvidenceCount: appendedEvidence.length,
      successfulAppendCount: appendAuditEvents.filter(
        (event) => event.action === "append_evidence" && event.outcome === "success",
      ).length,
      failedAppendCount: appendAuditEvents.filter((event) => event.outcome !== "success").length,
      transitionAppendCount,
      auditEventCount: appendAuditEvents.length,
    },
    appendedEvidence,
    recentAppendAuditEvents: appendAuditEvents.slice(0, 20).map((event) => ({
      auditEventId: event.audit_event_id,
      attemptId: event.attempt_id,
      correlationId: event.correlation_id,
      action: event.action,
      outcome: event.outcome,
      sanitizedDetail: event.sanitized_detail,
      createdAt: event.created_at,
    })),
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}
