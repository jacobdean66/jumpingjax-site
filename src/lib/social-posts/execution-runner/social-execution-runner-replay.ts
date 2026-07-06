import type { SocialExecutionAuthorizationPersistenceSnapshot } from "../execution-authorization/social-execution-authorization-store";
import type { SocialExecutionAttemptEvidencePersistenceSnapshot } from "../execution-attempt/social-execution-attempt-evidence-store";
import type { SocialExecutionAttemptPersistenceSnapshot } from "../execution-attempt/social-execution-attempt-store";
import type { PublicationTargetDefinition } from "../social-publication-targets";
import {
  SOCIAL_EXECUTION_RUNNER_VERSION,
  validateExecutionRunnerTranscriptRecord,
} from "./social-execution-runner-domain";
import {
  evaluateExecutionRunnerPreflight,
  type SocialExecutionRunnerPreflightSummary,
} from "./social-execution-runner-preflight";
import {
  EMPTY_SOCIAL_EXECUTION_RUNNER_PERSISTENCE_SNAPSHOT,
  loadSocialExecutionRunnerSnapshot,
  type SocialExecutionRunnerPersistenceSnapshot,
} from "./social-execution-runner-store";

export const SOCIAL_EXECUTION_RUNNER_REPLAY_VERSION = SOCIAL_EXECUTION_RUNNER_VERSION;

export type SocialExecutionRunnerReplayDiagnostic = Readonly<{
  code: string;
  severity: "info" | "warning" | "error";
  path: string;
  message: string;
}>;

export type SocialExecutionRunnerReplaySummary = Readonly<{
  replayVersion: typeof SOCIAL_EXECUTION_RUNNER_REPLAY_VERSION;
  transcriptCount: number;
  simulatedTranscriptCount: number;
  blockedTranscriptCount: number;
  validationFailedTranscriptCount: number;
  auditEventCount: number;
}>;

export type SocialExecutionRunnerReplayProjection = Readonly<{
  transcriptId: string;
  attemptId: string;
  authorizationId: string;
  executionIntentId: string;
  publicationTargetId: string;
  correlationId: string;
  platform: string;
  outcomeStatus: string;
  sanitizedSummary: string;
  blockingCodeCount: number;
  recordedAt: string;
  hasSimulation: boolean;
}>;

export type SocialExecutionRunnerReplayResult = Readonly<{
  replayVersion: typeof SOCIAL_EXECUTION_RUNNER_REPLAY_VERSION;
  summary: SocialExecutionRunnerReplaySummary;
  preflight: SocialExecutionRunnerPreflightSummary | null;
  transcripts: readonly SocialExecutionRunnerReplayProjection[];
  recentAuditEvents: readonly {
    auditEventId: string;
    transcriptId: string | null;
    attemptId: string | null;
    correlationId: string | null;
    action: string;
    outcome: string;
    sanitizedDetail: string;
    createdAt: string;
  }[];
  diagnostics: readonly SocialExecutionRunnerReplayDiagnostic[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export async function replaySocialExecutionRunner(input: {
  attemptId?: string | null;
  attemptSnapshot?: SocialExecutionAttemptPersistenceSnapshot;
  authorizationSnapshot?: SocialExecutionAuthorizationPersistenceSnapshot;
  evidenceSnapshot?: SocialExecutionAttemptEvidencePersistenceSnapshot;
  publicationTarget?: PublicationTargetDefinition | null;
  runnerSnapshot?: SocialExecutionRunnerPersistenceSnapshot;
  now?: Date;
  ownerApprovalVerification?: Readonly<{
    status: "verified" | "not_verified" | "missing_reference";
    code: string | null;
  }> | null;
} = {}): Promise<SocialExecutionRunnerReplayResult> {
  const runnerSnapshot =
    input.runnerSnapshot ?? (await loadSocialExecutionRunnerSnapshot());
  const diagnostics: SocialExecutionRunnerReplayDiagnostic[] = [];

  for (const [index, record] of runnerSnapshot.transcripts.entries()) {
    const validation = validateExecutionRunnerTranscriptRecord(record, `transcripts.${index}`);
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

  const filteredTranscripts = hasText(input.attemptId)
    ? runnerSnapshot.transcripts.filter((record) => record.attemptId === input.attemptId)
    : runnerSnapshot.transcripts;

  const preflight = hasText(input.attemptId)
    ? evaluateExecutionRunnerPreflight({
        attemptId: input.attemptId,
        attemptSnapshot: input.attemptSnapshot,
        authorizationSnapshot: input.authorizationSnapshot,
        evidenceSnapshot: input.evidenceSnapshot,
        publicationTarget: input.publicationTarget ?? null,
        now: input.now,
        ownerApprovalVerification: input.ownerApprovalVerification ?? null,
      })
    : null;

  const transcripts = filteredTranscripts.map((record) => ({
    transcriptId: record.transcriptId,
    attemptId: record.attemptId,
    authorizationId: record.authorizationId,
    executionIntentId: record.executionIntentId,
    publicationTargetId: record.publicationTargetId,
    correlationId: record.correlationId,
    platform: record.platform,
    outcomeStatus: record.outcomeStatus,
    sanitizedSummary: record.sanitizedSummary,
    blockingCodeCount: record.blockingCodes.length,
    recordedAt: record.recordedAt,
    hasSimulation: record.simulation !== null,
  }));

  const recentAuditEvents = runnerSnapshot.auditEvents
    .filter((event) => !hasText(input.attemptId) || event.attemptId === input.attemptId)
    .slice(0, 20)
    .map((event) => ({
      auditEventId: event.auditEventId,
      transcriptId: event.transcriptId,
      attemptId: event.attemptId,
      correlationId: event.correlationId,
      action: event.action,
      outcome: event.outcome,
      sanitizedDetail: event.sanitizedDetail,
      createdAt: event.createdAt,
    }));

  return {
    replayVersion: SOCIAL_EXECUTION_RUNNER_REPLAY_VERSION,
    summary: {
      replayVersion: SOCIAL_EXECUTION_RUNNER_REPLAY_VERSION,
      transcriptCount: filteredTranscripts.length,
      simulatedTranscriptCount: filteredTranscripts.filter(
        (record) => record.outcomeStatus === "simulated",
      ).length,
      blockedTranscriptCount: filteredTranscripts.filter(
        (record) => record.outcomeStatus === "blocked",
      ).length,
      validationFailedTranscriptCount: filteredTranscripts.filter(
        (record) => record.outcomeStatus === "validation_failed",
      ).length,
      auditEventCount: recentAuditEvents.length,
    },
    preflight,
    transcripts,
    recentAuditEvents,
    diagnostics,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

export async function previewDryExecutionRunnerTranscript(input: {
  attemptId: string;
  attemptSnapshot: SocialExecutionAttemptPersistenceSnapshot;
  authorizationSnapshot: SocialExecutionAuthorizationPersistenceSnapshot;
  evidenceSnapshot: SocialExecutionAttemptEvidencePersistenceSnapshot;
  publicationTarget: PublicationTargetDefinition | null;
  now?: Date;
  ownerApprovalVerification?: Readonly<{
    status: "verified" | "not_verified" | "missing_reference";
    code: string | null;
  }> | null;
}): Promise<SocialExecutionRunnerReplayResult> {
  const { executeDryRunExecutionRunner } = await import("./social-execution-runner-service");
  await executeDryRunExecutionRunner({
    ...input,
    persist: false,
  });

  return replaySocialExecutionRunner({
    attemptId: input.attemptId,
    attemptSnapshot: input.attemptSnapshot,
    authorizationSnapshot: input.authorizationSnapshot,
    evidenceSnapshot: input.evidenceSnapshot,
    publicationTarget: input.publicationTarget,
    runnerSnapshot: EMPTY_SOCIAL_EXECUTION_RUNNER_PERSISTENCE_SNAPSHOT,
    now: input.now,
    ownerApprovalVerification: input.ownerApprovalVerification ?? null,
  });
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
