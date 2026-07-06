import type { SocialExecutionAuthorizationPersistenceSnapshot } from "../execution-authorization/social-execution-authorization-store";
import type { SocialExecutionAttemptEvidencePersistenceSnapshot } from "../execution-attempt/social-execution-attempt-evidence-store";
import type { SocialExecutionAttemptPersistenceSnapshot } from "../execution-attempt/social-execution-attempt-store";
import { EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT } from "../execution-attempt/social-execution-attempt-store";
import { evaluateExecutionRunnerPreflight } from "../execution-runner/social-execution-runner-preflight";
import { resolveSocialPlatformAdapter } from "../social-platform-adapter-factory";
import type { PublicationTargetDefinition } from "../social-publication-targets";
import { evaluateExecutionSessionPreflight } from "../execution-session/social-execution-session-preflight";
import { SOCIAL_EXECUTION_PLAN_VERSION } from "./social-execution-plan-domain";

export const SOCIAL_EXECUTION_PLAN_PREFLIGHT_VERSION = SOCIAL_EXECUTION_PLAN_VERSION;

export const SOCIAL_EXECUTION_PLAN_PREFLIGHT_BLOCKING_CODES = [
  "session_id_required",
  "authorization_id_required",
  "session_preflight_blocked",
  "runner_preflight_blocked",
  "publication_target_missing",
  "platform_unresolved",
  "adapter_dry_run_unavailable",
] as const;

export type SocialExecutionPlanPreflightBlockingCode =
  (typeof SOCIAL_EXECUTION_PLAN_PREFLIGHT_BLOCKING_CODES)[number];

export type SocialExecutionPlanPreflightSummary = Readonly<{
  preflightVersion: typeof SOCIAL_EXECUTION_PLAN_PREFLIGHT_VERSION;
  sessionId: string | null;
  authorizationId: string | null;
  correlationId: string | null;
  attemptIds: readonly string[];
  publicationTargetIds: readonly string[];
  platform: string | null;
  adapterId: string | null;
  sessionPreflightReady: boolean;
  runnerPreflightReadyCount: number;
  runnerPreflightBlockedCount: number;
  planReady: boolean;
  preflightBlockingCodes: readonly SocialExecutionPlanPreflightBlockingCode[];
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export function evaluateExecutionPlanPreflight(input: {
  sessionId: string | null;
  authorizationId: string | null;
  attemptIds: readonly string[];
  attemptSnapshot?: SocialExecutionAttemptPersistenceSnapshot;
  authorizationSnapshot?: SocialExecutionAuthorizationPersistenceSnapshot;
  evidenceSnapshot?: SocialExecutionAttemptEvidencePersistenceSnapshot;
  publicationTarget?: PublicationTargetDefinition | null;
  now?: Date;
  ownerApprovalVerification?: Readonly<{
    status: "verified" | "not_verified" | "missing_reference";
    code: string | null;
  }> | null;
}): SocialExecutionPlanPreflightSummary {
  const attemptSnapshot = input.attemptSnapshot ?? EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT;
  const preflightBlockingCodes: SocialExecutionPlanPreflightBlockingCode[] = [];
  const blockingReasons: string[] = [];

  if (!hasText(input.sessionId)) {
    preflightBlockingCodes.push("session_id_required");
    blockingReasons.push("Execution session id is required for plan modeling.");
  }

  if (!hasText(input.authorizationId)) {
    preflightBlockingCodes.push("authorization_id_required");
    blockingReasons.push("Execution authorization id is required for plan modeling.");
  }

  const sessionPreflight = evaluateExecutionSessionPreflight({
    attemptIds: input.attemptIds,
    attemptSnapshot,
    authorizationSnapshot: input.authorizationSnapshot,
    evidenceSnapshot: input.evidenceSnapshot,
    publicationTarget: input.publicationTarget ?? null,
  });

  const sessionPreflightReady = sessionPreflight.sessionOrchestrationReady;
  if (!sessionPreflightReady) {
    preflightBlockingCodes.push("session_preflight_blocked");
    blockingReasons.push(...sessionPreflight.blockingReasons);
  }

  let runnerPreflightReadyCount = 0;
  let runnerPreflightBlockedCount = 0;

  for (const attemptId of sessionPreflight.attemptIds) {
    const runnerPreflight = evaluateExecutionRunnerPreflight({
      attemptId,
      attemptSnapshot,
      authorizationSnapshot: input.authorizationSnapshot,
      evidenceSnapshot: input.evidenceSnapshot,
      publicationTarget: input.publicationTarget ?? null,
      now: input.now,
      ownerApprovalVerification: input.ownerApprovalVerification ?? null,
    });

    if (runnerPreflight.runnerReady) {
      runnerPreflightReadyCount += 1;
    } else {
      runnerPreflightBlockedCount += 1;
      preflightBlockingCodes.push("runner_preflight_blocked");
      blockingReasons.push(...runnerPreflight.blockingReasons);
    }
  }

  const publicationTarget = input.publicationTarget ?? null;
  if (!publicationTarget) {
    preflightBlockingCodes.push("publication_target_missing");
    blockingReasons.push("Publication target is missing.");
  }

  let platform: string | null = sessionPreflight.attemptIds.length > 0
    ? evaluateExecutionRunnerPreflight({
        attemptId: sessionPreflight.attemptIds[0] ?? null,
        attemptSnapshot,
        authorizationSnapshot: input.authorizationSnapshot,
        evidenceSnapshot: input.evidenceSnapshot,
        publicationTarget,
        now: input.now,
        ownerApprovalVerification: input.ownerApprovalVerification ?? null,
      }).platform
    : null;

  let adapterId: string | null = null;
  if (platform) {
    const adapterSelection = resolveSocialPlatformAdapter({
      platform: platform as "facebook" | "instagram",
      preferDryRun: true,
    });

    if (!adapterSelection.ok || !adapterSelection.value.executionAdapterContract) {
      preflightBlockingCodes.push("platform_unresolved");
      blockingReasons.push("Platform adapter could not be resolved for planning.");
      platform = null;
    } else if (
      !adapterSelection.value.dryRunAvailable ||
      !adapterSelection.value.executionAdapterContract.dryRun.dryRunSupported
    ) {
      preflightBlockingCodes.push("adapter_dry_run_unavailable");
      blockingReasons.push("Dry-run adapter is unavailable for planning.");
    } else {
      adapterId = adapterSelection.value.executionAdapterContract.identity.adapterId;
    }
  } else if (publicationTarget) {
    preflightBlockingCodes.push("platform_unresolved");
    blockingReasons.push("Execution plan platform could not be resolved.");
  }

  const publicationTargetIds = sessionPreflight.attemptIds
    .map(
      (attemptId) =>
        attemptSnapshot.attempts.find((record) => record.attemptId === attemptId)?.publicationTargetId ??
        null,
    )
    .filter((value): value is string => hasText(value));

  const uniqueBlockingCodes = [...new Set(preflightBlockingCodes)];
  const planReady = uniqueBlockingCodes.length === 0;

  return {
    preflightVersion: SOCIAL_EXECUTION_PLAN_PREFLIGHT_VERSION,
    sessionId: input.sessionId,
    authorizationId: input.authorizationId,
    correlationId: sessionPreflight.correlationId,
    attemptIds: sessionPreflight.attemptIds,
    publicationTargetIds,
    platform,
    adapterId,
    sessionPreflightReady,
    runnerPreflightReadyCount,
    runnerPreflightBlockedCount,
    planReady,
    preflightBlockingCodes: uniqueBlockingCodes,
    blockingReasons: [...new Set(blockingReasons)],
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
