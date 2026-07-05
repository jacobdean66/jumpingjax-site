import type { SocialExecutionAuthorizationPersistenceSnapshot } from "../execution-authorization/social-execution-authorization-store";
import {
  deriveExecutionAttemptStatus,
  type SocialExecutionAttemptRecord,
} from "./social-execution-attempt-domain";
import type { SocialExecutionAttemptEvidenceRecord } from "./social-execution-attempt-evidence-domain";
import type { SocialExecutionAttemptLifecycleEventRecord } from "./social-execution-attempt-lifecycle-domain";
import type {
  SocialExecutionAttemptStateTransitionKind,
  SocialExecutionAttemptStateTransitionRecord,
} from "./social-execution-attempt-state-transition-domain";

export const SOCIAL_EXECUTION_ATTEMPT_DERIVED_STATE_VERSION = "d16-w8-v1" as const;

export const SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_COVERAGE_STATUSES = [
  "no_evidence",
  "partial_evidence",
  "evidence_aligned",
  "evidence_gap_detected",
] as const;

export type SocialExecutionAttemptEvidenceCoverageStatus =
  (typeof SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_COVERAGE_STATUSES)[number];

export type SocialExecutionAttemptDerivedStateProjection = Readonly<{
  derivedStateVersion: typeof SOCIAL_EXECUTION_ATTEMPT_DERIVED_STATE_VERSION;
  attemptId: string;
  derivedLifecycleState: ReturnType<typeof deriveExecutionAttemptStatus>;
  derivedTransitionState: SocialExecutionAttemptStateTransitionRecord["toState"] | "missing";
  latestTransitionKind: SocialExecutionAttemptStateTransitionKind | null;
  evidenceCount: number;
  transitionCount: number;
  evidenceCoverageStatus: SocialExecutionAttemptEvidenceCoverageStatus;
  evidenceAligned: boolean;
  informationalOnly: true;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export function deriveExecutionAttemptEvidenceCoverageStatus(input: {
  evidenceRecords: readonly SocialExecutionAttemptEvidenceRecord[];
  stateTransitions: readonly SocialExecutionAttemptStateTransitionRecord[];
  lifecycleEventCount: number;
}): SocialExecutionAttemptEvidenceCoverageStatus {
  if (input.evidenceRecords.length === 0 && input.stateTransitions.length === 0) {
    return "no_evidence";
  }

  const evidenceWithTransitions = input.stateTransitions.filter((transition) => transition.evidenceId);
  if (input.lifecycleEventCount === 0) {
    return input.evidenceRecords.length > 0 ? "partial_evidence" : "no_evidence";
  }

  if (
    input.evidenceRecords.length >= input.lifecycleEventCount &&
    evidenceWithTransitions.length >= Math.max(1, input.stateTransitions.length)
  ) {
    return "evidence_aligned";
  }

  if (input.evidenceRecords.length > 0 || input.stateTransitions.length > 0) {
    return input.evidenceRecords.length < input.lifecycleEventCount
      ? "evidence_gap_detected"
      : "partial_evidence";
  }

  return "no_evidence";
}

export function deriveExecutionAttemptCompositeState(input: {
  attempt: SocialExecutionAttemptRecord | null;
  lifecycleEvents: readonly SocialExecutionAttemptLifecycleEventRecord[];
  evidenceRecords: readonly SocialExecutionAttemptEvidenceRecord[];
  stateTransitions: readonly SocialExecutionAttemptStateTransitionRecord[];
  authorizationSnapshot?: SocialExecutionAuthorizationPersistenceSnapshot;
  now?: Date;
}): SocialExecutionAttemptDerivedStateProjection | null {
  if (!input.attempt) return null;

  const attemptEvidence = input.evidenceRecords.filter(
    (record) => record.attemptId === input.attempt!.attemptId,
  );
  const attemptTransitions = input.stateTransitions.filter(
    (record) => record.attemptId === input.attempt!.attemptId,
  );
  const attemptLifecycle = input.lifecycleEvents.filter(
    (event) => event.attemptId === input.attempt!.attemptId,
  );

  const derivedLifecycleState = input.authorizationSnapshot
    ? deriveExecutionAttemptStatus({
        attempt: input.attempt,
        lifecycleEvents: attemptLifecycle,
        authorizationSnapshot: input.authorizationSnapshot,
        now: input.now,
      })
    : attemptLifecycle.length > 0
      ? [...attemptLifecycle].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
          ?.lifecycleState ?? "missing"
      : "missing";

  const latestTransition =
    attemptTransitions.length > 0
      ? [...attemptTransitions].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
      : null;

  const evidenceCoverageStatus = deriveExecutionAttemptEvidenceCoverageStatus({
    evidenceRecords: attemptEvidence,
    stateTransitions: attemptTransitions,
    lifecycleEventCount: attemptLifecycle.length,
  });

  return {
    derivedStateVersion: SOCIAL_EXECUTION_ATTEMPT_DERIVED_STATE_VERSION,
    attemptId: input.attempt.attemptId,
    derivedLifecycleState,
    derivedTransitionState: latestTransition?.toState ?? "missing",
    latestTransitionKind: latestTransition?.transitionKind ?? null,
    evidenceCount: attemptEvidence.length,
    transitionCount: attemptTransitions.length,
    evidenceCoverageStatus,
    evidenceAligned: evidenceCoverageStatus === "evidence_aligned",
    informationalOnly: true,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

export function deriveExecutionAttemptCompositeStates(input: {
  attempts: readonly SocialExecutionAttemptRecord[];
  lifecycleEvents: readonly SocialExecutionAttemptLifecycleEventRecord[];
  evidenceRecords: readonly SocialExecutionAttemptEvidenceRecord[];
  stateTransitions: readonly SocialExecutionAttemptStateTransitionRecord[];
  authorizationSnapshot?: SocialExecutionAuthorizationPersistenceSnapshot;
  now?: Date;
}): readonly SocialExecutionAttemptDerivedStateProjection[] {
  return input.attempts
    .map((attempt) =>
      deriveExecutionAttemptCompositeState({
        attempt,
        lifecycleEvents: input.lifecycleEvents,
        evidenceRecords: input.evidenceRecords,
        stateTransitions: input.stateTransitions,
        authorizationSnapshot: input.authorizationSnapshot,
        now: input.now,
      }),
    )
    .filter((projection): projection is SocialExecutionAttemptDerivedStateProjection => projection !== null);
}
