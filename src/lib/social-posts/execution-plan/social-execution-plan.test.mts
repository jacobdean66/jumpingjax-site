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
  detectForbiddenExecutionPlanState,
  validateExecutionPlanRecord,
} from "./social-execution-plan-domain";
import { evaluateExecutionPlanPreflight } from "./social-execution-plan-preflight";
import { buildExecutionPlanDiagnostics } from "./social-execution-plan-diagnostics";
import { replaySocialExecutionPlan } from "./social-execution-plan-replay";
import { buildDryRunExecutionPlan } from "./social-execution-plan-service";
import {
  configureSocialExecutionPlanStoreTestDependencies,
  resetSocialExecutionPlanInMemoryStoreForTests,
  type SocialExecutionPlanStoreStorage,
} from "./social-execution-plan-store";

const ATTEMPT_ID = "exec-attempt:plan-test-1";
const AUTH_ID = "exec-auth:plan-test-1";
const SESSION_ID = "exec-execution-session:plan-test-1";
const CORRELATION_ID = "corr:plan-test-1";

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
      lifecycleEventId: "exec-attempt-lifecycle:plan-created",
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
      lifecycleEventId: "exec-attempt-lifecycle:plan-prepared",
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
  const evidenceOneId = buildExecutionAttemptEvidenceId("plan-1");
  const evidenceTwoId = buildExecutionAttemptEvidenceId("plan-2");
  const transitionOneId = buildExecutionAttemptStateTransitionId("plan-1");
  const transitionTwoId = buildExecutionAttemptStateTransitionId("plan-2");

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

function createPlanStore(): SocialExecutionPlanStoreStorage {
  let snapshot = {
    plans: [] as Awaited<ReturnType<SocialExecutionPlanStoreStorage["loadSnapshot"]>>["plans"],
    auditEvents: [] as Awaited<
      ReturnType<SocialExecutionPlanStoreStorage["loadSnapshot"]>
    >["auditEvents"],
  };

  return {
    async loadSnapshot() {
      return snapshot;
    },
    async insertPlan(record) {
      snapshot = {
        plans: [...snapshot.plans, record],
        auditEvents: snapshot.auditEvents,
      };
      return record;
    },
    async insertAuditEvent(record) {
      snapshot = {
        plans: snapshot.plans,
        auditEvents: [...snapshot.auditEvents, record],
      };
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

test("evaluateExecutionPlanPreflight passes when session and runner preflights are ready", () => {
  const fixtures = readyFixtures();
  const preflight = evaluateExecutionPlanPreflight({
    sessionId: SESSION_ID,
    authorizationId: AUTH_ID,
    attemptIds: [ATTEMPT_ID],
    ...fixtures,
    ownerApprovalVerification: { status: "verified", code: null },
    now: new Date("2026-07-05T12:30:00.000Z"),
  });

  assert.equal(preflight.planReady, true);
  assert.equal(preflight.platform, "facebook");
  assert.equal(preflight.adapterId, "execution-adapter-facebook-dry-run");
  assert.equal(preflight.preflightBlockingCodes.length, 0);
});

test("evaluateExecutionPlanPreflight blocks missing session id", () => {
  const fixtures = readyFixtures();
  const preflight = evaluateExecutionPlanPreflight({
    sessionId: null,
    authorizationId: AUTH_ID,
    attemptIds: [ATTEMPT_ID],
    ...fixtures,
    ownerApprovalVerification: { status: "verified", code: null },
  });

  assert.equal(preflight.planReady, false);
  assert.ok(preflight.preflightBlockingCodes.includes("session_id_required"));
});

test("buildDryRunExecutionPlan models deterministic plan without runner execution", async () => {
  resetSocialExecutionPlanInMemoryStoreForTests();
  const planStore = createPlanStore();
  configureSocialExecutionPlanStoreTestDependencies(planStore);

  const fixtures = readyFixtures();
  const result = await buildDryRunExecutionPlan({
    sessionId: SESSION_ID,
    authorizationId: AUTH_ID,
    attemptIds: [ATTEMPT_ID],
    ...fixtures,
    ownerApprovalVerification: { status: "verified", code: null },
    now: new Date("2026-07-05T12:30:00.000Z"),
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.plan.summaryStatus, "planned");
    assert.equal(result.plan.simulatedOnly, true);
    assert.equal(result.plan.grantsExecutionPermission, false);
    assert.equal(result.plan.executionOrder.length, 2);
    assert.equal(result.plan.expectedDryRunOperations.length, 2);
    assert.equal(result.plan.adapter.adapterId, "execution-adapter-facebook-dry-run");
  }

  const snapshot = await planStore.loadSnapshot();
  assert.equal(snapshot.plans.length, 1);
  assert.equal(snapshot.auditEvents.length, 1);
});

test("replaySocialExecutionPlan returns deterministic read model", async () => {
  resetSocialExecutionPlanInMemoryStoreForTests();
  const planStore = createPlanStore();
  configureSocialExecutionPlanStoreTestDependencies(planStore);
  const fixtures = readyFixtures();

  await buildDryRunExecutionPlan({
    sessionId: SESSION_ID,
    authorizationId: AUTH_ID,
    attemptIds: [ATTEMPT_ID],
    ...fixtures,
    ownerApprovalVerification: { status: "verified", code: null },
  });

  const replay = await replaySocialExecutionPlan({
    sessionId: SESSION_ID,
    authorizationId: AUTH_ID,
    attemptIds: [ATTEMPT_ID],
    ...fixtures,
    planSnapshot: await planStore.loadSnapshot(),
    ownerApprovalVerification: { status: "verified", code: null },
    now: new Date("2026-07-05T12:30:00.000Z"),
  });

  assert.equal(replay.summary.planCount, 1);
  assert.equal(replay.summary.plannedCount, 1);
  assert.equal(replay.preflight?.planReady, true);
  assert.equal(replay.executionOrder.length, 2);

  const diagnostics = buildExecutionPlanDiagnostics({ replay });
  assert.equal(diagnostics.summary.planReady, true);
});

test("validateExecutionPlanRecord rejects forbidden execution permission", () => {
  const validation = validateExecutionPlanRecord({
    planVersion: "d16-w15-v1",
    executionPlanId: "exec-execution-plan:test-1",
    correlationId: CORRELATION_ID,
    authorizationId: AUTH_ID,
    sessionId: SESSION_ID,
    attemptIds: [ATTEMPT_ID],
    publicationTargetIds: ["target-1"],
    platform: "facebook",
    adapter: {
      adapterId: "execution-adapter-facebook-dry-run",
      adapterKind: "reference",
      displayName: "facebook dry-run reference adapter",
      dryRunAvailable: true,
      identityOnly: true,
      metadataOnly: true,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
    executionOrder: [
      {
        sequence: 1,
        attemptId: ATTEMPT_ID,
        publicationTargetId: "target-1",
        platform: "facebook",
        adapterId: "execution-adapter-facebook-dry-run",
        operationKind: "dry_run_adapter_preflight",
        sanitizedSummary: "summary",
        metadataOnly: true,
        simulatedOnly: true,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
    ],
    expectedDryRunOperations: [
      {
        sequence: 1,
        attemptId: ATTEMPT_ID,
        adapterId: "execution-adapter-facebook-dry-run",
        operationKind: "dry_run_adapter_preflight",
        sanitizedSummary: "summary",
        metadataOnly: true,
        simulatedOnly: true,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
    ],
    validationSummary: {
      planReady: true,
      sessionPreflightReady: true,
      runnerPreflightReadyCount: 1,
      runnerPreflightBlockedCount: 0,
      blockingCodes: [],
      blockingReasons: [],
      computedOnly: true,
      readOnly: true,
      authoritative: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
    summaryStatus: "planned",
    sanitizedSummary: "summary",
    plannedAt: "2026-07-05T12:30:00.000Z",
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
  assert.ok(detectForbiddenExecutionPlanState({ grantsExecutionPermission: true }).forbidden);
});
