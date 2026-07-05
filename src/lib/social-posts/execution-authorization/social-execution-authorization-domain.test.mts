import assert from "node:assert/strict";
import test from "node:test";

import {
  SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
  buildExecutionAuthorizationIdentity,
  deriveExecutionAuthorizationState,
  validateExecutionAuthorizationRecord,
  type SocialExecutionAuthorizationRecord,
} from "./social-execution-authorization-domain";

test("validateExecutionAuthorizationRecord rejects missing owner approval", () => {
  const identity = buildExecutionAuthorizationIdentity({
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
  });

  const result = validateExecutionAuthorizationRecord({
    authorizationVersion: SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
    authorizationId: "exec-auth:test-1",
    authorizationIdentity: identity,
    scope: {
      scopeKind: "publication_target_execution",
      executionIntentId: "execution-intent-1",
      publicationTargetId: "target-1",
      ownerApprovalId: "",
      approvalId: null,
      socialPostId: null,
    },
    authorizationState: "authorized",
    correlationId: "corr:test-1",
    authorizedAt: "2026-07-05T12:00:00.000Z",
    expiresAt: "2026-07-06T12:00:00.000Z",
    ownerApprovalId: "",
    publicationTargetId: "target-1",
    executionIntentId: "execution-intent-1",
    adminActorId: "owner-1",
    createdAt: "2026-07-05T12:00:00.000Z",
    appendOnly: true,
    immutable: true,
    containsSecrets: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    authorizesFutureExecutionOnly: true,
  });

  assert.equal(result.ok, false);
  assert.ok(result.ok === false && result.errors.some((error) => error.code === "owner_approval_id_required"));
});

test("validateExecutionAuthorizationRecord rejects duplicate authorization identities", () => {
  const identity = buildExecutionAuthorizationIdentity({
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
  });

  const record: SocialExecutionAuthorizationRecord = {
    authorizationVersion: SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
    authorizationId: "exec-auth:test-1",
    authorizationIdentity: identity,
    scope: {
      scopeKind: "publication_target_execution",
      executionIntentId: "execution-intent-1",
      publicationTargetId: "target-1",
      ownerApprovalId: "owner-approval-1",
      approvalId: null,
      socialPostId: null,
    },
    authorizationState: "authorized",
    correlationId: "corr:test-1",
    authorizedAt: "2026-07-05T12:00:00.000Z",
    expiresAt: "2026-07-06T12:00:00.000Z",
    ownerApprovalId: "owner-approval-1",
    publicationTargetId: "target-1",
    executionIntentId: "execution-intent-1",
    adminActorId: "owner-1",
    createdAt: "2026-07-05T12:00:00.000Z",
    appendOnly: true,
    immutable: true,
    containsSecrets: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    authorizesFutureExecutionOnly: true,
  };

  const result = validateExecutionAuthorizationRecord(record, new Set([identity]));
  assert.equal(result.ok, false);
  assert.ok(result.ok === false && result.errors.some((error) => error.code === "authorization_identity_duplicate"));
});

test("deriveExecutionAuthorizationState returns cancelled when cancellation exists", () => {
  const authorization: SocialExecutionAuthorizationRecord = {
    authorizationVersion: SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
    authorizationId: "exec-auth:test-1",
    authorizationIdentity: buildExecutionAuthorizationIdentity({
      executionIntentId: "execution-intent-1",
      publicationTargetId: "target-1",
    }),
    scope: {
      scopeKind: "publication_target_execution",
      executionIntentId: "execution-intent-1",
      publicationTargetId: "target-1",
      ownerApprovalId: "owner-approval-1",
      approvalId: null,
      socialPostId: null,
    },
    authorizationState: "authorized",
    correlationId: "corr:test-1",
    authorizedAt: "2026-07-05T12:00:00.000Z",
    expiresAt: "2026-07-06T12:00:00.000Z",
    ownerApprovalId: "owner-approval-1",
    publicationTargetId: "target-1",
    executionIntentId: "execution-intent-1",
    adminActorId: "owner-1",
    createdAt: "2026-07-05T12:00:00.000Z",
    appendOnly: true,
    immutable: true,
    containsSecrets: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    authorizesFutureExecutionOnly: true,
  };

  const state = deriveExecutionAuthorizationState({
    authorization,
    cancellation: {
      cancellationId: "exec-auth-cancel:1",
      authorizationId: authorization.authorizationId,
      authorizationIdentity: authorization.authorizationIdentity,
      correlationId: authorization.correlationId,
      cancelledAt: "2026-07-05T13:00:00.000Z",
      adminActorId: "owner-1",
      sanitizedDetail: "execution_authorization_cancelled",
      createdAt: "2026-07-05T13:00:00.000Z",
      appendOnly: true,
      immutable: true,
      containsSecrets: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
  });

  assert.equal(state, "cancelled");
});
