import { evaluateExecutionAuthorizationPreflightForIntent } from "../execution-authorization/social-execution-authorization-preflight";
import type { SocialExecutionAuthorizationPersistenceSnapshot } from "../execution-authorization/social-execution-authorization-store";
import { deriveExecutionAttemptStatus } from "../execution-attempt/social-execution-attempt-domain";
import { evaluateExecutionAttemptEvidencePreflightForIntent } from "../execution-attempt/social-execution-attempt-evidence-preflight";
import type { SocialExecutionAttemptEvidencePersistenceSnapshot } from "../execution-attempt/social-execution-attempt-evidence-store";
import type { SocialExecutionAttemptPersistenceSnapshot } from "../execution-attempt/social-execution-attempt-store";
import { EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT } from "../execution-attempt/social-execution-attempt-store";
import { resolveSocialPlatformAdapter } from "../social-platform-adapter-factory";
import type { PublicationTargetDefinition } from "../social-publication-targets";
import {
  SOCIAL_EXECUTION_RUNNER_VERSION,
  isSocialExecutionRunnerSupportedPlatform,
  type SocialExecutionRunnerSupportedPlatform,
} from "./social-execution-runner-domain";

export const SOCIAL_EXECUTION_RUNNER_PREFLIGHT_VERSION = SOCIAL_EXECUTION_RUNNER_VERSION;

export const SOCIAL_EXECUTION_RUNNER_PREFLIGHT_BLOCKING_CODES = [
  "attempt_missing",
  "attempt_lifecycle_invalid",
  "authorization_invalid",
  "evidence_not_aligned",
  "publication_target_missing",
  "platform_unsupported",
  "platform_out_of_scope",
  "adapter_dry_run_unavailable",
] as const;

export type SocialExecutionRunnerPreflightBlockingCode =
  (typeof SOCIAL_EXECUTION_RUNNER_PREFLIGHT_BLOCKING_CODES)[number];

export type SocialExecutionRunnerPreflightSummary = Readonly<{
  preflightVersion: typeof SOCIAL_EXECUTION_RUNNER_PREFLIGHT_VERSION;
  attemptId: string | null;
  executionIntentId: string | null;
  publicationTargetId: string | null;
  authorizationId: string | null;
  correlationId: string | null;
  platform: SocialExecutionRunnerSupportedPlatform | null;
  derivedLifecycleState: string;
  authorizationValid: boolean;
  evidenceAligned: boolean;
  adapterDryRunAvailable: boolean;
  runnerReady: boolean;
  preflightBlockingCodes: readonly SocialExecutionRunnerPreflightBlockingCode[];
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export function evaluateExecutionRunnerPreflight(input: {
  attemptId: string | null;
  attemptSnapshot?: SocialExecutionAttemptPersistenceSnapshot;
  authorizationSnapshot?: SocialExecutionAuthorizationPersistenceSnapshot;
  evidenceSnapshot?: SocialExecutionAttemptEvidencePersistenceSnapshot;
  publicationTarget?: PublicationTargetDefinition | null;
  now?: Date;
  ownerApprovalVerification?: Readonly<{
    status: "verified" | "not_verified" | "missing_reference";
    code: string | null;
  }> | null;
}): SocialExecutionRunnerPreflightSummary {
  const attemptSnapshot = input.attemptSnapshot ?? EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT;
  const attempt =
    hasText(input.attemptId)
      ? attemptSnapshot.attempts.find((record) => record.attemptId === input.attemptId) ?? null
      : null;

  const executionIntentId = attempt?.executionIntentId ?? null;
  const publicationTargetId = attempt?.publicationTargetId ?? null;
  const authorizationId = attempt?.authorizationId ?? null;
  const correlationId = attempt?.correlationId ?? null;

  const preflightBlockingCodes: SocialExecutionRunnerPreflightBlockingCode[] = [];
  const blockingReasons: string[] = [];

  if (!attempt) {
    preflightBlockingCodes.push("attempt_missing");
    blockingReasons.push("Execution attempt is missing.");
  }

  const authorizationPreflight =
    hasText(executionIntentId) && hasText(publicationTargetId) && input.authorizationSnapshot
      ? evaluateExecutionAuthorizationPreflightForIntent({
          executionIntentId,
          publicationTargetId,
          snapshot: input.authorizationSnapshot,
          now: input.now,
          ownerApprovalVerification: input.ownerApprovalVerification ?? null,
        })
      : null;

  const authorizationValid = authorizationPreflight?.authorizationValid ?? false;
  if (!authorizationValid) {
    preflightBlockingCodes.push("authorization_invalid");
    blockingReasons.push("Execution authorization is not valid.");
  }

  const lifecycleEvents = attempt
    ? attemptSnapshot.lifecycleEvents.filter((event) => event.attemptId === attempt.attemptId)
    : [];
  const derivedLifecycleState =
    attempt && input.authorizationSnapshot
      ? deriveExecutionAttemptStatus({
          attempt,
          lifecycleEvents,
          authorizationSnapshot: input.authorizationSnapshot,
          now: input.now,
        })
      : "missing";

  if (derivedLifecycleState !== "prepared") {
    preflightBlockingCodes.push("attempt_lifecycle_invalid");
    blockingReasons.push("Execution attempt lifecycle must be prepared before dry-run.");
  }

  const evidencePreflight =
    hasText(executionIntentId) && hasText(publicationTargetId)
      ? evaluateExecutionAttemptEvidencePreflightForIntent({
          executionIntentId,
          publicationTargetId,
          attemptSnapshot,
          evidenceSnapshot: input.evidenceSnapshot,
          authorizationSnapshot: input.authorizationSnapshot,
          now: input.now,
        })
      : null;

  const evidenceAligned = evidencePreflight?.evidenceAligned ?? false;
  if (!evidenceAligned) {
    preflightBlockingCodes.push("evidence_not_aligned");
    blockingReasons.push("Execution attempt evidence is not aligned.");
  }

  const publicationTarget = input.publicationTarget ?? null;
  if (!publicationTarget) {
    preflightBlockingCodes.push("publication_target_missing");
    blockingReasons.push("Publication target is missing.");
  }

  let platform: SocialExecutionRunnerSupportedPlatform | null = null;
  if (publicationTarget) {
    if (!isSocialExecutionRunnerSupportedPlatform(publicationTarget.platform)) {
      preflightBlockingCodes.push("platform_out_of_scope");
      blockingReasons.push("Dry-run runner supports facebook and instagram only.");
    } else {
      platform = publicationTarget.platform;
    }
  }

  let adapterDryRunAvailable = false;
  if (platform) {
    const adapterSelection = resolveSocialPlatformAdapter({
      platform,
      preferDryRun: true,
    });
    if (!adapterSelection.ok) {
      preflightBlockingCodes.push("platform_unsupported");
      blockingReasons.push("Platform adapter could not be resolved.");
    } else if (!adapterSelection.value.dryRunAvailable || !adapterSelection.value.executionAdapterContract) {
      preflightBlockingCodes.push("adapter_dry_run_unavailable");
      blockingReasons.push("Dry-run adapter is unavailable for the platform.");
    } else {
      adapterDryRunAvailable = true;
    }
  }

  const runnerReady = preflightBlockingCodes.length === 0;

  return {
    preflightVersion: SOCIAL_EXECUTION_RUNNER_PREFLIGHT_VERSION,
    attemptId: attempt?.attemptId ?? null,
    executionIntentId,
    publicationTargetId,
    authorizationId,
    correlationId,
    platform,
    derivedLifecycleState,
    authorizationValid,
    evidenceAligned,
    adapterDryRunAvailable,
    runnerReady,
    preflightBlockingCodes,
    blockingReasons,
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
