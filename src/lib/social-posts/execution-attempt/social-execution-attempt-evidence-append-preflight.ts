import {
  deriveExecutionAuthorizationState,
} from "../execution-authorization/social-execution-authorization-domain";
import type { SocialExecutionAuthorizationPersistenceSnapshot } from "../execution-authorization/social-execution-authorization-store";
import {
  deriveExecutionAttemptStatus,
  type SocialExecutionAttemptRecord,
} from "./social-execution-attempt-domain";
import type { SocialExecutionAttemptLifecycleState } from "./social-execution-attempt-lifecycle-domain";
import {
  isValidExecutionAttemptStateTransition,
  resolveTransitionKindTargetState,
  type SocialExecutionAttemptStateTransitionKind,
} from "./social-execution-attempt-state-transition-domain";
import type { SocialExecutionAttemptPersistenceSnapshot } from "./social-execution-attempt-store";
import { EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT } from "./social-execution-attempt-store";
import type { SocialExecutionAttemptEvidencePersistenceSnapshot } from "./social-execution-attempt-evidence-store";
import { EMPTY_SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_PERSISTENCE_SNAPSHOT } from "./social-execution-attempt-evidence-store";

export const SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_APPEND_PREFLIGHT_VERSION = "d16-w9-v1" as const;

const APPENDABLE_LIFECYCLE_STATES = new Set<SocialExecutionAttemptLifecycleState>([
  "created",
  "prepared",
]);

export function evaluateExecutionAttemptEvidenceAppendAvailability(input: {
  attemptId: string | null;
  ownerApprovalId: string | null;
  attempt?: SocialExecutionAttemptRecord | null;
  attemptSnapshot?: SocialExecutionAttemptPersistenceSnapshot;
  authorizationSnapshot?: SocialExecutionAuthorizationPersistenceSnapshot;
  evidenceSnapshot?: SocialExecutionAttemptEvidencePersistenceSnapshot;
  transitionKind?: SocialExecutionAttemptStateTransitionKind | null;
  now?: Date;
}): Readonly<{
  evidenceAppendAvailable: boolean;
  attemptUnavailable: boolean;
  authorizationUnavailable: boolean;
  ownerApprovalUnavailable: boolean;
  appendBlockingCodes: readonly string[];
  derivedLifecycleState: SocialExecutionAttemptLifecycleState | "missing";
}> {
  if (!hasText(input.attemptId)) {
    return unavailable("attempt_missing");
  }

  const attemptSnapshot = input.attemptSnapshot ?? EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT;
  const attempt =
    input.attempt ??
    attemptSnapshot.attempts.find((record) => record.attemptId === input.attemptId) ??
    null;

  if (!attempt) {
    return unavailable("attempt_not_found");
  }

  const authorizationSnapshot = input.authorizationSnapshot;
  const authorization =
    authorizationSnapshot?.authorizations.find(
      (record) => record.authorizationId === attempt.authorizationId,
    ) ?? null;
  const cancellation =
    authorization && authorizationSnapshot
      ? authorizationSnapshot.cancellations.find(
          (record) => record.authorizationId === authorization.authorizationId,
        ) ?? null
      : null;
  const derivedAuthorizationState = deriveExecutionAuthorizationState({
    authorization,
    cancellation,
    now: input.now,
  });
  const authorizationUnavailable = derivedAuthorizationState !== "valid";

  const lifecycleEvents = attemptSnapshot.lifecycleEvents.filter(
    (event) => event.attemptId === attempt.attemptId,
  );
  const derivedLifecycleState =
    authorizationSnapshot
      ? deriveExecutionAttemptStatus({
          attempt,
          lifecycleEvents,
          authorizationSnapshot,
          now: input.now,
        })
      : "missing";

  const attemptUnavailable =
    derivedLifecycleState === "missing" ||
    !APPENDABLE_LIFECYCLE_STATES.has(derivedLifecycleState as SocialExecutionAttemptLifecycleState);

  const ownerApprovalUnavailable =
    !hasText(input.ownerApprovalId) ||
    !authorization ||
    input.ownerApprovalId !== authorization.ownerApprovalId;

  if (input.transitionKind) {
    const targetState = resolveTransitionKindTargetState(input.transitionKind);
    const fromState = derivedLifecycleState === "missing" ? "missing" : derivedLifecycleState;
    if (!isValidExecutionAttemptStateTransition(fromState, targetState)) {
      return {
        evidenceAppendAvailable: false,
        attemptUnavailable: true,
        authorizationUnavailable,
        ownerApprovalUnavailable,
        appendBlockingCodes: ["transition_unavailable"],
        derivedLifecycleState,
      };
    }
  }

  const appendBlockingCodes: string[] = [];
  if (attemptUnavailable) appendBlockingCodes.push("attempt_unavailable");
  if (authorizationUnavailable) appendBlockingCodes.push("authorization_unavailable");
  if (ownerApprovalUnavailable) appendBlockingCodes.push("owner_approval_unavailable");

  const evidenceAppendAvailable =
    appendBlockingCodes.length === 0 &&
    !attemptUnavailable &&
    !authorizationUnavailable &&
    !ownerApprovalUnavailable;

  return {
    evidenceAppendAvailable,
    attemptUnavailable,
    authorizationUnavailable,
    ownerApprovalUnavailable,
    appendBlockingCodes,
    derivedLifecycleState,
  };
}

export type SocialExecutionAttemptEvidenceAppendPreflightSummary = Readonly<{
  preflightVersion: typeof SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_APPEND_PREFLIGHT_VERSION;
  attemptId: string;
  evidenceAppendAvailable: boolean;
  attemptUnavailable: boolean;
  authorizationUnavailable: boolean;
  ownerApprovalUnavailable: boolean;
  appendBlockingCodes: readonly string[];
  derivedLifecycleState: SocialExecutionAttemptLifecycleState | "missing";
  informationalOnly: true;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export function evaluateExecutionAttemptEvidenceAppendPreflightForAttempt(input: {
  attemptId: string | null;
  ownerApprovalId: string | null;
  attemptSnapshot?: SocialExecutionAttemptPersistenceSnapshot;
  evidenceSnapshot?: SocialExecutionAttemptEvidencePersistenceSnapshot;
  authorizationSnapshot?: SocialExecutionAuthorizationPersistenceSnapshot;
  transitionKind?: SocialExecutionAttemptStateTransitionKind | null;
  now?: Date;
}): SocialExecutionAttemptEvidenceAppendPreflightSummary | null {
  if (!hasText(input.attemptId)) {
    return null;
  }

  const availability = evaluateExecutionAttemptEvidenceAppendAvailability({
    attemptId: input.attemptId,
    ownerApprovalId: input.ownerApprovalId,
    attemptSnapshot: input.attemptSnapshot,
    authorizationSnapshot: input.authorizationSnapshot,
    evidenceSnapshot: input.evidenceSnapshot ?? EMPTY_SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_PERSISTENCE_SNAPSHOT,
    transitionKind: input.transitionKind,
    now: input.now,
  });

  return {
    preflightVersion: SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_APPEND_PREFLIGHT_VERSION,
    attemptId: input.attemptId,
    evidenceAppendAvailable: availability.evidenceAppendAvailable,
    attemptUnavailable: availability.attemptUnavailable,
    authorizationUnavailable: availability.authorizationUnavailable,
    ownerApprovalUnavailable: availability.ownerApprovalUnavailable,
    appendBlockingCodes: availability.appendBlockingCodes,
    derivedLifecycleState: availability.derivedLifecycleState,
    informationalOnly: true,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function unavailable(code: string) {
  return {
    evidenceAppendAvailable: false,
    attemptUnavailable: true,
    authorizationUnavailable: true,
    ownerApprovalUnavailable: true,
    appendBlockingCodes: [code],
    derivedLifecycleState: "missing" as const,
  };
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
