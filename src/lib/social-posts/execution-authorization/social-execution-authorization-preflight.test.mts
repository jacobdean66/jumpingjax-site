import assert from "node:assert/strict";
import test from "node:test";

import { evaluateExecutionAuthorizationPreflightForIntent } from "./social-execution-authorization-preflight";
import { SOCIAL_EXECUTION_AUTHORIZATION_VERSION, buildExecutionAuthorizationIdentity } from "./social-execution-authorization-domain";
import { EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT } from "./social-execution-authorization-store";

test("evaluateExecutionAuthorizationPreflightForIntent blocks missing authorization", () => {
  const result = evaluateExecutionAuthorizationPreflightForIntent({
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
    snapshot: EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT,
  });

  assert.ok(result);
  assert.equal(result.authorizationValid, false);
  assert.deepEqual(result.preflightBlockingCodes, ["authorization_missing"]);
});

test("evaluateExecutionAuthorizationPreflightForIntent passes valid authorization", () => {
  const identity = buildExecutionAuthorizationIdentity({
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
  });

  const result = evaluateExecutionAuthorizationPreflightForIntent({
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
    snapshot: {
      ...EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT,
      authorizations: [
        {
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
        },
      ],
    },
    now: new Date("2026-07-05T13:00:00.000Z"),
  });

  assert.ok(result);
  assert.equal(result.authorizationValid, true);
  assert.equal(result.derivedAuthorizationState, "valid");
  assert.equal(result.ownerApprovalReferencePresent, true);
  assert.equal(result.ownerApprovalVerificationStatus, "not_evaluated");
});

test("evaluateExecutionAuthorizationPreflightForIntent blocks missing owner approval reference", () => {
  const identity = buildExecutionAuthorizationIdentity({
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
  });

  const result = evaluateExecutionAuthorizationPreflightForIntent({
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
    snapshot: {
      ...EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT,
      authorizations: [
        {
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
        },
      ],
    },
    now: new Date("2026-07-05T13:00:00.000Z"),
  });

  assert.ok(result);
  assert.equal(result.authorizationValid, false);
  assert.ok(result.preflightBlockingCodes.includes("owner_approval_reference_missing"));
});
