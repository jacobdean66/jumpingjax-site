import assert from "node:assert/strict";
import test from "node:test";

import {
  configureMetaOrganicPublishReadinessTestDependencies,
  evaluateMetaOrganicPublishReadiness,
  resolveVerifiedMetaOrganicPublishGates,
} from "./social-meta-page-publish-readiness";

function configuredMetaPath() {
  configureMetaOrganicPublishReadinessTestDependencies({
    isConfigured: () => true,
    isLedgerConfigured: () => true,
    loadConnectedSession: async () => ({ ok: true }),
    resolveBoundPage: async () => ({ ok: true, pageId: "page-1" }),
    countVaultedPageTokens: async () => 1,
  });
}

test.afterEach(() => {
  configureMetaOrganicPublishReadinessTestDependencies(null);
});

test("meta not configured", async () => {
  configureMetaOrganicPublishReadinessTestDependencies({
    isConfigured: () => false,
    isLedgerConfigured: () => true,
    loadConnectedSession: async () => ({ ok: true }),
    resolveBoundPage: async () => ({ ok: true, pageId: "page-1" }),
    countVaultedPageTokens: async () => 1,
  });
  const readiness = await evaluateMetaOrganicPublishReadiness({
    publicationTargetId: "target-1",
    verifiedOwnerApproval: true,
    verifiedValidExecutionAuthorization: true,
    complianceAllowed: true,
    durableStatus: { kind: "none" },
  });
  assert.equal(readiness.state, "meta_not_configured");
  assert.equal(readiness.canPublish, false);
});

test("not connected", async () => {
  configureMetaOrganicPublishReadinessTestDependencies({
    isConfigured: () => true,
    isLedgerConfigured: () => true,
    loadConnectedSession: async () => ({ ok: false }),
    resolveBoundPage: async () => ({ ok: true, pageId: "page-1" }),
    countVaultedPageTokens: async () => 1,
  });
  const readiness = await evaluateMetaOrganicPublishReadiness({
    publicationTargetId: "target-1",
    verifiedOwnerApproval: true,
    verifiedValidExecutionAuthorization: true,
    complianceAllowed: true,
    durableStatus: { kind: "none" },
  });
  assert.equal(readiness.state, "meta_not_connected");
  assert.equal(readiness.canPublish, false);
});

test("page not bound", async () => {
  configureMetaOrganicPublishReadinessTestDependencies({
    isConfigured: () => true,
    isLedgerConfigured: () => true,
    loadConnectedSession: async () => ({ ok: true }),
    resolveBoundPage: async () => ({ ok: false }),
    countVaultedPageTokens: async () => 1,
  });
  const readiness = await evaluateMetaOrganicPublishReadiness({
    publicationTargetId: "target-1",
    verifiedOwnerApproval: true,
    verifiedValidExecutionAuthorization: true,
    complianceAllowed: true,
    durableStatus: { kind: "none" },
  });
  assert.equal(readiness.state, "page_unbound");
  assert.equal(readiness.canPublish, false);
});

test("owner approval missing is distinct from execution authorization missing", async () => {
  configuredMetaPath();
  const ownerMissing = await evaluateMetaOrganicPublishReadiness({
    publicationTargetId: "target-1",
    verifiedOwnerApproval: false,
    verifiedValidExecutionAuthorization: true,
    complianceAllowed: true,
    durableStatus: { kind: "none" },
  });
  assert.equal(ownerMissing.state, "owner_approval_missing");
  assert.equal(ownerMissing.canPublish, false);

  const execMissing = await evaluateMetaOrganicPublishReadiness({
    publicationTargetId: "target-1",
    verifiedOwnerApproval: true,
    verifiedValidExecutionAuthorization: false,
    complianceAllowed: true,
    durableStatus: { kind: "none" },
  });
  assert.equal(execMissing.state, "execution_authorization_missing");
  assert.equal(execMissing.canPublish, false);
});

test("compliance null/false never ready", async () => {
  configuredMetaPath();
  const unknown = await evaluateMetaOrganicPublishReadiness({
    publicationTargetId: "target-1",
    verifiedOwnerApproval: true,
    verifiedValidExecutionAuthorization: true,
    complianceAllowed: null,
    durableStatus: { kind: "none" },
  });
  assert.equal(unknown.state, "compliance_not_ready");
  assert.equal(unknown.canPublish, false);

  const denied = await evaluateMetaOrganicPublishReadiness({
    publicationTargetId: "target-1",
    verifiedOwnerApproval: true,
    verifiedValidExecutionAuthorization: true,
    complianceAllowed: false,
    durableStatus: { kind: "none" },
  });
  assert.equal(denied.state, "compliance_not_ready");
  assert.equal(denied.canPublish, false);
});

test("ready only when all verified gates pass", async () => {
  configuredMetaPath();
  const readiness = await evaluateMetaOrganicPublishReadiness({
    publicationTargetId: "target-1",
    verifiedOwnerApproval: true,
    verifiedValidExecutionAuthorization: true,
    complianceAllowed: true,
    durableStatus: { kind: "none" },
  });
  assert.equal(readiness.state, "ready_to_publish");
  assert.equal(readiness.canPublish, true);
  assert.equal(readiness.pageId, "page-1");
  assert.ok(
    readiness.notes.some((n) =>
      n.includes("Local draft Approve is not Facebook publish authorization"),
    ),
  );
});

test("durable ledger unavailable is distinct from meta_not_configured", async () => {
  configureMetaOrganicPublishReadinessTestDependencies({
    isConfigured: () => true,
    isLedgerConfigured: () => false,
    loadConnectedSession: async () => ({ ok: true }),
    resolveBoundPage: async () => ({ ok: true, pageId: "page-1" }),
    countVaultedPageTokens: async () => 1,
  });
  const readiness = await evaluateMetaOrganicPublishReadiness({
    publicationTargetId: "target-1",
    verifiedOwnerApproval: true,
    verifiedValidExecutionAuthorization: true,
    complianceAllowed: true,
    durableStatus: { kind: "none" },
  });
  assert.equal(readiness.state, "durable_ledger_unavailable");
  assert.equal(readiness.canPublish, false);
  assert.notEqual(readiness.state, "meta_not_configured");
});

test("execution intent alone is insufficient for verified valid execution auth", async () => {
  const gates = await resolveVerifiedMetaOrganicPublishGates({
    publicationTargetId: "60000000-0000-4000-8000-000000000001",
    socialPostId: "50000000-0000-4000-8000-000000000001",
    authorizationId: null,
    authorizationSnapshot: {
      authorizations: [],
      cancellations: [],
      intents: [],
      sessions: [],
      auditEvents: [],
    },
    resolveDurableStatus: async () => ({ kind: "none" }),
  });
  assert.equal(gates.verifiedValidExecutionAuthorization, false);
  assert.equal(gates.verifiedOwnerApproval, false);
});

test("publishing / published / failed / recovery", async () => {
  configuredMetaPath();

  const publishing = await evaluateMetaOrganicPublishReadiness({
    publicationTargetId: "target-1",
    verifiedOwnerApproval: true,
    verifiedValidExecutionAuthorization: true,
    complianceAllowed: true,
    durableStatus: { kind: "in_progress", message: "in flight" },
  });
  assert.equal(publishing.state, "publishing");
  assert.equal(publishing.canPublish, false);

  const published = await evaluateMetaOrganicPublishReadiness({
    publicationTargetId: "target-1",
    verifiedOwnerApproval: true,
    verifiedValidExecutionAuthorization: true,
    complianceAllowed: true,
    durableStatus: {
      kind: "recorded",
      result: {
        externalPostId: "page-1_1",
        status: "published",
        socialPostId: "post",
        publicationTargetId: "target",
        pageId: "page-1",
        authorizationId: "auth",
        fingerprint: "fp",
      },
    },
  });
  assert.equal(published.state, "published");
  assert.equal(published.canPublish, false);

  const failed = await evaluateMetaOrganicPublishReadiness({
    publicationTargetId: "target-1",
    verifiedOwnerApproval: true,
    verifiedValidExecutionAuthorization: true,
    complianceAllowed: true,
    durableStatus: { kind: "consumed_failed", message: "pre-meta failed" },
  });
  assert.equal(failed.state, "failed");
  assert.equal(failed.canPublish, false);

  const recovery = await evaluateMetaOrganicPublishReadiness({
    publicationTargetId: "target-1",
    verifiedOwnerApproval: true,
    verifiedValidExecutionAuthorization: true,
    complianceAllowed: true,
    durableStatus: {
      kind: "uncertain",
      externalPostId: "page-1_9",
      message: "uncertain",
    },
  });
  assert.equal(recovery.state, "recovery_required");
  assert.equal(recovery.canPublish, false);
});

test("query-param-style hints cannot mark published without durable record", async () => {
  configuredMetaPath();
  const readiness = await evaluateMetaOrganicPublishReadiness({
    publicationTargetId: "target-1",
    verifiedOwnerApproval: true,
    verifiedValidExecutionAuthorization: true,
    complianceAllowed: true,
    durableStatus: { kind: "none" },
    publishStatusHint: "idle",
  });
  assert.equal(readiness.state, "ready_to_publish");
  assert.notEqual(readiness.state, "published");
});

test("ambiguous owner approval null fails closed", async () => {
  configuredMetaPath();
  const readiness = await evaluateMetaOrganicPublishReadiness({
    publicationTargetId: "target-1",
    verifiedOwnerApproval: null,
    verifiedValidExecutionAuthorization: true,
    complianceAllowed: true,
    durableStatus: { kind: "none" },
  });
  assert.equal(readiness.state, "readiness_unavailable");
  assert.equal(readiness.canPublish, false);
});

test("resolveVerified gates: missing auth is not valid", async () => {
  const gates = await resolveVerifiedMetaOrganicPublishGates({
    publicationTargetId: "60000000-0000-4000-8000-000000000001",
    socialPostId: "50000000-0000-4000-8000-000000000001",
    authorizationId: "exec-auth:missing",
    authorizationSnapshot: {
      authorizations: [],
      cancellations: [],
      intents: [],
      sessions: [],
      auditEvents: [],
    },
    resolveDurableStatus: async () => ({ kind: "none" }),
  });
  assert.equal(gates.verifiedValidExecutionAuthorization, false);
  assert.equal(gates.verifiedOwnerApproval, false);
});

console.log("social-meta-page-publish-readiness tests passed");
