import assert from "node:assert/strict";
import test from "node:test";

import {
  SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
  buildExecutionAuthorizationIdentity,
  type SocialExecutionAuthorizationRecord,
} from "../execution-authorization/social-execution-authorization-domain";
import type { SocialExecutionRuntimeSessionRecord } from "../execution-authorization/social-execution-runtime-session-domain";
import {
  SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VERSION,
  buildExecutionAttemptEvidenceId,
} from "../execution-attempt/social-execution-attempt-evidence-domain";
import {
  SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_VERSION,
  buildExecutionAttemptStateTransitionId,
} from "../execution-attempt/social-execution-attempt-state-transition-domain";
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
import {
  SOCIAL_EXECUTION_ATTEMPT_LIFECYCLE_VERSION,
  type SocialExecutionAttemptLifecycleEventRecord,
} from "../execution-attempt/social-execution-attempt-lifecycle-domain";
import type { SocialExecutionAttemptEvidenceRecord } from "../execution-attempt/social-execution-attempt-evidence-domain";
import type { SocialExecutionAttemptStateTransitionRecord } from "../execution-attempt/social-execution-attempt-state-transition-domain";
import type { PublicationTargetDefinition } from "../social-publication-targets";
import type { SocialExecutionRunnerAuditEventRecord } from "../execution-runner/social-execution-runner-domain";
import {
  configureSocialExecutionRunnerStoreTestDependencies,
  resetSocialExecutionRunnerInMemoryStoreForTests,
  type SocialExecutionRunnerStoreStorage,
} from "../execution-runner/social-execution-runner-store";
import {
  deriveExecutionSessionSummaryStatus,
  detectForbiddenExecutionSessionState,
  validateExecutionSessionRecord,
  buildExecutionSessionTimeline,
} from "./social-execution-session-domain";
import { evaluateExecutionSessionPreflight } from "./social-execution-session-preflight";
import {
  configureSocialExecutionSessionStoreTestDependencies,
  resetSocialExecutionSessionInMemoryStoreForTests,
  type SocialExecutionSessionStoreStorage,
} from "./social-execution-session-store";
import { orchestrateDryRunExecutionSession } from "./social-execution-session-service";
import { replaySocialExecutionSession } from "./social-execution-session-replay";
import { buildExecutionSessionDiagnostics } from "./social-execution-session-diagnostics";

const ATTEMPT_ID = "exec-attempt:session-test-1";
const AUTH_ID = "exec-auth:session-test-1";
const SESSION_ID = "exec-runtime-session:session-test-1";
const CORRELATION_ID = "corr:session-test-1";

function sampleAuthorization(): SocialExecutionAuthorizationRecord {
  return {
    authorizationVersion: SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
    authorizationId: AUTH_ID,
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
    correlationId: CORRELATION_ID,
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
    sessionId: SESSION_ID,
    authorizationId: AUTH_ID,
    correlationId: CORRELATION_ID,
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

function sampleAttempt(): SocialExecutionAttemptRecord {
  return {
    attemptVersion: SOCIAL_EXECUTION_ATTEMPT_VERSION,
    attemptId: ATTEMPT_ID,
    attemptIdentity: buildExecutionAttemptIdentity({
      executionIntentId: "execution-intent-1",
      publicationTargetId: "target-1",
      authorizationId: AUTH_ID,
    }),
    authorizationId: AUTH_ID,
    sessionId: SESSION_ID,
    publicationTargetId: "target-1",
    executionIntentId: "execution-intent-1",
    correlationId: CORRELATION_ID,
    idempotencyKey: buildExecutionAttemptIdempotencyKey({
      executionIntentId: "execution-intent-1",
      publicationTargetId: "target-1",
      authorizationId: AUTH_ID,
    }),
    replayKey: buildExecutionAttemptReplayKey({ attemptId: ATTEMPT_ID, correlationId: CORRELATION_ID }),
    attemptFingerprint: buildExecutionAttemptFingerprint({
      executionIntentId: "execution-intent-1",
      publicationTargetId: "target-1",
      authorizationId: AUTH_ID,
      sessionId: SESSION_ID,
      correlationId: CORRELATION_ID,
    }),
    createdAt: "2026-07-05T12:00:00.000Z",
    expiresAt: "2026-07-06T12:00:00.000Z",
    appendOnly: true,
    immutable: true,
    metadataOnly: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    subordinateToAuthorization: true,
  };
}

function sampleLifecycleEvents(): SocialExecutionAttemptLifecycleEventRecord[] {
  return [
    {
      lifecycleVersion: SOCIAL_EXECUTION_ATTEMPT_LIFECYCLE_VERSION,
      lifecycleEventId: "exec-attempt-lifecycle:session-created",
      attemptId: ATTEMPT_ID,
      correlationId: CORRELATION_ID,
      lifecycleState: "created",
      createdAt: "2026-07-05T12:00:00.000Z",
      appendOnly: true,
      immutable: true,
      metadataOnly: true,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
    {
      lifecycleVersion: SOCIAL_EXECUTION_ATTEMPT_LIFECYCLE_VERSION,
      lifecycleEventId: "exec-attempt-lifecycle:session-prepared",
      attemptId: ATTEMPT_ID,
      correlationId: CORRELATION_ID,
      lifecycleState: "prepared",
      createdAt: "2026-07-05T12:01:00.000Z",
      appendOnly: true,
      immutable: true,
      metadataOnly: true,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
  ];
}

function sampleAlignedEvidence(): {
  evidenceRecords: SocialExecutionAttemptEvidenceRecord[];
  stateTransitions: SocialExecutionAttemptStateTransitionRecord[];
} {
  const evidenceOneId = buildExecutionAttemptEvidenceId("session-1");
  const evidenceTwoId = buildExecutionAttemptEvidenceId("session-2");
  const transitionOneId = buildExecutionAttemptStateTransitionId("session-1");
  const transitionTwoId = buildExecutionAttemptStateTransitionId("session-2");

  return {
    evidenceRecords: [
      {
        evidenceVersion: SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VERSION,
        evidenceId: evidenceOneId,
        attemptId: ATTEMPT_ID,
        correlationId: CORRELATION_ID,
        transitionId: transitionOneId,
        evidenceKind: "lifecycle_alignment_evidence",
        sanitizedSummary: "Attempt created evidence aligned.",
        evidencePayload: { lifecycleState: "created" },
        recordedAt: "2026-07-05T12:00:00.000Z",
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
      },
      {
        evidenceVersion: SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_VERSION,
        evidenceId: evidenceTwoId,
        attemptId: ATTEMPT_ID,
        correlationId: CORRELATION_ID,
        transitionId: transitionTwoId,
        evidenceKind: "lifecycle_alignment_evidence",
        sanitizedSummary: "Attempt prepared evidence aligned.",
        evidencePayload: { lifecycleState: "prepared" },
        recordedAt: "2026-07-05T12:01:00.000Z",
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
      },
    ],
    stateTransitions: [
      {
        transitionVersion: SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_VERSION,
        transitionId: transitionOneId,
        attemptId: ATTEMPT_ID,
        correlationId: CORRELATION_ID,
        fromState: "missing",
        toState: "created",
        transitionKind: "attempt_created",
        evidenceId: evidenceOneId,
        createdAt: "2026-07-05T12:00:00.000Z",
        appendOnly: true,
        immutable: true,
        metadataOnly: true,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
      {
        transitionVersion: SOCIAL_EXECUTION_ATTEMPT_STATE_TRANSITION_VERSION,
        transitionId: transitionTwoId,
        attemptId: ATTEMPT_ID,
        correlationId: CORRELATION_ID,
        fromState: "created",
        toState: "prepared",
        transitionKind: "attempt_prepared",
        evidenceId: evidenceTwoId,
        createdAt: "2026-07-05T12:01:00.000Z",
        appendOnly: true,
        immutable: true,
        metadataOnly: true,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
    ],
  };
}

function samplePublicationTarget(): PublicationTargetDefinition {
  return {
    targetId: "target-1",
    platform: "facebook",
    targetType: "facebook_page",
    displayName: "Jumping Jax Facebook",
    externalId: "fb-page-1",
    enabled: true,
    ownerManaged: true,
    capabilities: {
      capabilityKinds: ["image_post", "caption_text"],
      mediaConstraints: {
        supportedMediaTypes: ["image"],
        maxImageCount: 1,
        maxVideoCount: 0,
        maxVideoDurationSeconds: 0,
        supportedAspectRatios: ["1:1"],
      },
      copyConstraints: {
        maxCaptionCharacters: 2200,
        supportsHashtags: true,
        supportsLinks: false,
      },
      computedOnly: true,
      authoritative: false,
      grantsPublishingPermission: false,
      publishesNothing: true,
      schedulesNothing: true,
      recordsNoMetrics: true,
      performsNoLearning: true,
    },
    createdAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-07-01T12:00:00.000Z",
    metadata: {},
  };
}

function createRunnerStore(): SocialExecutionRunnerStoreStorage {
  const transcripts: Parameters<SocialExecutionRunnerStoreStorage["insertTranscript"]>[0][] = [];
  const auditEvents: SocialExecutionRunnerAuditEventRecord[] = [];

  return {
    async loadSnapshot() {
      return { transcripts, auditEvents };
    },
    async insertTranscript(record) {
      transcripts.push(record);
      return record;
    },
    async insertAuditEvent(record) {
      auditEvents.push(record);
      return record;
    },
  };
}

function createSessionStore(): SocialExecutionSessionStoreStorage {
  const sessions: Parameters<SocialExecutionSessionStoreStorage["insertSession"]>[0][] = [];
  const auditEvents: Parameters<SocialExecutionSessionStoreStorage["insertAuditEvent"]>[0][] = [];

  return {
    async loadSnapshot() {
      return { sessions, auditEvents };
    },
    async insertSession(record) {
      sessions.push(record);
      return record;
    },
    async insertAuditEvent(record) {
      auditEvents.push(record);
      return record;
    },
  };
}

function readyFixtures() {
  const aligned = sampleAlignedEvidence();
  return {
    attemptSnapshot: {
      attempts: [sampleAttempt()],
      lifecycleEvents: sampleLifecycleEvents(),
      auditEvents: [],
    },
    authorizationSnapshot: {
      authorizations: [sampleAuthorization()],
      cancellations: [],
      intents: [],
      sessions: [sampleSession()],
      auditEvents: [],
    },
    evidenceSnapshot: aligned,
    publicationTarget: samplePublicationTarget(),
  };
}

test("evaluateExecutionSessionPreflight passes when attempt ids are valid", () => {
  const fixtures = readyFixtures();
  const preflight = evaluateExecutionSessionPreflight({
    attemptIds: [ATTEMPT_ID],
    ...fixtures,
  });

  assert.equal(preflight.sessionOrchestrationReady, true);
  assert.equal(preflight.correlationId, CORRELATION_ID);
  assert.equal(preflight.preflightBlockingCodes.length, 0);
});

test("evaluateExecutionSessionPreflight blocks missing attempt ids", () => {
  const fixtures = readyFixtures();
  const preflight = evaluateExecutionSessionPreflight({
    attemptIds: [],
    ...fixtures,
  });

  assert.equal(preflight.sessionOrchestrationReady, false);
  assert.ok(preflight.preflightBlockingCodes.includes("attempt_ids_missing"));
});

test("deriveExecutionSessionSummaryStatus prioritizes validation_failed over blocked", () => {
  assert.equal(
    deriveExecutionSessionSummaryStatus(["simulated", "blocked", "validation_failed"]),
    "validation_failed",
  );
  assert.equal(deriveExecutionSessionSummaryStatus(["simulated", "blocked"]), "blocked");
  assert.equal(deriveExecutionSessionSummaryStatus(["simulated"]), "simulated");
  assert.equal(deriveExecutionSessionSummaryStatus([]), "blocked");
});

test("buildExecutionSessionTimeline sorts deterministically by recordedAt then transcriptId", () => {
  const timeline = buildExecutionSessionTimeline([
    {
      transcriptId: "exec-runner-transcript:b",
      attemptId: ATTEMPT_ID,
      outcomeStatus: "simulated",
      recordedAt: "2026-07-05T12:01:00.000Z",
      sanitizedSummary: "second",
    },
    {
      transcriptId: "exec-runner-transcript:a",
      attemptId: ATTEMPT_ID,
      outcomeStatus: "simulated",
      recordedAt: "2026-07-05T12:00:00.000Z",
      sanitizedSummary: "first",
    },
  ]);

  assert.equal(timeline[0]?.sequence, 1);
  assert.equal(timeline[0]?.transcriptId, "exec-runner-transcript:a");
  assert.equal(timeline[1]?.sequence, 2);
});

test("orchestrateDryRunExecutionSession groups runner transcripts under immutable session", async () => {
  resetSocialExecutionRunnerInMemoryStoreForTests();
  resetSocialExecutionSessionInMemoryStoreForTests();
  const runnerStore = createRunnerStore();
  const sessionStore = createSessionStore();
  configureSocialExecutionRunnerStoreTestDependencies(runnerStore);
  configureSocialExecutionSessionStoreTestDependencies(sessionStore);

  const fixtures = readyFixtures();
  const result = await orchestrateDryRunExecutionSession({
    attemptIds: [ATTEMPT_ID],
    ...fixtures,
    ownerApprovalVerification: { status: "verified", code: null },
    now: new Date("2026-07-05T12:30:00.000Z"),
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.session.summaryStatus, "simulated");
    assert.equal(result.session.simulatedOnly, true);
    assert.equal(result.session.grantsExecutionPermission, false);
    assert.equal(result.transcripts.length, 1);
    assert.equal(result.session.transcriptIds.length, 1);
  }

  const sessionSnapshot = await sessionStore.loadSnapshot();
  assert.equal(sessionSnapshot.sessions.length, 1);
  assert.equal(sessionSnapshot.auditEvents.length, 1);

  const runnerSnapshot = await runnerStore.loadSnapshot();
  assert.equal(runnerSnapshot.transcripts.length, 1);
});

test("replaySocialExecutionSession returns deterministic session timeline", async () => {
  resetSocialExecutionRunnerInMemoryStoreForTests();
  resetSocialExecutionSessionInMemoryStoreForTests();
  const runnerStore = createRunnerStore();
  const sessionStore = createSessionStore();
  configureSocialExecutionRunnerStoreTestDependencies(runnerStore);
  configureSocialExecutionSessionStoreTestDependencies(sessionStore);

  const fixtures = readyFixtures();
  const orchestration = await orchestrateDryRunExecutionSession({
    attemptIds: [ATTEMPT_ID],
    ...fixtures,
    ownerApprovalVerification: { status: "verified", code: null },
  });

  assert.equal(orchestration.ok, true);

  const replay = await replaySocialExecutionSession({
    attemptId: ATTEMPT_ID,
    sessionSnapshot: await sessionStore.loadSnapshot(),
    runnerSnapshot: await runnerStore.loadSnapshot(),
    preflightInput: {
      attemptIds: [ATTEMPT_ID],
      ...fixtures,
    },
  });

  assert.equal(replay.summary.sessionCount, 1);
  assert.equal(replay.summary.transcriptCount, 1);
  assert.equal(replay.timeline.length, 1);
  assert.equal(replay.preflight?.sessionOrchestrationReady, true);

  const diagnostics = buildExecutionSessionDiagnostics({ replay });
  assert.equal(diagnostics.summary.sessionCount, 1);
  assert.equal(diagnostics.summary.simulatedSessionCount, 1);
});

test("validateExecutionSessionRecord rejects forbidden execution permission", () => {
  const validation = validateExecutionSessionRecord({
    sessionVersion: "d16-w12-v1",
    sessionId: "exec-execution-session:test-1",
    correlationId: CORRELATION_ID,
    transcriptIds: ["exec-runner-transcript:test-1"],
    attemptIds: [ATTEMPT_ID],
    summaryStatus: "simulated",
    sanitizedSummary: "summary",
    createdAt: "2026-07-05T12:30:00.000Z",
    completedAt: "2026-07-05T12:30:00.000Z",
    appendOnly: true,
    immutable: true,
    metadataOnly: true,
    simulatedOnly: true,
    grantsExecutionPermission: true as false,
    executesNothing: true,
    publishesNothing: true,
    provesExecution: false,
    usesNoNetwork: true,
    usesNoOAuth: true,
    usesNoCredentials: true,
    callsNoExternalApis: true,
  });

  assert.equal(validation.ok, false);
  assert.ok(detectForbiddenExecutionSessionState({ grantsExecutionPermission: true }).forbidden);
});
