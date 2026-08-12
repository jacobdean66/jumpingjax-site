import assert from "node:assert/strict";
import test from "node:test";

import type { SocialExecutionAuthorizationRecord } from "../execution-authorization/social-execution-authorization-domain";
import type { SocialPost } from "../social-post-data";
import {
  resetMetaOrganicPublishLedgerMemoryForTests,
} from "./social-meta-page-publish-ledger";
import {
  configureMetaOrganicPublishTestDependencies,
  createTestMetaOrganicPublishLedger,
  publishOrganicMetaPagePost,
} from "./social-meta-page-publish-service";

const POST_ID = "50000000-0000-4000-8000-000000000001";
const TARGET_ID = "60000000-0000-4000-8000-000000000001";

const BASE_AUTH: SocialExecutionAuthorizationRecord = {
  authorizationVersion: "d16-w5-v1",
  authorizationId: "exec-auth:test-1",
  authorizationIdentity: "identity:test-1",
  scope: {
    scopeKind: "publication_target_execution",
    executionIntentId: "exec-intent:1",
    publicationTargetId: TARGET_ID,
    ownerApprovalId: "owner-approval:1",
    approvalId: null,
    socialPostId: POST_ID,
  },
  authorizationState: "authorized",
  correlationId: "corr-1",
  authorizedAt: "2026-08-01T00:00:00.000Z",
  expiresAt: "2099-01-01T00:00:00.000Z",
  ownerApprovalId: "owner-approval:1",
  publicationTargetId: TARGET_ID,
  executionIntentId: "exec-intent:1",
  adminActorId: "owner",
  createdAt: "2026-08-01T00:00:00.000Z",
  appendOnly: true,
  immutable: true,
  containsSecrets: false,
  grantsExecutionPermission: false,
  executesNothing: true,
  publishesNothing: true,
  authorizesFutureExecutionOnly: true,
};

const BASE_POST: SocialPost = {
  id: POST_ID,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  title: "Jumping Jax Weekend",
  campaign_id: null,
  goal: null,
  prompt: "Family fun",
  caption: "Hello Jumping Jax",
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

function configuredDeps(overrides: Record<string, unknown> = {}) {
  resetMetaOrganicPublishLedgerMemoryForTests();
  let metaCalled = 0;
  let tokenLoads = 0;
  const ledger = createTestMetaOrganicPublishLedger();

  const deps = {
    isConfigured: () => true,
    loadAuthorizationSnapshot: async () => ({
      authorizations: [BASE_AUTH],
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
    loadSocialPost: async () => BASE_POST,
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
    ledger,
    loadPageAccessToken: async () => {
      tokenLoads += 1;
      return {
        ok: true as const,
        accessToken: "page-token-secret",
        credentialRefId: "cred-ref:page",
        pageId: "page-1",
      };
    },
    publishFeedPost: async () => {
      metaCalled += 1;
      return {
        ok: true as const,
        externalPostId: "page-1_999",
        status: "published" as const,
      };
    },
    now: () => new Date("2026-08-08T12:00:00.000Z"),
    ...overrides,
  };

  configureMetaOrganicPublishTestDependencies(deps as never);
  return {
    getMetaCalls: () => metaCalled,
    getTokenLoads: () => tokenLoads,
    ledger,
  };
}

test("local draft Approve alone cannot publish", async () => {
  const { getMetaCalls } = configuredDeps();
  const result = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: null,
    draftStatus: "approved",
    adminActorId: "owner",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "execution_authorization_required");
  assert.equal(getMetaCalls(), 0);
});

test("missing execution authorization cannot publish", async () => {
  const { getMetaCalls } = configuredDeps({
    loadAuthorizationSnapshot: async () => ({
      authorizations: [],
      cancellations: [],
      intents: [],
      sessions: [],
      auditEvents: [],
    }),
  });
  const result = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: "exec-auth:missing",
    adminActorId: "owner",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "authorization_not_found");
  assert.equal(getMetaCalls(), 0);
});

test("stale/expired authorization cannot publish", async () => {
  const expired = { ...BASE_AUTH, expiresAt: "2020-01-01T00:00:00.000Z" };
  const { getMetaCalls } = configuredDeps({
    loadAuthorizationSnapshot: async () => ({
      authorizations: [expired],
      cancellations: [],
      intents: [],
      sessions: [],
      auditEvents: [],
    }),
  });
  const result = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "authorization_expired");
  assert.equal(getMetaCalls(), 0);
});

test("authorization must match post/target scope", async () => {
  const { getMetaCalls } = configuredDeps();
  const result = await publishOrganicMetaPagePost({
    socialPostId: "50000000-0000-4000-8000-000000000099",
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "authorization_scope_mismatch");
  assert.equal(getMetaCalls(), 0);
});

test("missing owner approval verification cannot publish", async () => {
  const { getMetaCalls } = configuredDeps({
    verifyOwnerApproval: async () => ({
      ok: false as const,
      code: "owner_approval_not_approved",
      message: "not approved",
    }),
  });
  const result = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "owner_approval_not_approved");
  assert.equal(getMetaCalls(), 0);
});

test("not configured fails closed without Meta call", async () => {
  const { getMetaCalls } = configuredDeps({ isConfigured: () => false });
  const result = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "oauth_not_configured");
  assert.equal(getMetaCalls(), 0);
});

test("unbound Page is denied with zero Meta adapter calls", async () => {
  const { getMetaCalls, getTokenLoads } = configuredDeps({
    resolveBoundPage: async () => ({
      ok: false as const,
      code: "meta_page_unbound",
      message: "No active Meta publication-target binding exists.",
    }),
  });
  const result = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "meta_page_unbound");
  assert.equal(getMetaCalls(), 0);
  assert.equal(getTokenLoads(), 0);
});

test("mismatched Page is denied with zero Meta adapter calls", async () => {
  const { getMetaCalls, getTokenLoads } = configuredDeps({
    resolveBoundPage: async () => ({
      ok: true as const,
      pageId: "page-BOUND",
      bindingId: "binding-1",
      assetKind: "facebook_page" as const,
    }),
  });
  const result = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-OTHER",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "meta_page_binding_mismatch");
  assert.equal(getMetaCalls(), 0);
  assert.equal(getTokenLoads(), 0);
});

test("deterministic compliance block => zero Meta calls", async () => {
  const { getMetaCalls, getTokenLoads } = configuredDeps({
    evaluateCompliance: () => ({
      deterministic: true as const,
      modelApproved: false as const,
      resultState: "violations-found" as const,
      decision: "block" as const,
      allowedToProceed: false,
      summary: "blocked",
      blockingCodes: ["price-claim"],
      hardClaimFindings: [],
      evaluationId: "eval-block",
      specificationId: null,
    }),
  });
  const result = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "compliance_blocked");
  assert.equal(getMetaCalls(), 0);
  assert.equal(getTokenLoads(), 0);
});

test("quarantine/non-allow => zero Meta calls", async () => {
  const { getMetaCalls } = configuredDeps({
    evaluateCompliance: () => ({
      deterministic: true as const,
      modelApproved: false as const,
      resultState: "insufficient-spec" as const,
      decision: "quarantine" as const,
      allowedToProceed: false,
      summary: "quarantine",
      blockingCodes: [],
      hardClaimFindings: [],
      evaluationId: null,
      specificationId: null,
    }),
  });
  const result = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "compliance_not_allowed");
  assert.equal(getMetaCalls(), 0);
});

test("stale changed content => publish denied", async () => {
  const { getMetaCalls } = configuredDeps();
  const result = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    message: "Different text than DB caption",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "content_changed_after_authorization");
  assert.equal(getMetaCalls(), 0);
});

test("durable-store failure => zero Meta calls", async () => {
  const { getMetaCalls, getTokenLoads } = configuredDeps({
    ledger: {
      isAvailable: async () => false,
      claim: async () => {
        throw new Error("should not claim");
      },
      markMetaInvoked: async () => {
        throw new Error("should not mark");
      },
      complete: async () => ({ ok: true as const }),
      fail: async () => ({ ok: true as const }),
    },
  });
  const result = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "durable_publish_ledger_unavailable");
  assert.equal(getMetaCalls(), 0);
  assert.equal(getTokenLoads(), 0);
});

test("duplicate request => one Meta mutation via durable ledger", async () => {
  const { getMetaCalls } = configuredDeps();
  const first = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.replay, false);
    assert.equal(first.result.externalPostId, "page-1_999");
    assert.ok(!("accessToken" in first.result));
  }

  const second = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(second.ok, true);
  if (second.ok) {
    assert.equal(second.replay, true);
    assert.equal(second.result.externalPostId, "page-1_999");
  }
  assert.equal(getMetaCalls(), 1);
});

test("cross-instance duplicate uses shared durable ledger memory", async () => {
  const sharedLedger = createTestMetaOrganicPublishLedger();
  const a = configuredDeps({ ledger: sharedLedger });
  const first = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: "exec-auth:shared-1",
    adminActorId: "owner",
  });
  assert.equal(first.ok, false); // auth id not in snapshot
  void a;

  // Reconfigure with matching auth id and shared ledger.
  const auth = {
    ...BASE_AUTH,
    authorizationId: "exec-auth:shared-1",
    authorizationIdentity: "identity:shared-1",
  };
  let metaCalled = 0;
  configureMetaOrganicPublishTestDependencies({
    isConfigured: () => true,
    loadAuthorizationSnapshot: async () => ({
      authorizations: [auth],
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
    loadSocialPost: async () => BASE_POST,
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
    ledger: sharedLedger,
    loadPageAccessToken: async () => ({
      ok: true as const,
      accessToken: "page-token-secret",
      credentialRefId: "cred-ref:page",
      pageId: "page-1",
    }),
    publishFeedPost: async () => {
      metaCalled += 1;
      return {
        ok: true as const,
        externalPostId: "page-1_shared",
        status: "published" as const,
      };
    },
    now: () => new Date("2026-08-08T12:00:00.000Z"),
  });

  const one = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: "exec-auth:shared-1",
    adminActorId: "owner-a",
  });
  const two = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: "exec-auth:shared-1",
    adminActorId: "owner-b",
  });
  assert.equal(one.ok, true);
  assert.equal(two.ok, true);
  if (two.ok) assert.equal(two.replay, true);
  assert.equal(metaCalled, 1);
});

test("bound Page publishes through the mocked adapter", async () => {
  const { getMetaCalls } = configuredDeps();
  const first = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.result.status, "published");
    assert.ok(!JSON.stringify(first.result).includes("page-token-secret"));
  }
  assert.equal(getMetaCalls(), 1);
});

test("Meta success + durable completion failure => uncertain, no second Meta mutation", async () => {
  const base = createTestMetaOrganicPublishLedger();
  const ledger = {
    isAvailable: () => base.isAvailable(),
    claim: (input: Parameters<typeof base.claim>[0]) => base.claim(input),
    markMetaInvoked: (input: Parameters<typeof base.markMetaInvoked>[0]) =>
      base.markMetaInvoked(input),
    complete: async () => ({
      ok: false as const,
      code: "durable_publish_ledger_unavailable",
      message: "simulated completion failure",
    }),
    fail: (input: Parameters<typeof base.fail>[0]) => base.fail(input),
  };
  const { getMetaCalls } = configuredDeps({ ledger });

  const first = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(first.ok, false);
  if (!first.ok) {
    assert.equal(first.code, "publish_completion_uncertain");
    assert.equal(first.phase, "uncertain_completion");
    assert.equal(first.needsManualReview, true);
    assert.equal(first.externalPostId, "page-1_999");
  }
  assert.equal(getMetaCalls(), 1);

  const second = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(getMetaCalls(), 1);
  assert.equal(second.ok, false);
  if (!second.ok) {
    assert.equal(second.code, "publish_completion_uncertain");
    assert.equal(second.needsManualReview, true);
  }
});

test("concurrent duplicate requests => at most one Meta call", async () => {
  const { getMetaCalls } = configuredDeps();
  const [a, b] = await Promise.all([
    publishOrganicMetaPagePost({
      socialPostId: POST_ID,
      publicationTargetId: TARGET_ID,
      pageId: "page-1",
      authorizationId: "exec-auth:test-1",
      adminActorId: "owner-a",
    }),
    publishOrganicMetaPagePost({
      socialPostId: POST_ID,
      publicationTargetId: TARGET_ID,
      pageId: "page-1",
      authorizationId: "exec-auth:test-1",
      adminActorId: "owner-b",
    }),
  ]);
  assert.equal(getMetaCalls(), 1);
  const oks = [a, b].filter((r) => r.ok);
  assert.ok(oks.length >= 1);
  const blocked = [a, b].filter(
    (r) =>
      !r.ok &&
      (r.code === "publish_in_progress" ||
        r.code === "authorization_consumed" ||
        r.code === "publish_completion_uncertain"),
  );
  assert.equal(oks.length + blocked.length + [a, b].filter((r) => r.ok && r.replay).length >= 1, true);
  // Exactly one Meta mutation; second is replay or in_progress/consumed.
  const metaSafe = [a, b].every(
    (r) =>
      r.ok ||
      r.code === "publish_in_progress" ||
      r.code === "authorization_consumed" ||
      r.code === "publish_completion_uncertain",
  );
  assert.equal(metaSafe, true);
});

test("in-progress attempt blocks second Meta mutation", async () => {
  resetMetaOrganicPublishLedgerMemoryForTests();
  const ledger = createTestMetaOrganicPublishLedger();
  const fp =
    "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
  const claim = await ledger.claim({
    authorizationId: "exec-auth:test-1",
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    fingerprint: fp,
    ownerApprovalId: "owner-approval:1",
    adminActorId: "owner",
  });
  assert.equal(claim.ok && claim.kind === "proceed", true);

  const secondClaim = await ledger.claim({
    authorizationId: "exec-auth:test-1",
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    fingerprint: fp,
    ownerApprovalId: "owner-approval:1",
    adminActorId: "owner",
  });
  assert.equal(secondClaim.ok && secondClaim.kind === "in_progress", true);
});

test("Meta HTTP failure after mark_meta_invoked => uncertain; no second Meta call", async () => {
  let metaCalled = 0;
  configuredDeps({
    publishFeedPost: async () => {
      metaCalled += 1;
      return {
        ok: false as const,
        errorCode: "meta_publish_failed",
        message: "graph denied",
      };
    },
  });
  const result = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "publish_completion_uncertain");
    assert.equal(result.needsManualReview, true);
    assert.equal(result.externalPostId == null, true);
  }
  assert.equal(metaCalled, 1);

  const replay = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(replay.ok, false);
  if (!replay.ok) {
    assert.equal(replay.code, "publish_completion_uncertain");
    assert.equal(replay.needsManualReview, true);
  }
  assert.equal(metaCalled, 1);
});

test("token load failure before mark_meta_invoked consumes auth with zero Meta calls", async () => {
  const { getMetaCalls } = configuredDeps({
    loadPageAccessToken: async () => ({
      ok: false as const,
      code: "page_token_missing",
      message: "missing token",
    }),
  });
  const result = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "page_token_missing");
  assert.equal(getMetaCalls(), 0);

  const second = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.code, "authorization_consumed");
  assert.equal(getMetaCalls(), 0);
});

test("Meta success stores durable sanitized externalPublicationId", async () => {
  const { getMetaCalls } = configuredDeps();
  const result = await publishOrganicMetaPagePost({
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(result.ok, true);
  assert.equal(getMetaCalls(), 1);
  const status = (
    await import("./social-meta-page-publish-ledger")
  ).resolveMetaOrganicPublishDurableStatusFromMemory("exec-auth:test-1");
  assert.equal(status.kind, "recorded");
  if (status.kind === "recorded") {
    assert.equal(status.result.externalPostId, "page-1_999");
  }
});

configureMetaOrganicPublishTestDependencies(null);
resetMetaOrganicPublishLedgerMemoryForTests();
console.log("social-meta-page-publish-service tests passed");
