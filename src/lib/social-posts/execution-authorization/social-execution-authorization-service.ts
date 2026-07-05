import { randomUUID } from "node:crypto";

import {
  SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
  buildExecutionAuthorizationIdentity,
  validateExecutionAuthorizationCancellationRecord,
  validateExecutionAuthorizationRecord,
  type SocialExecutionAuthorizationCancellationRecord,
  type SocialExecutionAuthorizationRecord,
} from "./social-execution-authorization-domain";
import {
  validateExecutionAuthorizationIntentRecord,
  type SocialExecutionAuthorizationIntentRecord,
} from "./social-execution-authorization-intent-domain";
import {
  validateExecutionRuntimeSessionRecord,
  type SocialExecutionRuntimeSessionRecord,
} from "./social-execution-runtime-session-domain";
import { validateExecutionAuthorizationCancellationRequest } from "./social-execution-authorization-cancellation-request";
import {
  verifyOwnerApprovalForExecutionAuthorization,
  type SocialExecutionAuthorizationOwnerApprovalVerificationResult,
} from "./social-execution-authorization-owner-approval";
import { validateExecutionAuthorizationRequest } from "./social-execution-authorization-request";
import {
  appendSocialExecutionAuthorizationAuditEvent,
  appendSocialExecutionAuthorizationCancellation,
  appendSocialExecutionAuthorizationIntentRecord,
  appendSocialExecutionAuthorizationRecord,
  appendSocialExecutionRuntimeSessionRecord,
  isSocialExecutionAuthorizationStoreConfigured,
  loadSocialExecutionAuthorizationSnapshot,
} from "./social-execution-authorization-store";

export const SOCIAL_EXECUTION_AUTHORIZATION_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export type SocialExecutionAuthorizationServiceDependencies = Readonly<{
  verifyOwnerApprovalForAuthorization: (
    input: Readonly<{
      ownerApprovalId: string;
      executionIntentId: string;
      publicationTargetId: string;
      socialPostId: string | null;
      approvalId: string | null;
    }>,
  ) => Promise<SocialExecutionAuthorizationOwnerApprovalVerificationResult>;
}>;

let testDependencies: SocialExecutionAuthorizationServiceDependencies | null = null;

export function configureSocialExecutionAuthorizationServiceTestDependencies(
  dependencies: SocialExecutionAuthorizationServiceDependencies | null,
): void {
  testDependencies = dependencies;
}

function dependencies(): SocialExecutionAuthorizationServiceDependencies {
  return (
    testDependencies ?? {
      verifyOwnerApprovalForAuthorization: verifyOwnerApprovalForExecutionAuthorization,
    }
  );
}

export type SocialExecutionAuthorizationServiceResult = Readonly<
  | {
      ok: true;
      authorizationId: string;
      sessionId: string;
      correlationId: string;
      authorizationIdentity: string;
    }
  | { ok: false; code: string; message: string }
>;

export type SocialExecutionAuthorizationCancellationServiceResult = Readonly<
  | {
      ok: true;
      cancellationId: string;
      authorizationId: string;
      correlationId: string;
    }
  | { ok: false; code: string; message: string }
>;

export function createExecutionAuthorizationId(): string {
  return `exec-auth:${randomUUID()}`;
}

export function createExecutionAuthorizationCancellationId(): string {
  return `exec-auth-cancel:${randomUUID()}`;
}

export function createExecutionAuthorizationIntentRecordId(): string {
  return `exec-auth-intent:${randomUUID()}`;
}

export function createExecutionRuntimeSessionId(): string {
  return `exec-runtime-session:${randomUUID()}`;
}

export function createExecutionAuthorizationCorrelationId(): string {
  return `corr:${randomUUID()}`;
}

export function createExecutionAuthorizationAuditEventId(): string {
  return `exec-auth-audit:${randomUUID()}`;
}

export async function authorizeExecutionForOwner(input: {
  executionIntentId: unknown;
  publicationTargetId: unknown;
  ownerApprovalId: unknown;
  approvalId?: unknown;
  socialPostId?: unknown;
  adminActorId: string;
  now?: Date;
}): Promise<SocialExecutionAuthorizationServiceResult> {
  const validation = validateExecutionAuthorizationRequest({
    executionIntentId: input.executionIntentId,
    publicationTargetId: input.publicationTargetId,
    ownerApprovalId: input.ownerApprovalId,
    approvalId: input.approvalId,
    socialPostId: input.socialPostId,
  });

  if (!validation.ok) {
    await appendSocialExecutionAuthorizationAuditEvent({
      audit_event_id: createExecutionAuthorizationAuditEventId(),
      authorization_id: null,
      authorization_identity: buildExecutionAuthorizationIdentity({
        executionIntentId: String(input.executionIntentId ?? ""),
        publicationTargetId: String(input.publicationTargetId ?? ""),
      }),
      correlation_id: null,
      action: "authorize_validation_failed",
      outcome: "validation_failed",
      sanitized_detail: validation.code,
      admin_actor_id: input.adminActorId,
      created_at: new Date().toISOString(),
    }).catch(() => undefined);

    return { ok: false, code: validation.code, message: validation.message };
  }

  if (!isSocialExecutionAuthorizationStoreConfigured()) {
    return {
      ok: false,
      code: "storage_unavailable",
      message: "Execution authorization storage is not configured.",
    };
  }

  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + SOCIAL_EXECUTION_AUTHORIZATION_SESSION_TTL_MS).toISOString();
  const authorizationIdentity = buildExecutionAuthorizationIdentity({
    executionIntentId: validation.executionIntentId,
    publicationTargetId: validation.publicationTargetId,
  });

  const ownerApprovalVerification = await dependencies().verifyOwnerApprovalForAuthorization({
    ownerApprovalId: validation.ownerApprovalId,
    executionIntentId: validation.executionIntentId,
    publicationTargetId: validation.publicationTargetId,
    socialPostId: validation.socialPostId,
    approvalId: validation.approvalId,
  });
  if (!ownerApprovalVerification.ok) {
    await appendSocialExecutionAuthorizationAuditEvent({
      audit_event_id: createExecutionAuthorizationAuditEventId(),
      authorization_id: null,
      authorization_identity: authorizationIdentity,
      correlation_id: null,
      action: "authorize_validation_failed",
      outcome: "owner_approval_verification_failed",
      sanitized_detail: ownerApprovalVerification.code,
      admin_actor_id: input.adminActorId,
      created_at: nowIso,
    }).catch(() => undefined);

    return {
      ok: false,
      code: ownerApprovalVerification.code,
      message: ownerApprovalVerification.message,
    };
  }

  const snapshot = await loadSocialExecutionAuthorizationSnapshot();
  if (snapshot.authorizations.some((record) => record.authorizationIdentity === authorizationIdentity)) {
    await appendSocialExecutionAuthorizationAuditEvent({
      audit_event_id: createExecutionAuthorizationAuditEventId(),
      authorization_id: null,
      authorization_identity: authorizationIdentity,
      correlation_id: null,
      action: "authorize_validation_failed",
      outcome: "duplicate_identity",
      sanitized_detail: "authorization_identity_duplicate",
      admin_actor_id: input.adminActorId,
      created_at: nowIso,
    }).catch(() => undefined);

    return {
      ok: false,
      code: "authorization_identity_duplicate",
      message: "Execution authorization identity already exists.",
    };
  }

  const correlationId = createExecutionAuthorizationCorrelationId();
  const authorizationId = createExecutionAuthorizationId();
  const sessionId = createExecutionRuntimeSessionId();

  const authorization: SocialExecutionAuthorizationRecord = {
    authorizationVersion: SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
    authorizationId,
    authorizationIdentity,
    scope: {
      scopeKind: "publication_target_execution",
      executionIntentId: validation.executionIntentId,
      publicationTargetId: validation.publicationTargetId,
      ownerApprovalId: validation.ownerApprovalId,
      approvalId: validation.approvalId,
      socialPostId: validation.socialPostId,
    },
    authorizationState: "authorized",
    correlationId,
    authorizedAt: nowIso,
    expiresAt,
    ownerApprovalId: validation.ownerApprovalId,
    publicationTargetId: validation.publicationTargetId,
    executionIntentId: validation.executionIntentId,
    adminActorId: input.adminActorId,
    createdAt: nowIso,
    appendOnly: true,
    immutable: true,
    containsSecrets: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    authorizesFutureExecutionOnly: true,
  };

  const requestedIntent: SocialExecutionAuthorizationIntentRecord = {
    intentVersion: SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
    intentRecordId: createExecutionAuthorizationIntentRecordId(),
    executionIntentId: validation.executionIntentId,
    authorizationId: null,
    correlationId,
    intentState: "requested_execution",
    publicationTargetId: validation.publicationTargetId,
    ownerApprovalId: validation.ownerApprovalId,
    createdAt: nowIso,
    appendOnly: true,
    immutable: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };

  const authorizedIntent: SocialExecutionAuthorizationIntentRecord = {
    ...requestedIntent,
    intentRecordId: createExecutionAuthorizationIntentRecordId(),
    authorizationId,
    intentState: "authorized_execution",
  };

  const session: SocialExecutionRuntimeSessionRecord = {
    sessionVersion: SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
    sessionId,
    authorizationId,
    correlationId,
    runtimeStatus: "active",
    createdAt: nowIso,
    expiresAt,
    publicationTargetId: validation.publicationTargetId,
    executionIntentId: validation.executionIntentId,
    metadataOnly: true,
    appendOnly: true,
    immutable: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    backgroundWorkersForbidden: true,
  };

  const authorizationValidation = validateExecutionAuthorizationRecord(authorization);
  if (!authorizationValidation.ok) {
    return {
      ok: false,
      code: authorizationValidation.errors[0]?.code ?? "validation_failed",
      message: authorizationValidation.errors[0]?.message ?? "Execution authorization validation failed.",
    };
  }

  const requestedIntentValidation = validateExecutionAuthorizationIntentRecord(requestedIntent);
  const authorizedIntentValidation = validateExecutionAuthorizationIntentRecord(authorizedIntent);
  const sessionValidation = validateExecutionRuntimeSessionRecord(session);
  if (
    !requestedIntentValidation.ok ||
    !authorizedIntentValidation.ok ||
    !sessionValidation.ok
  ) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Execution authorization derived records failed validation.",
    };
  }

  try {
    await appendSocialExecutionAuthorizationIntentRecord(requestedIntent);
    await appendSocialExecutionAuthorizationRecord(authorization);
    await appendSocialExecutionAuthorizationIntentRecord(authorizedIntent);
    await appendSocialExecutionRuntimeSessionRecord(session);
    await appendSocialExecutionAuthorizationAuditEvent({
      audit_event_id: createExecutionAuthorizationAuditEventId(),
      authorization_id: authorizationId,
      authorization_identity: authorizationIdentity,
      correlation_id: correlationId,
      action: "authorize",
      outcome: "success",
      sanitized_detail: "execution_authorization_success",
      admin_actor_id: input.adminActorId,
      created_at: nowIso,
    });
  } catch (error) {
    await appendSocialExecutionAuthorizationAuditEvent({
      audit_event_id: createExecutionAuthorizationAuditEventId(),
      authorization_id: authorizationId,
      authorization_identity: authorizationIdentity,
      correlation_id: correlationId,
      action: "authorize",
      outcome: "storage_error",
      sanitized_detail: "execution_authorization_storage_error",
      admin_actor_id: input.adminActorId,
      created_at: nowIso,
    }).catch(() => undefined);

    return {
      ok: false,
      code: "storage_error",
      message: error instanceof Error ? error.message : "Execution authorization storage failed.",
    };
  }

  return {
    ok: true,
    authorizationId,
    sessionId,
    correlationId,
    authorizationIdentity,
  };
}

export async function cancelExecutionAuthorizationForOwner(input: {
  authorizationId: unknown;
  sanitizedDetail?: unknown;
  adminActorId: string;
  now?: Date;
}): Promise<SocialExecutionAuthorizationCancellationServiceResult> {
  const validation = validateExecutionAuthorizationCancellationRequest({
    authorizationId: input.authorizationId,
    sanitizedDetail: input.sanitizedDetail,
  });

  if (!validation.ok) {
    await appendSocialExecutionAuthorizationAuditEvent({
      audit_event_id: createExecutionAuthorizationAuditEventId(),
      authorization_id: null,
      authorization_identity: null,
      correlation_id: null,
      action: "cancel_validation_failed",
      outcome: "validation_failed",
      sanitized_detail: validation.code,
      admin_actor_id: input.adminActorId,
      created_at: new Date().toISOString(),
    }).catch(() => undefined);

    return { ok: false, code: validation.code, message: validation.message };
  }

  if (!isSocialExecutionAuthorizationStoreConfigured()) {
    return {
      ok: false,
      code: "storage_unavailable",
      message: "Execution authorization storage is not configured.",
    };
  }

  const snapshot = await loadSocialExecutionAuthorizationSnapshot();
  const authorization = snapshot.authorizations.find(
    (record) => record.authorizationId === validation.authorizationId,
  );
  if (!authorization) {
    await appendSocialExecutionAuthorizationAuditEvent({
      audit_event_id: createExecutionAuthorizationAuditEventId(),
      authorization_id: validation.authorizationId,
      authorization_identity: null,
      correlation_id: null,
      action: "cancel_validation_failed",
      outcome: "not_found",
      sanitized_detail: "authorization_not_found",
      admin_actor_id: input.adminActorId,
      created_at: new Date().toISOString(),
    }).catch(() => undefined);

    return {
      ok: false,
      code: "authorization_not_found",
      message: "Execution authorization could not be found.",
    };
  }

  const existingCancellation = snapshot.cancellations.find(
    (record) => record.authorizationId === validation.authorizationId,
  );
  if (existingCancellation) {
    return {
      ok: false,
      code: "authorization_already_cancelled",
      message: "Execution authorization is already cancelled.",
    };
  }

  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const cancellationId = createExecutionAuthorizationCancellationId();

  const cancellation: SocialExecutionAuthorizationCancellationRecord = {
    cancellationId,
    authorizationId: authorization.authorizationId,
    authorizationIdentity: authorization.authorizationIdentity,
    correlationId: authorization.correlationId,
    cancelledAt: nowIso,
    adminActorId: input.adminActorId,
    sanitizedDetail: validation.sanitizedDetail,
    createdAt: nowIso,
    appendOnly: true,
    immutable: true,
    containsSecrets: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };

  const cancelledIntent: SocialExecutionAuthorizationIntentRecord = {
    intentVersion: SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
    intentRecordId: createExecutionAuthorizationIntentRecordId(),
    executionIntentId: authorization.executionIntentId,
    authorizationId: authorization.authorizationId,
    correlationId: authorization.correlationId,
    intentState: "cancelled_execution",
    publicationTargetId: authorization.publicationTargetId,
    ownerApprovalId: authorization.ownerApprovalId,
    createdAt: nowIso,
    appendOnly: true,
    immutable: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };

  const cancellationValidation = validateExecutionAuthorizationCancellationRecord(cancellation);
  const cancelledIntentValidation = validateExecutionAuthorizationIntentRecord(cancelledIntent);
  if (!cancellationValidation.ok || !cancelledIntentValidation.ok) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Execution authorization cancellation validation failed.",
    };
  }

  try {
    await appendSocialExecutionAuthorizationCancellation(cancellation);
    await appendSocialExecutionAuthorizationIntentRecord(cancelledIntent);
    await appendSocialExecutionAuthorizationAuditEvent({
      audit_event_id: createExecutionAuthorizationAuditEventId(),
      authorization_id: authorization.authorizationId,
      authorization_identity: authorization.authorizationIdentity,
      correlation_id: authorization.correlationId,
      action: "cancel",
      outcome: "success",
      sanitized_detail: validation.sanitizedDetail,
      admin_actor_id: input.adminActorId,
      created_at: nowIso,
    });
  } catch (error) {
    return {
      ok: false,
      code: "storage_error",
      message: error instanceof Error ? error.message : "Execution authorization cancellation storage failed.",
    };
  }

  return {
    ok: true,
    cancellationId,
    authorizationId: authorization.authorizationId,
    correlationId: authorization.correlationId,
  };
}
