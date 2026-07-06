import { randomUUID } from "node:crypto";

import type { SocialExecutionAuthorizationPersistenceSnapshot } from "../execution-authorization/social-execution-authorization-store";
import type { SocialExecutionAttemptEvidencePersistenceSnapshot } from "../execution-attempt/social-execution-attempt-evidence-store";
import type { SocialExecutionAttemptPersistenceSnapshot } from "../execution-attempt/social-execution-attempt-store";
import { resolveSocialPlatformAdapter } from "../social-platform-adapter-factory";
import type { SocialPublicationExecutionAdapterChannelIdentity } from "../social-publication-execution-adapter";
import {
  buildDryRunSocialPublicationExecutionAdapterRequest,
  simulateDryRunSocialPublicationExecutionAdapterRequest,
} from "../social-publication-execution-adapter-dry-run";
import type { PublicationTargetDefinition } from "../social-publication-targets";
import {
  SOCIAL_EXECUTION_RUNNER_VERSION,
  validateExecutionRunnerTranscriptRecord,
  type SocialExecutionRunnerOutcomeStatus,
  type SocialExecutionRunnerTranscriptRecord,
} from "./social-execution-runner-domain";
import { evaluateExecutionRunnerPreflight } from "./social-execution-runner-preflight";
import {
  appendSocialExecutionRunnerAuditEvent,
  appendSocialExecutionRunnerTranscript,
} from "./social-execution-runner-store";

export const SOCIAL_EXECUTION_RUNNER_SERVICE_VERSION = SOCIAL_EXECUTION_RUNNER_VERSION;

export type SocialExecutionRunnerServiceResult = Readonly<
  | {
      ok: true;
      transcript: SocialExecutionRunnerTranscriptRecord;
    }
  | {
      ok: false;
      code: string;
      message: string;
      transcript: SocialExecutionRunnerTranscriptRecord | null;
    }
>;

export function createExecutionRunnerTranscriptId(): string {
  return `exec-runner-transcript:${randomUUID()}`;
}

export function createExecutionRunnerAuditEventId(): string {
  return `exec-runner-audit:${randomUUID()}`;
}

export async function executeDryRunExecutionRunner(input: {
  attemptId: string;
  attemptSnapshot: SocialExecutionAttemptPersistenceSnapshot;
  authorizationSnapshot: SocialExecutionAuthorizationPersistenceSnapshot;
  evidenceSnapshot: SocialExecutionAttemptEvidencePersistenceSnapshot;
  publicationTarget: PublicationTargetDefinition | null;
  executionJobId?: string;
  now?: Date;
  ownerApprovalVerification?: Readonly<{
    status: "verified" | "not_verified" | "missing_reference";
    code: string | null;
  }> | null;
  persist?: boolean;
}): Promise<SocialExecutionRunnerServiceResult> {
  const now = input.now ?? new Date("2026-07-01T12:00:00.000Z");
  const recordedAt = now.toISOString();
  const preflight = evaluateExecutionRunnerPreflight({
    attemptId: input.attemptId,
    attemptSnapshot: input.attemptSnapshot,
    authorizationSnapshot: input.authorizationSnapshot,
    evidenceSnapshot: input.evidenceSnapshot,
    publicationTarget: input.publicationTarget,
    now,
    ownerApprovalVerification: input.ownerApprovalVerification ?? null,
  });

  const attempt =
    input.attemptSnapshot.attempts.find((record) => record.attemptId === input.attemptId) ?? null;

  if (!preflight.runnerReady || !attempt || !preflight.platform) {
    const transcript = await finalizeTranscript({
      attemptId: input.attemptId,
      attempt,
      platform: preflight.platform,
      outcomeStatus: "blocked",
      sanitizedSummary: "Dry-run execution runner blocked by preflight.",
      simulation: null,
      blockingCodes: preflight.preflightBlockingCodes,
      recordedAt,
      persist: input.persist !== false,
      auditAction: "runner_blocked",
      auditOutcome: "blocked",
      auditDetail: preflight.blockingReasons.join(" "),
    });

    return {
      ok: false,
      code: "runner_preflight_blocked",
      message: preflight.blockingReasons.join(" "),
      transcript,
    };
  }

  const adapterSelection = resolveSocialPlatformAdapter({
    platform: preflight.platform,
    preferDryRun: true,
  });

  if (!adapterSelection.ok || !adapterSelection.value.executionAdapterContract) {
    const transcript = await finalizeTranscript({
      attemptId: input.attemptId,
      attempt,
      platform: preflight.platform,
      outcomeStatus: "validation_failed",
      sanitizedSummary: "Dry-run adapter selection failed.",
      simulation: null,
      blockingCodes: ["adapter_dry_run_unavailable"],
      recordedAt,
      persist: input.persist !== false,
      auditAction: "runner_validation_failed",
      auditOutcome: "validation_failed",
      auditDetail: "Dry-run adapter selection failed.",
    });

    return {
      ok: false,
      code: "adapter_selection_failed",
      message: "Dry-run adapter selection failed.",
      transcript,
    };
  }

  const adapter = adapterSelection.value.executionAdapterContract;
  const target = input.publicationTarget!;
  const channel = buildChannelIdentity(target);
  const request = buildDryRunSocialPublicationExecutionAdapterRequest({
    requestId: `dry-run-runner:${attempt.attemptId}:${recordedAt}`,
    adapter,
    executionJobId: input.executionJobId ?? `execution-job:${attempt.executionIntentId}`,
    executionIntentId: attempt.executionIntentId,
    channel,
    requestedAt: recordedAt,
  });

  const simulation = simulateDryRunSocialPublicationExecutionAdapterRequest(adapter, request, {
    ownerApprovalPresent: preflight.authorizationValid,
    publisherAuthorityPresent: true,
    preflightPassed: true,
    publicationTargetPresent: true,
    publisherRequestPresent: true,
    schedulerIntentPresent: true,
    ledgerEvidencePresent: true,
    manifestReferencePresent: true,
  });

  if (!simulation.ok) {
    const transcript = await finalizeTranscript({
      attemptId: input.attemptId,
      attempt,
      platform: preflight.platform,
      outcomeStatus: "validation_failed",
      sanitizedSummary: "Dry-run adapter simulation validation failed.",
      simulation: null,
      blockingCodes: simulation.diagnostics.map((item) => item.code),
      recordedAt,
      persist: input.persist !== false,
      auditAction: "runner_validation_failed",
      auditOutcome: "validation_failed",
      auditDetail: simulation.diagnostics.map((item) => item.message).join(" "),
    });

    return {
      ok: false,
      code: "dry_run_simulation_failed",
      message: simulation.diagnostics.map((item) => item.message).join(" "),
      transcript,
    };
  }

  const transcript = await finalizeTranscript({
    attemptId: input.attemptId,
    attempt,
    platform: preflight.platform,
    outcomeStatus: "simulated",
    sanitizedSummary: `Dry-run simulated for ${preflight.platform} without external calls.`,
    simulation: simulation.value,
    blockingCodes: [],
    recordedAt,
    persist: input.persist !== false,
    auditAction: "append_transcript",
    auditOutcome: "success",
    auditDetail: `Dry-run transcript appended for attempt ${attempt.attemptId}.`,
  });

  return { ok: true, transcript };
}

async function finalizeTranscript(params: {
  attemptId: string;
  attempt: SocialExecutionAttemptPersistenceSnapshot["attempts"][number] | null;
  platform: SocialExecutionRunnerTranscriptRecord["platform"] | null;
  outcomeStatus: SocialExecutionRunnerOutcomeStatus;
  sanitizedSummary: string;
  simulation: SocialExecutionRunnerTranscriptRecord["simulation"];
  blockingCodes: readonly string[];
  recordedAt: string;
  persist: boolean;
  auditAction: "append_transcript" | "runner_validation_failed" | "runner_blocked";
  auditOutcome: "success" | "blocked" | "validation_failed";
  auditDetail: string;
}): Promise<SocialExecutionRunnerTranscriptRecord> {
  const attempt = params.attempt;
  const transcript: SocialExecutionRunnerTranscriptRecord = {
    runnerVersion: SOCIAL_EXECUTION_RUNNER_VERSION,
    transcriptId: createExecutionRunnerTranscriptId(),
    attemptId: attempt?.attemptId ?? params.attemptId,
    authorizationId: attempt?.authorizationId ?? "unknown",
    executionIntentId: attempt?.executionIntentId ?? "unknown",
    publicationTargetId: attempt?.publicationTargetId ?? "unknown",
    correlationId: attempt?.correlationId ?? "corr:unknown",
    platform: params.platform ?? "facebook",
    outcomeStatus: params.outcomeStatus,
    sanitizedSummary: params.sanitizedSummary,
    simulation: params.simulation,
    blockingCodes: params.blockingCodes,
    recordedAt: params.recordedAt,
    appendOnly: true,
    immutable: true,
    metadataOnly: true,
    simulatedOnly: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    provesExecution: false,
    persistsNothing: false,
    usesNoNetwork: true,
    usesNoOAuth: true,
    usesNoCredentials: true,
    callsNoExternalApis: true,
  };

  const validation = validateExecutionRunnerTranscriptRecord(transcript);
  if (!validation.ok) {
    throw new Error(validation.errors.map((error) => error.message).join(" "));
  }

  if (params.persist) {
    await appendSocialExecutionRunnerTranscript(transcript);
    await appendSocialExecutionRunnerAuditEvent({
      auditEventId: createExecutionRunnerAuditEventId(),
      transcriptId: transcript.transcriptId,
      attemptId: transcript.attemptId,
      correlationId: transcript.correlationId,
      action: params.auditAction,
      outcome: params.auditOutcome,
      sanitizedDetail: params.auditDetail,
      createdAt: params.recordedAt,
    });
  }

  return transcript;
}

function buildChannelIdentity(
  target: PublicationTargetDefinition,
): SocialPublicationExecutionAdapterChannelIdentity {
  const platform = target.platform === "instagram" ? "instagram" : "facebook";
  return {
    channelId: target.targetId,
    platform,
    channelType: target.targetType,
    publicationTargetId: target.targetId,
    externalChannelReference: target.externalId,
    displayName: target.displayName,
    identityOnly: true,
    containsCredentials: false,
    containsSdkClient: false,
    containsStorageReference: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}
