import assert from "node:assert/strict";
import test from "node:test";

import { replaySocialExecutionAuthorization, replaySocialExecutionAuthorizationByCorrelationId } from "./social-execution-authorization-replay";
import { SOCIAL_EXECUTION_AUTHORIZATION_VERSION, buildExecutionAuthorizationIdentity, type SocialExecutionAuthorizationRecord } from "./social-execution-authorization-domain";
import type { SocialExecutionRuntimeSessionRecord } from "./social-execution-runtime-session-domain";
import { EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT, type SocialExecutionAuthorizationPersistenceSnapshot } from "./social-execution-authorization-store";

test("replaySocialExecutionAuthorization returns deterministic read model", async () => {
  const identity = buildExecutionAuthorizationIdentity({
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
  });

  const authorization: SocialExecutionAuthorizationRecord = {
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

  const session: SocialExecutionRuntimeSessionRecord = {
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

  const snapshot: SocialExecutionAuthorizationPersistenceSnapshot = {
    ...EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT,
    authorizations: [authorization],
    sessions: [session],
  };

  const replay = await replaySocialExecutionAuthorization(snapshot, new Date("2026-07-05T13:00:00.000Z"));
  assert.equal(replay.summary.validAuthorizationCount, 1);
  assert.equal(replay.sessions[0]?.derivedSessionStatus, "active");

  const correlationReplay = replaySocialExecutionAuthorizationByCorrelationId(
    "corr:test-1",
    snapshot,
    new Date("2026-07-05T13:00:00.000Z"),
  );
  assert.equal(correlationReplay.authorizations.length, 1);
  assert.equal(correlationReplay.sessions.length, 1);
});
