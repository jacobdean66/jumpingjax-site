import assert from "node:assert/strict";
import test from "node:test";

import { SOCIAL_EXECUTION_AUTHORIZATION_VERSION, buildExecutionAuthorizationIdentity, type SocialExecutionAuthorizationRecord } from "../execution-authorization/social-execution-authorization-domain";
import type { SocialExecutionRuntimeSessionRecord } from "../execution-authorization/social-execution-runtime-session-domain";
import { evaluateExecutionAttemptCreationAvailability } from "./social-execution-attempt-creation-preflight";
import {
  buildExecutionAttemptIdentity,
  SOCIAL_EXECUTION_ATTEMPT_VERSION,
} from "./social-execution-attempt-domain";

function sampleAuthorization(): SocialExecutionAuthorizationRecord {
  const identity = buildExecutionAuthorizationIdentity({
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
  });

  return {
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
}

function sampleSession(): SocialExecutionRuntimeSessionRecord {
  return {
    sessionVersion: SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
    sessionId: "exec-runtime-session:test-1",
    authorizationId: "exec-auth:test-1",
    correlationId: "corr:test-1",
    runtimeStatus: "active",
    createdAt: "2026-07-05T12:00:00.000Z",
    expiresAt: "2026-07-06T12:00:00.000Z",
    publicationTargetId: "target-1",
    executionIntentId: "execution-intent-1",
    metadataOnly: true,
    appendOnly: true,
    immutable: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    backgroundWorkersForbidden: true,
  };
}

test("evaluateExecutionAttemptCreationAvailability allows creation when authorization and session are valid", () => {
  const availability = evaluateExecutionAttemptCreationAvailability({
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
    authorizationSnapshot: {
      authorizations: [sampleAuthorization()],
      cancellations: [],
      intents: [],
      sessions: [sampleSession()],
      auditEvents: [],
    },
    now: new Date("2026-07-05T13:00:00.000Z"),
  });

  assert.equal(availability.attemptCreationAvailable, true);
  assert.equal(availability.duplicateAttempt, false);
});

test("evaluateExecutionAttemptCreationAvailability blocks duplicate attempts", () => {
  const authorization = sampleAuthorization();
  const availability = evaluateExecutionAttemptCreationAvailability({
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
    authorizationSnapshot: {
      authorizations: [authorization],
      cancellations: [],
      intents: [],
      sessions: [sampleSession()],
      auditEvents: [],
    },
    attemptSnapshot: {
      attempts: [
        {
          attemptVersion: SOCIAL_EXECUTION_ATTEMPT_VERSION,
          attemptId: "exec-attempt:test-1",
          attemptIdentity: buildExecutionAttemptIdentity({
            executionIntentId: "execution-intent-1",
            publicationTargetId: "target-1",
            authorizationId: authorization.authorizationId,
          }),
          authorizationId: authorization.authorizationId,
          sessionId: "exec-runtime-session:test-1",
          publicationTargetId: "target-1",
          executionIntentId: "execution-intent-1",
          correlationId: "corr:test-1",
          idempotencyKey: "idempotency:test-1",
          replayKey: "replay:test-1",
          attemptFingerprint: "fingerprint:test-1",
          createdAt: "2026-07-05T12:00:00.000Z",
          expiresAt: "2026-07-06T12:00:00.000Z",
          appendOnly: true,
          immutable: true,
          metadataOnly: true,
          grantsExecutionPermission: false,
          executesNothing: true,
          publishesNothing: true,
          subordinateToAuthorization: true,
        },
      ],
      lifecycleEvents: [],
      auditEvents: [],
    },
    now: new Date("2026-07-05T13:00:00.000Z"),
  });

  assert.equal(availability.attemptCreationAvailable, false);
  assert.equal(availability.duplicateAttempt, true);
  assert.deepEqual(availability.creationBlockingCodes, ["duplicate_attempt"]);
});
