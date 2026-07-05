import type { SocialExecutionAuthorizationPersistenceSnapshot } from "../execution-authorization/social-execution-authorization-store";
import { SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VERSION } from "./social-execution-attempt-evidence-domain";
import { replaySocialExecutionAttemptForIntent } from "./social-execution-attempt-replay";
import type { SocialExecutionAttemptPersistenceSnapshot } from "./social-execution-attempt-store";
import { EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT } from "./social-execution-attempt-store";
import {
  deriveExecutionAttemptCompositeState,
  type SocialExecutionAttemptEvidenceCoverageStatus,
} from "./social-execution-attempt-state-domain";
import type { SocialExecutionAttemptStateTransitionKind } from "./social-execution-attempt-state-transition-domain";
import type { SocialExecutionAttemptEvidencePersistenceSnapshot } from "./social-execution-attempt-evidence-store";
import { EMPTY_SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_PERSISTENCE_SNAPSHOT } from "./social-execution-attempt-evidence-store";

export const SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_PREFLIGHT_VERSION =
  SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VERSION;

export type SocialExecutionAttemptEvidencePreflightSummary = Readonly<{
  preflightVersion: typeof SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_PREFLIGHT_VERSION;
  executionIntentId: string;
  publicationTargetId: string;
  attemptId: string | null;
  correlationId: string | null;
  evidenceCount: number;
  transitionCount: number;
  evidenceCoverageStatus: SocialExecutionAttemptEvidenceCoverageStatus;
  latestEvidenceKind: string | null;
  latestTransitionKind: SocialExecutionAttemptStateTransitionKind | null;
  derivedLifecycleState: ReturnType<typeof replaySocialExecutionAttemptForIntent>["attempts"][number]["derivedLifecycleState"] | null;
  derivedTransitionState: string | null;
  evidenceAligned: boolean;
  informationalOnly: true;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export function evaluateExecutionAttemptEvidencePreflightForIntent(input: {
  executionIntentId: string | null;
  publicationTargetId: string | null;
  attemptSnapshot?: SocialExecutionAttemptPersistenceSnapshot;
  evidenceSnapshot?: SocialExecutionAttemptEvidencePersistenceSnapshot;
  authorizationSnapshot?: SocialExecutionAuthorizationPersistenceSnapshot;
  now?: Date;
}): SocialExecutionAttemptEvidencePreflightSummary | null {
  if (!hasText(input.executionIntentId) || !hasText(input.publicationTargetId)) {
    return null;
  }

  const attemptSnapshot = input.attemptSnapshot ?? EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT;
  const evidenceSnapshot =
    input.evidenceSnapshot ?? EMPTY_SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_PERSISTENCE_SNAPSHOT;

  const replay = replaySocialExecutionAttemptForIntent({
    executionIntentId: input.executionIntentId,
    publicationTargetId: input.publicationTargetId,
    attemptSnapshot,
    authorizationSnapshot: input.authorizationSnapshot,
    now: input.now,
  });

  const primaryAttempt = replay.attempts[0] ?? null;
  const attemptLifecycle = primaryAttempt
    ? attemptSnapshot.lifecycleEvents.filter((event) => event.attemptId === primaryAttempt.attemptId)
    : [];

  const derivedState = primaryAttempt
    ? deriveExecutionAttemptCompositeState({
        attempt: attemptSnapshot.attempts.find(
          (record) => record.attemptId === primaryAttempt.attemptId,
        ) ?? null,
        lifecycleEvents: attemptLifecycle,
        evidenceRecords: evidenceSnapshot.evidenceRecords,
        stateTransitions: evidenceSnapshot.stateTransitions,
        authorizationSnapshot: input.authorizationSnapshot,
        now: input.now,
      })
    : null;

  const attemptEvidence = primaryAttempt
    ? evidenceSnapshot.evidenceRecords.filter((record) => record.attemptId === primaryAttempt.attemptId)
    : [];
  const attemptTransitions = primaryAttempt
    ? evidenceSnapshot.stateTransitions.filter((record) => record.attemptId === primaryAttempt.attemptId)
    : [];

  const latestEvidence =
    attemptEvidence.length > 0
      ? [...attemptEvidence].sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))[0]
      : null;
  const latestTransition =
    attemptTransitions.length > 0
      ? [...attemptTransitions].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
      : null;

  return {
    preflightVersion: SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_PREFLIGHT_VERSION,
    executionIntentId: input.executionIntentId,
    publicationTargetId: input.publicationTargetId,
    attemptId: primaryAttempt?.attemptId ?? null,
    correlationId: primaryAttempt?.correlationId ?? null,
    evidenceCount: derivedState?.evidenceCount ?? 0,
    transitionCount: derivedState?.transitionCount ?? 0,
    evidenceCoverageStatus: derivedState?.evidenceCoverageStatus ?? "no_evidence",
    latestEvidenceKind: latestEvidence?.evidenceKind ?? null,
    latestTransitionKind: latestTransition?.transitionKind ?? null,
    derivedLifecycleState: primaryAttempt?.derivedLifecycleState ?? null,
    derivedTransitionState: derivedState?.derivedTransitionState ?? null,
    evidenceAligned: derivedState?.evidenceAligned ?? false,
    informationalOnly: true,
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
