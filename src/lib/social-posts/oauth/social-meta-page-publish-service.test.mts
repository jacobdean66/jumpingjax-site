import assert from "node:assert/strict";
import test from "node:test";

import type { SocialExecutionAuthorizationRecord } from "../execution-authorization/social-execution-authorization-domain";
import {
  configureMetaOrganicPublishTestDependencies,
  publishOrganicMetaPagePost,
} from "./social-meta-page-publish-service";

const BASE_AUTH: SocialExecutionAuthorizationRecord = {
  authorizationVersion: "d16-w5-v1",
  authorizationId: "exec-auth:test-1",
  authorizationIdentity: "identity:test-1",
  scope: {
    scopeKind: "publication_target_execution",
    executionIntentId: "exec-intent:1",
    publicationTargetId: "target-1",
    ownerApprovalId: "owner-approval:1",
    approvalId: null,
    socialPostId: "post-1",
  },
  authorizationState: "authorized",
  correlationId: "corr-1",
  authorizedAt: "2026-08-01T00:00:00.000Z",
  expiresAt: "2099-01-01T00:00:00.000Z",
  ownerApprovalId: "owner-approval:1",
  publicationTargetId: "target-1",
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

function configuredDeps(overrides: Record<string, unknown> = {}) {
  const completedPublishes = new Map();
  const consumedAuthorizationIds = new Set<string>();
  let metaCalled = 0;
  let tokenLoads = 0;

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
    completedPublishes,
    consumedAuthorizationIds,
    ...overrides,
  };

  configureMetaOrganicPublishTestDependencies(deps as never);
  return {
    getMetaCalls: () => metaCalled,
    getTokenLoads: () => tokenLoads,
    completedPublishes,
    consumedAuthorizationIds,
  };
}

test("local draft Approve alone cannot publish", async () => {
  const { getMetaCalls } = configuredDeps();
  const result = await publishOrganicMetaPagePost({
    socialPostId: "post-1",
    publicationTargetId: "target-1",
    pageId: "page-1",
    message: "Hello",
    authorizationId: null,
    draftStatus: "approved",
    adminActorId: "owner",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "execution_authorization_required");
  }
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
    socialPostId: "post-1",
    publicationTargetId: "target-1",
    pageId: "page-1",
    message: "Hello",
    authorizationId: "exec-auth:missing",
    adminActorId: "owner",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "authorization_not_found");
  assert.equal(getMetaCalls(), 0);
});

test("stale/expired authorization cannot publish", async () => {
  const expired = {
    ...BASE_AUTH,
    expiresAt: "2020-01-01T00:00:00.000Z",
  };
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
    socialPostId: "post-1",
    publicationTargetId: "target-1",
    pageId: "page-1",
    message: "Hello",
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
    socialPostId: "post-OTHER",
    publicationTargetId: "target-1",
    pageId: "page-1",
    message: "Hello",
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
    socialPostId: "post-1",
    publicationTargetId: "target-1",
    pageId: "page-1",
    message: "Hello",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "owner_approval_not_approved");
  assert.equal(getMetaCalls(), 0);
});

test("not configured fails closed without Meta call", async () => {
  const { getMetaCalls } = configuredDeps({
    isConfigured: () => false,
  });
  const result = await publishOrganicMetaPagePost({
    socialPostId: "post-1",
    publicationTargetId: "target-1",
    pageId: "page-1",
    message: "Hello",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "oauth_not_configured");
  assert.equal(getMetaCalls(), 0);
});

test("bound Page publishes through the mocked adapter", async () => {
  const { getMetaCalls, completedPublishes, consumedAuthorizationIds } = configuredDeps();
  const first = await publishOrganicMetaPagePost({
    socialPostId: "post-1",
    publicationTargetId: "target-1",
    pageId: "page-1",
    message: "Hello Jumping Jax",
    authorizationId: "exec-auth:test-1",
    idempotencyKey: "idem-1",
    adminActorId: "owner",
  });
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.replay, false);
    assert.equal(first.result.externalPostId, "page-1_999");
    assert.equal(first.result.status, "published");
    assert.ok(!("accessToken" in first.result));
  }
  assert.equal(getMetaCalls(), 1);
  assert.equal(consumedAuthorizationIds.has("exec-auth:test-1"), true);

  const second = await publishOrganicMetaPagePost({
    socialPostId: "post-1",
    publicationTargetId: "target-1",
    pageId: "page-1",
    message: "Hello Jumping Jax",
    authorizationId: "exec-auth:test-1",
    idempotencyKey: "idem-1",
    adminActorId: "owner",
  });
  assert.equal(second.ok, true);
  if (second.ok) {
    assert.equal(second.replay, true);
    assert.equal(second.result.externalPostId, "page-1_999");
  }
  assert.equal(getMetaCalls(), 1);
  assert.equal(completedPublishes.size, 1);
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
    socialPostId: "post-1",
    publicationTargetId: "target-1",
    pageId: "page-1",
    message: "Hello",
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
    socialPostId: "post-1",
    publicationTargetId: "target-1",
    pageId: "page-OTHER",
    message: "Hello",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "meta_page_binding_mismatch");
  assert.equal(getMetaCalls(), 0);
  assert.equal(getTokenLoads(), 0);
});

test("wrong publication target scope is denied with zero Meta adapter calls", async () => {
  const { getMetaCalls, getTokenLoads } = configuredDeps();
  const result = await publishOrganicMetaPagePost({
    socialPostId: "post-1",
    publicationTargetId: "target-OTHER",
    pageId: "page-1",
    message: "Hello",
    authorizationId: "exec-auth:test-1",
    adminActorId: "owner",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "authorization_scope_mismatch");
  assert.equal(getMetaCalls(), 0);
  assert.equal(getTokenLoads(), 0);
});

test("consumed authorization cannot publish again with different content", async () => {
  const { getMetaCalls } = configuredDeps();
  const first = await publishOrganicMetaPagePost({
    socialPostId: "post-1",
    publicationTargetId: "target-1",
    pageId: "page-1",
    message: "First",
    authorizationId: "exec-auth:test-1",
    idempotencyKey: "idem-a",
    adminActorId: "owner",
  });
  assert.equal(first.ok, true);

  const second = await publishOrganicMetaPagePost({
    socialPostId: "post-1",
    publicationTargetId: "target-1",
    pageId: "page-1",
    message: "Second different",
    authorizationId: "exec-auth:test-1",
    idempotencyKey: "idem-b",
    adminActorId: "owner",
  });
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.code, "authorization_consumed");
  assert.equal(getMetaCalls(), 1);
});

configureMetaOrganicPublishTestDependencies(null);
console.log("social-meta-page-publish-service tests passed");
