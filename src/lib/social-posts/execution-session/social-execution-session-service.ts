import { randomUUID } from "node:crypto";

import type { SocialExecutionAuthorizationPersistenceSnapshot } from "../execution-authorization/social-execution-authorization-store";
import type { SocialExecutionAttemptEvidencePersistenceSnapshot } from "../execution-attempt/social-execution-attempt-evidence-store";
import type { SocialExecutionAttemptPersistenceSnapshot } from "../execution-attempt/social-execution-attempt-store";
import type { SocialExecutionRunnerTranscriptRecord } from "../execution-runner/social-execution-runner-domain";
import { executeDryRunExecutionRunner } from "../execution-runner/social-execution-runner-service";
import type { PublicationTargetDefinition } from "../social-publication-targets";
import {
  SOCIAL_EXECUTION_SESSION_VERSION,
  deriveExecutionSessionSummaryStatus,
  validateExecutionSessionRecord,
  type SocialExecutionSessionRecord,
  type SocialExecutionSessionSummaryStatus,
} from "./social-execution-session-domain";
import { evaluateExecutionSessionPreflight } from "./social-execution-session-preflight";
import {
  appendSocialExecutionSessionAuditEvent,
  appendSocialExecutionSessionRecord,
} from "./social-execution-session-store";

export const SOCIAL_EXECUTION_SESSION_SERVICE_VERSION = SOCIAL_EXECUTION_SESSION_VERSION;

export type SocialExecutionSessionOrchestrationResult = Readonly<
  | {
      ok: true;
      session: SocialExecutionSessionRecord;
      transcripts: readonly SocialExecutionRunnerTranscriptRecord[];
    }
  | {
      ok: false;
      code: string;
      message: string;
      session: SocialExecutionSessionRecord | null;
      transcripts: readonly SocialExecutionRunnerTranscriptRecord[];
    }
>;

export function createExecutionSessionId(): string {
  return `exec-execution-session:${randomUUID()}`;
}

export function createExecutionSessionAuditEventId(): string {
  return `exec-execution-session-audit:${randomUUID()}`;
}

export async function orchestrateDryRunExecutionSession(input: {
  attemptIds: readonly string[];
  attemptSnapshot: SocialExecutionAttemptPersistenceSnapshot;
  authorizationSnapshot: SocialExecutionAuthorizationPersistenceSnapshot;
  evidenceSnapshot: SocialExecutionAttemptEvidencePersistenceSnapshot;
  publicationTarget: PublicationTargetDefinition | null;
  now?: Date;
  ownerApprovalVerification?: Readonly<{
    status: "verified" | "not_verified" | "missing_reference";
    code: string | null;
  }> | null;
  persist?: boolean;
}): Promise<SocialExecutionSessionOrchestrationResult> {
  const now = input.now ?? new Date("2026-07-01T12:00:00.000Z");
  const createdAt = now.toISOString();
  const preflight = evaluateExecutionSessionPreflight({
    attemptIds: input.attemptIds,
    attemptSnapshot: input.attemptSnapshot,
    authorizationSnapshot: input.authorizationSnapshot,
    evidenceSnapshot: input.evidenceSnapshot,
    publicationTarget: input.publicationTarget,
  });

  if (!preflight.sessionOrchestrationReady || !preflight.correlationId) {
    return {
      ok: false,
      code: "session_preflight_blocked",
      message: preflight.blockingReasons.join(" "),
      session: null,
      transcripts: [],
    };
  }

  const transcripts: SocialExecutionRunnerTranscriptRecord[] = [];
  let stepOffsetMs = 0;

  for (const attemptId of preflight.attemptIds) {
    const stepNow = new Date(now.getTime() + stepOffsetMs);
    stepOffsetMs += 1;

    const runnerResult = await executeDryRunExecutionRunner({
      attemptId,
      attemptSnapshot: input.attemptSnapshot,
      authorizationSnapshot: input.authorizationSnapshot,
      evidenceSnapshot: input.evidenceSnapshot,
      publicationTarget: input.publicationTarget,
      now: stepNow,
      ownerApprovalVerification: input.ownerApprovalVerification ?? null,
      persist: input.persist !== false,
    });

    if (runnerResult.transcript) {
      transcripts.push(runnerResult.transcript);
    }
  }

  const summaryStatus = deriveExecutionSessionSummaryStatus(
    transcripts.map((transcript) => transcript.outcomeStatus),
  );
  const completedAt =
    transcripts.length > 0
      ? transcripts
          .map((transcript) => transcript.recordedAt)
          .sort((left, right) => Date.parse(right) - Date.parse(left))[0]!
      : createdAt;

  const session = await finalizeSession({
    correlationId: preflight.correlationId,
    attemptIds: preflight.attemptIds,
    transcriptIds: transcripts.map((transcript) => transcript.transcriptId),
    summaryStatus,
    sanitizedSummary: buildSessionSummary(summaryStatus, transcripts.length),
    createdAt,
    completedAt,
    persist: input.persist !== false,
    auditAction:
      summaryStatus === "simulated"
        ? "session_orchestration_completed"
        : "session_orchestration_blocked",
    auditOutcome: summaryStatus,
    auditDetail: `Execution session orchestrated ${transcripts.length} dry-run runner transcript(s) with summary ${summaryStatus}.`,
  });

  if (summaryStatus !== "simulated") {
    return {
      ok: false,
      code: "session_orchestration_incomplete",
      message: `Session orchestration completed with summary status ${summaryStatus}.`,
      session,
      transcripts,
    };
  }

  return { ok: true, session, transcripts };
}

async function finalizeSession(params: {
  correlationId: string;
  attemptIds: readonly string[];
  transcriptIds: readonly string[];
  summaryStatus: SocialExecutionSessionSummaryStatus;
  sanitizedSummary: string;
  createdAt: string;
  completedAt: string;
  persist: boolean;
  auditAction:
    | "create_session"
    | "session_orchestration_blocked"
    | "session_orchestration_completed";
  auditOutcome: SocialExecutionSessionSummaryStatus | "created";
  auditDetail: string;
}): Promise<SocialExecutionSessionRecord> {
  const session: SocialExecutionSessionRecord = {
    sessionVersion: SOCIAL_EXECUTION_SESSION_VERSION,
    sessionId: createExecutionSessionId(),
    correlationId: params.correlationId,
    transcriptIds: params.transcriptIds,
    attemptIds: params.attemptIds,
    summaryStatus: params.summaryStatus,
    sanitizedSummary: params.sanitizedSummary,
    createdAt: params.createdAt,
    completedAt: params.completedAt,
    appendOnly: true,
    immutable: true,
    metadataOnly: true,
    simulatedOnly: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    provesExecution: false,
    usesNoNetwork: true,
    usesNoOAuth: true,
    usesNoCredentials: true,
    callsNoExternalApis: true,
  };

  const validation = validateExecutionSessionRecord(session);
  if (!validation.ok) {
    throw new Error(validation.errors.map((error) => error.message).join(" "));
  }

  if (params.persist) {
    await appendSocialExecutionSessionRecord(session);
    await appendSocialExecutionSessionAuditEvent({
      auditEventId: createExecutionSessionAuditEventId(),
      sessionId: session.sessionId,
      correlationId: session.correlationId,
      action: params.auditAction,
      outcome: params.auditOutcome,
      sanitizedDetail: params.auditDetail,
      createdAt: params.completedAt,
    });
  }

  return session;
}

function buildSessionSummary(
  summaryStatus: SocialExecutionSessionSummaryStatus,
  transcriptCount: number,
): string {
  return `Dry-run execution session grouped ${transcriptCount} runner transcript(s) with summary ${summaryStatus}.`;
}
