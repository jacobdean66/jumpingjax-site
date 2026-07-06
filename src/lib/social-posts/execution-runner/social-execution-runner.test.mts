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
import {
  SOCIAL_EXECUTION_RUNNER_SUPPORTED_PLATFORMS,
  detectForbiddenExecutionRunnerState,
  validateExecutionRunnerTranscriptRecord,
  type SocialExecutionRunnerAuditEventRecord,
  type SocialExecutionRunnerTranscriptRecord,
} from "./social-execution-runner-domain";
import { evaluateExecutionRunnerPreflight } from "./social-execution-runner-preflight";
import {
  configureSocialExecutionRunnerStoreTestDependencies,
  resetSocialExecutionRunnerInMemoryStoreForTests,
  type SocialExecutionRunnerStoreStorage,
} from "./social-execution-runner-store";
import { executeDryRunExecutionRunner } from "./social-execution-runner-service";
import { replaySocialExecutionRunner } from "./social-execution-runner-replay";
import { buildExecutionRunnerDiagnostics } from "./social-execution-runner-diagnostics";

const ATTEMPT_ID = "exec-attempt:runner-test-1";
const AUTH_ID = "exec-auth:runner-test-1";
const SESSION_ID = "exec-runtime-session:runner-test-1";
const CORRELATION_ID = "corr:runner-test-1";

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
      lifecycleEventId: "exec-attempt-lifecycle:runner-created",
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
      lifecycleEventId: "exec-attempt-lifecycle:runner-prepared",
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
  const evidenceOneId = buildExecutionAttemptEvidenceId("runner-1");
  const evidenceTwoId = buildExecutionAttemptEvidenceId("runner-2");
  const transitionOneId = buildExecutionAttemptStateTransitionId("runner-1");
  const transitionTwoId = buildExecutionAttemptStateTransitionId("runner-2");

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
  const transcripts: SocialExecutionRunnerTranscriptRecord[] = [];
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

test("evaluateExecutionRunnerPreflight passes when attempt is prepared and evidence aligned", () => {
  const fixtures = readyFixtures();
  const preflight = evaluateExecutionRunnerPreflight({
    attemptId: ATTEMPT_ID,
    ...fixtures,
    ownerApprovalVerification: { status: "verified", code: null },
    now: new Date("2026-07-05T12:30:00.000Z"),
  });

  assert.equal(preflight.runnerReady, true);
  assert.equal(preflight.platform, "facebook");
  assert.equal(preflight.adapterDryRunAvailable, true);
  assert.equal(preflight.preflightBlockingCodes.length, 0);
});

test("evaluateExecutionRunnerPreflight blocks missing attempt", () => {
  const fixtures = readyFixtures();
  const preflight = evaluateExecutionRunnerPreflight({
    attemptId: "exec-attempt:missing",
    ...fixtures,
    ownerApprovalVerification: { status: "verified", code: null },
  });

  assert.equal(preflight.runnerReady, false);
  assert.ok(preflight.preflightBlockingCodes.includes("attempt_missing"));
});

test("evaluateExecutionRunnerPreflight blocks out-of-scope platforms", () => {
  const fixtures = readyFixtures();
  const preflight = evaluateExecutionRunnerPreflight({
    attemptId: ATTEMPT_ID,
    ...fixtures,
    publicationTarget: {
      ...samplePublicationTarget(),
      platform: "tiktok",
      targetType: "facebook_page",
    } as unknown as PublicationTargetDefinition,
    ownerApprovalVerification: { status: "verified", code: null },
  });

  assert.equal(preflight.runnerReady, false);
  assert.ok(preflight.preflightBlockingCodes.includes("platform_out_of_scope"));
});

test("executeDryRunExecutionRunner simulates dry-run and appends transcript history", async () => {
  resetSocialExecutionRunnerInMemoryStoreForTests();
  const runnerStore = createRunnerStore();
  configureSocialExecutionRunnerStoreTestDependencies(runnerStore);

  const fixtures = readyFixtures();
  const result = await executeDryRunExecutionRunner({
    attemptId: ATTEMPT_ID,
    ...fixtures,
    ownerApprovalVerification: { status: "verified", code: null },
    now: new Date("2026-07-05T12:30:00.000Z"),
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.transcript.outcomeStatus, "simulated");
    assert.equal(result.transcript.provesExecution, false);
    assert.equal(result.transcript.simulation?.response.status, "simulated");
  }

  const snapshot = await runnerStore.loadSnapshot();
  assert.equal(snapshot.transcripts.length, 1);
  assert.equal(snapshot.auditEvents.length, 1);
});

test("replaySocialExecutionRunner returns deterministic read model", async () => {
  resetSocialExecutionRunnerInMemoryStoreForTests();
  const runnerStore = createRunnerStore();
  configureSocialExecutionRunnerStoreTestDependencies(runnerStore);
  const fixtures = readyFixtures();

  await executeDryRunExecutionRunner({
    attemptId: ATTEMPT_ID,
    ...fixtures,
    ownerApprovalVerification: { status: "verified", code: null },
  });

  const replay = await replaySocialExecutionRunner({
    attemptId: ATTEMPT_ID,
    ...fixtures,
    runnerSnapshot: await runnerStore.loadSnapshot(),
    ownerApprovalVerification: { status: "verified", code: null },
  });

  assert.equal(replay.summary.transcriptCount, 1);
  assert.equal(replay.summary.simulatedTranscriptCount, 1);
  assert.equal(replay.preflight?.runnerReady, true);

  const diagnostics = buildExecutionRunnerDiagnostics({ replay });
  assert.equal(diagnostics.summary.runnerReady, true);
});

test("validateExecutionRunnerTranscriptRecord rejects forbidden execution permission", () => {
  const fixtures = readyFixtures();
  const validation = validateExecutionRunnerTranscriptRecord({
    runnerVersion: "d16-w11-v1",
    transcriptId: "exec-runner-transcript:test-1",
    attemptId: ATTEMPT_ID,
    authorizationId: AUTH_ID,
    executionIntentId: "execution-intent-1",
    publicationTargetId: "target-1",
    correlationId: CORRELATION_ID,
    platform: "facebook",
    outcomeStatus: "simulated",
    sanitizedSummary: "summary",
    simulation: null,
    blockingCodes: [],
    recordedAt: "2026-07-05T12:30:00.000Z",
    appendOnly: true,
    immutable: true,
    metadataOnly: true,
    simulatedOnly: true,
    grantsExecutionPermission: true as false,
    executesNothing: true,
    publishesNothing: true,
    provesExecution: false,
    persistsNothing: false,
    usesNoNetwork: true,
    usesNoOAuth: true,
    usesNoCredentials: true,
    callsNoExternalApis: true,
  });

  assert.equal(validation.ok, false);
  assert.ok(detectForbiddenExecutionRunnerState({ grantsExecutionPermission: true }).forbidden);
});

test("supported platforms remain facebook and instagram only", () => {
  assert.deepEqual(SOCIAL_EXECUTION_RUNNER_SUPPORTED_PLATFORMS, ["facebook", "instagram"]);
});
