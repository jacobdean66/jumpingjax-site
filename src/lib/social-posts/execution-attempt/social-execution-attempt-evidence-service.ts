import { randomUUID } from "node:crypto";

import {
  loadSocialExecutionAuthorizationSnapshot,
} from "../execution-authorization/social-execution-authorization-store";
import {
  buildExecutionAttemptEvidenceId,
  SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VERSION,
  validateExecutionAttemptEvidenceRecord,
  type SocialExecutionAttemptEvidenceRecord,
} from "./social-execution-attempt-evidence-domain";
import { validateExecutionAttemptEvidenceAppendRequest } from "./social-execution-attempt-evidence-request";
import { verifyOwnerApprovalForEvidenceAppend } from "./social-execution-attempt-evidence-owner-approval";
import {
  appendSocialExecutionAttemptEvidenceRecord,
  appendSocialExecutionAttemptStateTransition,
  isSocialExecutionAttemptEvidenceStoreConfigured,
  loadSocialExecutionAttemptEvidenceSnapshot,
} from "./social-execution-attempt-evidence-store";
import {
  deriveExecutionAttemptStatus,
} from "./social-execution-attempt-domain";
import {
  buildExecutionAttemptStateTransitionId,
  SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_VERSION,
  isValidExecutionAttemptStateTransition,
  resolveTransitionKindTargetState,
  validateExecutionAttemptStateTransitionRecord,
  type SocialExecutionAttemptStateTransitionRecord,
} from "./social-execution-attempt-state-transition-domain";
import {
  appendSocialExecutionAttemptAuditEvent,
  isSocialExecutionAttemptStoreConfigured,
  loadSocialExecutionAttemptSnapshot,
} from "./social-execution-attempt-store";
import { evaluateExecutionAttemptEvidenceAppendAvailability } from "./social-execution-attempt-evidence-append-preflight";

export const SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_APPEND_SERVICE_VERSION = "d16-w9-v1" as const;

export type SocialExecutionAttemptEvidenceAppendServiceResult = Readonly<
  | {
      ok: true;
      evidenceId: string;
      attemptId: string;
      correlationId: string;
      transitionId: string | null;
    }
  | { ok: false; code: string; message: string }
>;

export type SocialExecutionAttemptEvidenceAppendServiceDependencies = Readonly<{
  verifyOwnerApproval: (
    ownerApprovalId: string,
  ) => Promise<
    | { ok: true }
    | { ok: false; code: string; message: string }
  >;
}>;

let testDependencies: SocialExecutionAttemptEvidenceAppendServiceDependencies | null = null;

export function configureSocialExecutionAttemptEvidenceAppendServiceTestDependencies(
  dependencies: SocialExecutionAttemptEvidenceAppendServiceDependencies | null,
): void {
  testDependencies = dependencies;
}

export function createExecutionAttemptEvidenceId(): string {
  return buildExecutionAttemptEvidenceId(randomUUID());
}

export function createExecutionAttemptEvidenceTransitionId(): string {
  return buildExecutionAttemptStateTransitionId(randomUUID());
}

export function createExecutionAttemptEvidenceAuditEventId(): string {
  return `exec-attempt-audit:${randomUUID()}`;
}

export async function appendExecutionAttemptEvidenceForOwner(input: {
  attemptId: unknown;
  ownerApprovalId: unknown;
  evidenceKind: unknown;
  sanitizedSummary: unknown;
  transitionKind?: unknown;
  adminActorId: string;
  now?: Date;
}): Promise<SocialExecutionAttemptEvidenceAppendServiceResult> {
  const validation = validateExecutionAttemptEvidenceAppendRequest({
    attemptId: input.attemptId,
    ownerApprovalId: input.ownerApprovalId,
    evidenceKind: input.evidenceKind,
    sanitizedSummary: input.sanitizedSummary,
    transitionKind: input.transitionKind,
  });

  if (!validation.ok) {
    await appendEvidenceAuditEvent({
      attemptId: null,
      correlationId: null,
      action: "append_evidence_validation_failed",
      outcome: "validation_failed",
      sanitizedDetail: validation.code,
      createdAt: new Date().toISOString(),
    });

    return { ok: false, code: validation.code, message: validation.message };
  }

  if (
    !isSocialExecutionAttemptStoreConfigured() ||
    !isSocialExecutionAttemptEvidenceStoreConfigured()
  ) {
    return {
      ok: false,
      code: "storage_unavailable",
      message: "Execution attempt evidence storage is not configured.",
    };
  }

  const now = input.now ?? new Date();
  const nowIso = now.toISOString();

  const [attemptSnapshot, authorizationSnapshot] = await Promise.all([
    loadSocialExecutionAttemptSnapshot(),
    loadSocialExecutionAuthorizationSnapshot(),
  ]);

  const attempt =
    attemptSnapshot.attempts.find((record) => record.attemptId === validation.attemptId) ?? null;

  if (!attempt) {
    await appendEvidenceAuditEvent({
      attemptId: validation.attemptId,
      correlationId: null,
      action: "append_evidence_validation_failed",
      outcome: "not_found",
      sanitizedDetail: "attempt_not_found",
      createdAt: nowIso,
    });

    return {
      ok: false,
      code: "attempt_not_found",
      message: "Execution attempt could not be found for evidence append.",
    };
  }

  const authorization =
    authorizationSnapshot.authorizations.find(
      (record) => record.authorizationId === attempt.authorizationId,
    ) ?? null;

  if (!authorization) {
    await appendEvidenceAuditEvent({
      attemptId: validation.attemptId,
      correlationId: attempt.correlationId,
      action: "append_evidence_validation_failed",
      outcome: "not_found",
      sanitizedDetail: "authorization_not_found",
      createdAt: nowIso,
    });

    return {
      ok: false,
      code: "authorization_not_found",
      message: "Execution authorization could not be found for evidence append.",
    };
  }

  if (validation.ownerApprovalId !== authorization.ownerApprovalId) {
    await appendEvidenceAuditEvent({
      attemptId: validation.attemptId,
      correlationId: attempt.correlationId,
      action: "append_evidence_validation_failed",
      outcome: "validation_failed",
      sanitizedDetail: "owner_approval_reference_mismatch",
      createdAt: nowIso,
    });

    return {
      ok: false,
      code: "owner_approval_reference_mismatch",
      message: "owner_approval_id must match the authorization owner approval reference.",
    };
  }

  const ownerApprovalVerification = await dependencies().verifyOwnerApproval(
    validation.ownerApprovalId,
  );
  if (!ownerApprovalVerification.ok) {
    await appendEvidenceAuditEvent({
      attemptId: validation.attemptId,
      correlationId: attempt.correlationId,
      action: "append_evidence_validation_failed",
      outcome: "validation_failed",
      sanitizedDetail: ownerApprovalVerification.code,
      createdAt: nowIso,
    });

    return {
      ok: false,
      code: ownerApprovalVerification.code,
      message: ownerApprovalVerification.message,
    };
  }

  const availability = evaluateExecutionAttemptEvidenceAppendAvailability({
    attemptId: validation.attemptId,
    ownerApprovalId: validation.ownerApprovalId,
    attempt,
    attemptSnapshot,
    authorizationSnapshot,
    transitionKind: validation.transitionKind,
    now,
  });

  if (!availability.evidenceAppendAvailable) {
    const detail = availability.appendBlockingCodes[0] ?? "evidence_append_unavailable";
    await appendEvidenceAuditEvent({
      attemptId: validation.attemptId,
      correlationId: attempt.correlationId,
      action: "append_evidence_validation_failed",
      outcome: "validation_failed",
      sanitizedDetail: detail,
      createdAt: nowIso,
    });

    return {
      ok: false,
      code: detail,
      message: "Execution attempt evidence append is not available for this attempt.",
    };
  }

  const lifecycleEvents = attemptSnapshot.lifecycleEvents.filter(
    (event) => event.attemptId === attempt.attemptId,
  );
  const derivedLifecycleState = deriveExecutionAttemptStatus({
    attempt,
    lifecycleEvents,
    authorizationSnapshot,
    now,
  });
  const fromState = derivedLifecycleState === "missing" ? "missing" : derivedLifecycleState;

  const evidenceId = createExecutionAttemptEvidenceId();
  const transitionId = validation.transitionKind
    ? createExecutionAttemptEvidenceTransitionId()
    : null;

  const evidence: SocialExecutionAttemptEvidenceRecord = {
    evidenceVersion: SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VERSION,
    evidenceId,
    attemptId: validation.attemptId,
    correlationId: attempt.correlationId,
    transitionId,
    evidenceKind: validation.evidenceKind,
    sanitizedSummary: validation.sanitizedSummary,
    evidencePayload: {
      evidenceKind: validation.evidenceKind,
      adminActorId: input.adminActorId,
      ownerApprovalId: validation.ownerApprovalId,
    },
    recordedAt: nowIso,
    recordedByActor: "owner",
    recordedSource: "manual_admin",
    appendOnly: true,
    immutable: true,
    metadataOnly: true,
    containsSecrets: false,
    provesExecution: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };

  const evidenceValidation = validateExecutionAttemptEvidenceRecord(evidence);
  if (!evidenceValidation.ok) {
    return {
      ok: false,
      code: evidenceValidation.errors[0]?.code ?? "validation_failed",
      message: evidenceValidation.errors[0]?.message ?? "Evidence validation failed.",
    };
  }

  let transition: SocialExecutionAttemptStateTransitionRecord | null = null;
  if (validation.transitionKind) {
    const toState = resolveTransitionKindTargetState(validation.transitionKind);
    if (!isValidExecutionAttemptStateTransition(fromState, toState)) {
      return {
        ok: false,
        code: "transition_unavailable",
        message: "Requested state transition is not valid for the current attempt lifecycle.",
      };
    }

    transition = {
      transitionVersion: SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_VERSION,
      transitionId: transitionId!,
      attemptId: validation.attemptId,
      correlationId: attempt.correlationId,
      fromState,
      toState,
      transitionKind: validation.transitionKind,
      evidenceId,
      createdAt: nowIso,
      appendOnly: true,
      immutable: true,
      metadataOnly: true,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    };

    const transitionValidation = validateExecutionAttemptStateTransitionRecord(transition);
    if (!transitionValidation.ok) {
      return {
        ok: false,
        code: transitionValidation.errors[0]?.code ?? "validation_failed",
        message:
          transitionValidation.errors[0]?.message ?? "State transition validation failed.",
      };
    }
  }

  try {
    await appendSocialExecutionAttemptEvidenceRecord(evidence);
    if (transition) {
      await appendSocialExecutionAttemptStateTransition(transition);
    }
    await appendEvidenceAuditEvent({
      attemptId: validation.attemptId,
      correlationId: attempt.correlationId,
      action: "append_evidence",
      outcome: "success",
      sanitizedDetail: transition
        ? "execution_attempt_evidence_and_transition_appended"
        : "execution_attempt_evidence_appended",
      createdAt: nowIso,
    });
  } catch (error) {
    await appendEvidenceAuditEvent({
      attemptId: validation.attemptId,
      correlationId: attempt.correlationId,
      action: "append_evidence",
      outcome: "storage_error",
      sanitizedDetail: "execution_attempt_evidence_storage_error",
      createdAt: nowIso,
    }).catch(() => undefined);

    return {
      ok: false,
      code: "storage_error",
      message: error instanceof Error ? error.message : "Execution attempt evidence storage failed.",
    };
  }

  return {
    ok: true,
    evidenceId,
    attemptId: validation.attemptId,
    correlationId: attempt.correlationId,
    transitionId,
  };
}

async function appendEvidenceAuditEvent(input: {
  attemptId: string | null;
  correlationId: string | null;
  action: "append_evidence" | "append_evidence_validation_failed";
  outcome: "success" | "validation_failed" | "not_found" | "storage_error";
  sanitizedDetail: string;
  createdAt: string;
}): Promise<void> {
  await appendSocialExecutionAttemptAuditEvent({
    audit_event_id: createExecutionAttemptEvidenceAuditEventId(),
    attempt_id: input.attemptId,
    attempt_identity: null,
    correlation_id: input.correlationId,
    action: input.action,
    outcome: input.outcome,
    sanitized_detail: input.sanitizedDetail,
    created_at: input.createdAt,
  }).catch(() => undefined);
}

function dependencies(): SocialExecutionAttemptEvidenceAppendServiceDependencies {
  return (
    testDependencies ?? {
      verifyOwnerApproval: verifyOwnerApprovalForEvidenceAppend,
    }
  );
}

export async function loadExecutionAttemptEvidenceAppendContext(): Promise<
  Readonly<{
    attemptSnapshot: Awaited<ReturnType<typeof loadSocialExecutionAttemptSnapshot>>;
    evidenceSnapshot: Awaited<ReturnType<typeof loadSocialExecutionAttemptEvidenceSnapshot>>;
  }>
> {
  const [attemptSnapshot, evidenceSnapshot] = await Promise.all([
    loadSocialExecutionAttemptSnapshot(),
    loadSocialExecutionAttemptEvidenceSnapshot(),
  ]);
  return { attemptSnapshot, evidenceSnapshot };
}
