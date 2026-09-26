import assert from "node:assert/strict";
import test from "node:test";

import type { SocialExecutionAuthorizationRecord } from "../execution-authorization/social-execution-authorization-domain";
import type { SocialPost } from "../social-post-data";
import {
  configureMetaScheduledPublicationTestDependencies,
  runDueMetaOrganicPublications,
  scheduleMetaOrganicPublication,
  type MetaScheduledPublication,
} from "./social-meta-scheduled-publication-service";

const POST_ID = "50000000-0000-4000-8000-000000000001";
const TARGET_ID = "60000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-09-25T12:00:00.000Z");

const AUTHORIZATION: SocialExecutionAuthorizationRecord = {
  authorizationVersion: "d16-w5-v1",
  authorizationId: "exec-auth:schedule-1",
  authorizationIdentity: "identity:schedule-1",
  scope: {
    scopeKind: "publication_target_execution",
    executionIntentId: "exec-intent:schedule-1",
    publicationTargetId: TARGET_ID,
    ownerApprovalId: "owner-approval:schedule-1",
    approvalId: null,
    socialPostId: POST_ID,
  },
  authorizationState: "authorized",
  correlationId: "corr:schedule-1",
  authorizedAt: NOW.toISOString(),
  expiresAt: "2026-10-03T12:00:00.000Z",
  ownerApprovalId: "owner-approval:schedule-1",
  publicationTargetId: TARGET_ID,
  executionIntentId: "exec-intent:schedule-1",
  adminActorId: "owner",
  createdAt: NOW.toISOString(),
  appendOnly: true,
  immutable: true,
  containsSecrets: false,
  grantsExecutionPermission: false,
  executesNothing: true,
  publishesNothing: true,
  authorizesFutureExecutionOnly: true,
};

const POST: SocialPost = {
  id: POST_ID,
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
  title: "Jumping Jax Weekend",
  campaign_id: null,
  goal: null,
  prompt: "Family fun",
  caption: "Come jump with us this weekend.",
  media_type: "image",
  business_focus: "both",
  media_url: null,
  source_image_url: null,
  original_image_url: null,
  approved_image_url: null,
  generated_image_url: null,
  generated_image_source_url: null,
  media_source_url: null,
  image_generation_provider: null,
  image_generation_model: null,
  image_prediction_id: null,
  image_generation_created_at: null,
  image_generation_prompt: null,
  image_generation_status: null,
  image_concepts: [],
  motion_preset: null,
  camera_preset: null,
  creative_source: null,
  platforms: ["facebook"],
  post_placement: "feed",
  format_variant_id: null,
  status: "approved",
  scheduled_for: null,
  posted_at: null,
  error_message: null,
};

function scheduleRecord(
  input: Partial<MetaScheduledPublication> = {},
): MetaScheduledPublication {
  return {
    scheduleId: "20000000-0000-4000-8000-000000000001",
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: AUTHORIZATION.authorizationId,
    scheduledFor: "2026-10-01T12:00:00.000Z",
    state: "pending",
    attemptCount: 0,
    externalPostId: null,
    resultCode: null,
    resultMessage: null,
    createdByActor: "owner",
    ...input,
  };
}

function configure(input: {
  authorization?: SocialExecutionAuthorizationRecord;
  jobs?: MetaScheduledPublication[];
  publishResult?: Record<string, unknown>;
} = {}) {
  const created: MetaScheduledPublication[] = [];
  const completed: Record<string, unknown>[] = [];
  let publishCalls = 0;
  const jobs = input.jobs ?? [];

  configureMetaScheduledPublicationTestDependencies({
    loadAuthorizationSnapshot: async () => ({
      authorizations: [input.authorization ?? AUTHORIZATION],
      cancellations: [],
      intents: [],
      sessions: [],
      auditEvents: [],
    }),
    verifyOwnerApproval: async () => ({ ok: true as const }),
    resolveBoundPage: async () => ({
      ok: true as const,
      pageId: "page-1",
      bindingId: "binding-1",
      assetKind: "facebook_page" as const,
    }),
    loadSocialPost: async () => POST,
    evaluateCompliance: () => ({
      deterministic: true as const,
      modelApproved: false as const,
      resultState: "compliant" as const,
      decision: "allow" as const,
      allowedToProceed: true,
      summary: "allow",
      blockingCodes: [],
      hardClaimFindings: [],
      evaluationId: "eval-1",
      specificationId: null,
    }),
    publish: async () => {
      publishCalls += 1;
      return (input.publishResult ?? {
        ok: true,
        replay: false,
        postStatusSynced: true,
        warning: null,
        result: {
          externalPostId: "page-1_123",
          status: "published",
          socialPostId: POST_ID,
          publicationTargetId: TARGET_ID,
          pageId: "page-1",
          authorizationId: AUTHORIZATION.authorizationId,
          fingerprint: "fingerprint",
        },
      }) as never;
    },
    store: {
      async create(values) {
        const record = scheduleRecord({
          socialPostId: values.socialPostId,
          publicationTargetId: values.publicationTargetId,
          pageId: values.pageId,
          authorizationId: values.authorizationId,
          scheduledFor: values.scheduledFor,
          createdByActor: values.createdByActor,
        });
        created.push(record);
        return record;
      },
      async claimDue() {
        return jobs;
      },
      async complete(values) {
        completed.push(values);
      },
    },
    now: () => NOW,
  });

  return { created, completed, getPublishCalls: () => publishCalls };
}

test("owner-authorized future schedule is stored with exact scope", async () => {
  const state = configure();
  const result = await scheduleMetaOrganicPublication({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: AUTHORIZATION.authorizationId,
    scheduledFor: "2026-10-01T12:00:00.000Z",
    adminActorId: "owner",
  });

  assert.equal(result.ok, true);
  assert.equal(state.created.length, 1);
  assert.equal(state.created[0]?.authorizationId, AUTHORIZATION.authorizationId);
});

test("schedule fails when authorization expires before the due time", async () => {
  const state = configure({
    authorization: { ...AUTHORIZATION, expiresAt: "2026-09-26T12:00:00.000Z" },
  });
  const result = await scheduleMetaOrganicPublication({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: AUTHORIZATION.authorizationId,
    scheduledFor: "2026-10-01T12:00:00.000Z",
    adminActorId: "owner",
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "authorization_expires_before_schedule");
  assert.equal(state.created.length, 0);
});

test("due worker publishes through the protected service and records success", async () => {
  const state = configure({ jobs: [scheduleRecord({ state: "processing" })] });
  const result = await runDueMetaOrganicPublications();

  assert.equal(result.claimed, 1);
  assert.equal(result.published, 1);
  assert.equal(state.getPublishCalls(), 1);
  assert.equal(state.completed[0]?.state, "published");
  assert.equal(state.completed[0]?.externalPostId, "page-1_123");
});

test("uncertain Meta completion stops the schedule for manual review", async () => {
  const state = configure({
    jobs: [scheduleRecord({ state: "processing" })],
    publishResult: {
      ok: false,
      code: "publish_completion_uncertain",
      message: "Manual review required.",
      phase: "uncertain_completion",
      needsManualReview: true,
      externalPostId: null,
    },
  });
  const result = await runDueMetaOrganicPublications();

  assert.equal(result.recoveryRequired, 1);
  assert.equal(state.getPublishCalls(), 1);
  assert.equal(state.completed[0]?.state, "recovery_required");
});

configureMetaScheduledPublicationTestDependencies(null);
