import assert from "node:assert/strict";
import test from "node:test";

import {
  SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
  buildExecutionAuthorizationIdentity,
  type SocialExecutionAuthorizationRecord,
} from "../execution-authorization/social-execution-authorization-domain";
import {
  SOCIAL_EXECUTION_ATTEMPT_VERSION,
  buildExecutionAttemptIdentity,
  type SocialExecutionAttemptRecord,
} from "../execution-attempt/social-execution-attempt-domain";
import {
  buildExecutionAttemptFingerprint,
  buildExecutionAttemptIdempotencyKey,
  buildExecutionAttemptReplayKey,
} from "../execution-attempt/social-execution-attempt-idempotency-domain";
import { SOCIAL_EXECUTION_SESSION_VERSION } from "./social-execution-session-domain";
import type { SocialExecutionSessionRecord } from "./social-execution-session-domain";
import {
  filterExecutionSessionsByIdentity,
  normalizeExecutionSessionQueryLimit,
  paginateExecutionSessions,
  querySocialExecutionSessionRecords,
  sortExecutionSessionsDeterministically,
} from "./social-execution-session-repository";

const AUTH_ID = "exec-auth:repo-test-1";
const ATTEMPT_ID = "exec-attempt:repo-test-1";
const ATTEMPT_ID_2 = "exec-attempt:repo-test-2";
const CORRELATION_ID = "corr:repo-test-1";
const SOCIAL_POST_ID = "social-post-repo-1";
const EXECUTION_INTENT_ID = "execution-intent-repo-1";

function sampleSession(input: {
  sessionId: string;
  attemptIds: readonly string[];
  transcriptIds: readonly string[];
  createdAt: string;
}): SocialExecutionSessionRecord {
  return {
    sessionVersion: SOCIAL_EXECUTION_SESSION_VERSION,
    sessionId: input.sessionId,
    correlationId: CORRELATION_ID,
    transcriptIds: input.transcriptIds,
    attemptIds: input.attemptIds,
    summaryStatus: "simulated",
    sanitizedSummary: "summary",
    createdAt: input.createdAt,
    completedAt: input.createdAt,
    appendOnly: true,
    immutable: true,
    metadataOnly: true,
    simulatedOnly: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    provesExecution: false,
    usesNoNetwork: true,
    usesNoOAuth: true,
    usesNoCredentials: true,
    callsNoExternalApis: true,
  };
}

function sampleAuthorization(): SocialExecutionAuthorizationRecord {
  return {
    authorizationVersion: SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
    authorizationId: AUTH_ID,
    authorizationIdentity: buildExecutionAuthorizationIdentity({
      executionIntentId: EXECUTION_INTENT_ID,
      publicationTargetId: "target-1",
    }),
    scope: {
      scopeKind: "publication_target_execution",
      executionIntentId: EXECUTION_INTENT_ID,
      publicationTargetId: "target-1",
      ownerApprovalId: "owner-approval-1",
      approvalId: null,
      socialPostId: SOCIAL_POST_ID,
    },
    authorizationState: "authorized",
    correlationId: CORRELATION_ID,
    authorizedAt: "2026-07-06T12:00:00.000Z",
    expiresAt: "2026-07-07T12:00:00.000Z",
    ownerApprovalId: "owner-approval-1",
    publicationTargetId: "target-1",
    executionIntentId: EXECUTION_INTENT_ID,
    adminActorId: "owner-1",
    createdAt: "2026-07-06T12:00:00.000Z",
    appendOnly: true,
    immutable: true,
    containsSecrets: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    authorizesFutureExecutionOnly: true,
  };
}

function sampleAttempt(attemptId: string): SocialExecutionAttemptRecord {
  return {
    attemptVersion: SOCIAL_EXECUTION_ATTEMPT_VERSION,
    attemptId,
    attemptIdentity: buildExecutionAttemptIdentity({
      executionIntentId: EXECUTION_INTENT_ID,
      publicationTargetId: "target-1",
      authorizationId: AUTH_ID,
    }),
    authorizationId: AUTH_ID,
    sessionId: "exec-runtime-session:repo-test-1",
    publicationTargetId: "target-1",
    executionIntentId: EXECUTION_INTENT_ID,
    correlationId: CORRELATION_ID,
    idempotencyKey: buildExecutionAttemptIdempotencyKey({
      executionIntentId: EXECUTION_INTENT_ID,
      publicationTargetId: "target-1",
      authorizationId: AUTH_ID,
    }),
    replayKey: buildExecutionAttemptReplayKey({ attemptId, correlationId: CORRELATION_ID }),
    attemptFingerprint: buildExecutionAttemptFingerprint({
      executionIntentId: EXECUTION_INTENT_ID,
      publicationTargetId: "target-1",
      authorizationId: AUTH_ID,
      sessionId: "exec-runtime-session:repo-test-1",
      correlationId: CORRELATION_ID,
    }),
    createdAt: "2026-07-06T12:00:00.000Z",
    expiresAt: "2026-07-07T12:00:00.000Z",
    appendOnly: true,
    immutable: true,
    metadataOnly: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    subordinateToAuthorization: true,
  };
}

const correlationContext = {
  attemptSnapshot: {
    attempts: [sampleAttempt(ATTEMPT_ID), sampleAttempt(ATTEMPT_ID_2)],
    lifecycleEvents: [],
    auditEvents: [],
  },
  authorizationSnapshot: {
    authorizations: [sampleAuthorization()],
    cancellations: [],
    intents: [],
    sessions: [],
    auditEvents: [],
  },
};

test("normalizeExecutionSessionQueryLimit clamps to repository max", () => {
  assert.equal(normalizeExecutionSessionQueryLimit(undefined), 50);
  assert.equal(normalizeExecutionSessionQueryLimit(9999), 500);
});

test("sortExecutionSessionsDeterministically orders by createdAt then sessionId", () => {
  const sorted = sortExecutionSessionsDeterministically([
    sampleSession({
      sessionId: "exec-execution-session:b",
      attemptIds: [ATTEMPT_ID],
      transcriptIds: ["exec-runner-transcript:b"],
      createdAt: "2026-07-06T12:00:00.000Z",
    }),
    sampleSession({
      sessionId: "exec-execution-session:a",
      attemptIds: [ATTEMPT_ID],
      transcriptIds: ["exec-runner-transcript:a"],
      createdAt: "2026-07-06T12:01:00.000Z",
    }),
  ]);

  assert.equal(sorted[0]?.sessionId, "exec-execution-session:a");
});

test("filterExecutionSessionsByIdentity supports attempt, transcript, and authorization correlation", () => {
  const sessions = [
    sampleSession({
      sessionId: "exec-execution-session:one",
      attemptIds: [ATTEMPT_ID],
      transcriptIds: ["exec-runner-transcript:one"],
      createdAt: "2026-07-06T12:00:00.000Z",
    }),
    sampleSession({
      sessionId: "exec-execution-session:two",
      attemptIds: [ATTEMPT_ID_2],
      transcriptIds: ["exec-runner-transcript:two"],
      createdAt: "2026-07-06T12:01:00.000Z",
    }),
  ];

  assert.equal(
    filterExecutionSessionsByIdentity({
      sessions,
      identity: { attemptId: ATTEMPT_ID },
    }).length,
    1,
  );
  assert.equal(
    filterExecutionSessionsByIdentity({
      sessions,
      identity: { transcriptId: "exec-runner-transcript:two" },
    }).length,
    1,
  );
  assert.equal(
    filterExecutionSessionsByIdentity({
      sessions,
      identity: { authorizationId: AUTH_ID },
      correlationContext,
    }).length,
    2,
  );
});

test("querySocialExecutionSessionRecords applies pagination and correlation filters", () => {
  const sessions = Array.from({ length: 3 }, (_, index) =>
    sampleSession({
      sessionId: `exec-execution-session:${index}`,
      attemptIds: [ATTEMPT_ID],
      transcriptIds: [`exec-runner-transcript:${index}`],
      createdAt: `2026-07-06T12:0${index}:00.000Z`,
    }),
  );

  const result = querySocialExecutionSessionRecords({
    snapshot: { sessions, auditEvents: [] },
    identity: {
      socialPostId: SOCIAL_POST_ID,
      executionIntentId: EXECUTION_INTENT_ID,
    },
    correlationContext,
    queryOptions: { limit: 2, offset: 1 },
  });

  assert.equal(result.pagination.totalCount, 3);
  assert.equal(result.pagination.returnedCount, 2);
  assert.equal(result.pagination.offset, 1);
  assert.equal(result.pagination.hasMore, false);
  assert.equal(result.sessions.length, 2);
});

test("paginateExecutionSessions reports hasMore when additional records exist", () => {
  const paginated = paginateExecutionSessions({
    sessions: [
      sampleSession({
        sessionId: "exec-execution-session:one",
        attemptIds: [ATTEMPT_ID],
        transcriptIds: ["exec-runner-transcript:one"],
        createdAt: "2026-07-06T12:00:00.000Z",
      }),
      sampleSession({
        sessionId: "exec-execution-session:two",
        attemptIds: [ATTEMPT_ID],
        transcriptIds: ["exec-runner-transcript:two"],
        createdAt: "2026-07-06T12:01:00.000Z",
      }),
    ],
    queryOptions: { limit: 1, offset: 0 },
  });

  assert.equal(paginated.pagination.hasMore, true);
  assert.equal(paginated.sessions.length, 1);
});
