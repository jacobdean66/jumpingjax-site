import assert from "node:assert/strict";
import test from "node:test";
import {
  beginAgentIdempotentAction,
  completeAgentIdempotentAction,
  resetAgentIdempotencyStoreForTests,
} from "./agent-idempotency";
import {
  complianceAllowsPaidGeneration,
  complianceBlocksPersistence,
  paidGenerationDeniedResponse,
  previewGenerationReady,
  DRAFT_COMPLIANCE_PERSISTENCE_POLICY,
} from "./generation-gate";
import type { ComplianceGateResult } from "./agent-compliance-gate";
import {
  DURABLE_STORE_BLOCKER,
  getAgentProtectionMode,
  paidGenerationProtectionBlock,
} from "./agent-protection-mode";
import {
  buildImageDirectorPreviewFingerprint,
  buildVideoDirectorPreviewFingerprint,
  buildImageConceptGenerationFingerprint,
  buildImageGenerationFingerprint,
  buildVideoGenerationFingerprint,
  isPreviewFingerprintStale,
} from "./preview-fingerprint";
import {
  resolveApprovedAssetContext,
  resolveVideoSourceAssetContext,
} from "./approved-asset-context";

function compliance(
  decision: ComplianceGateResult["decision"],
): ComplianceGateResult {
  return {
    deterministic: true,
    modelApproved: false,
    resultState: decision === "allow" ? "compliant" : decision === "block" ? "violations-found" : "insufficient-spec",
    decision,
    allowedToProceed: decision === "allow",
    summary: `decision=${decision}`,
    blockingCodes: [],
    hardClaimFindings: [],
    evaluationId: null,
    specificationId: null,
  };
}

test("quarantine and block cannot start paid generation (allowedToProceed enforced)", () => {
  assert.equal(complianceAllowsPaidGeneration(compliance("allow")), true);
  assert.equal(complianceAllowsPaidGeneration(compliance("quarantine")), false);
  assert.equal(complianceAllowsPaidGeneration(compliance("block")), false);

  const denied = paidGenerationDeniedResponse(compliance("quarantine"));
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "compliance_not_allow");
  assert.equal(denied.publication.published, false);
});

test("block and quarantine cannot persist or unlock generation", () => {
  assert.equal(complianceBlocksPersistence(compliance("block")), true);
  assert.equal(complianceBlocksPersistence(compliance("quarantine")), true);
  assert.equal(DRAFT_COMPLIANCE_PERSISTENCE_POLICY.quarantineMayPersistWorkingDraft, false);
  assert.equal(complianceBlocksPersistence(compliance("allow")), false);
  assert.equal(DRAFT_COMPLIANCE_PERSISTENCE_POLICY.quarantineUnlocksPaidGeneration, false);
  assert.equal(DRAFT_COMPLIANCE_PERSISTENCE_POLICY.blockMayPersistViaAgentFlows, false);

  const ready = previewGenerationReady(compliance("quarantine"));
  assert.equal(ready.generationReady, false);
});

test("durable store is blocked; production paid generation disabled; local process-local allowed", async () => {
  const prod = getAgentProtectionMode({
    NODE_ENV: "production",
    VERCEL: "1",
    VERCEL_ENV: "production",
  } as NodeJS.ProcessEnv);
  assert.equal(prod.kind, "disabled");
  assert.match(prod.kind === "disabled" ? prod.reason : "", new RegExp(DURABLE_STORE_BLOCKER));

  const blocked = await paidGenerationProtectionBlock({
    NODE_ENV: "production",
    VERCEL_ENV: "production",
  } as NodeJS.ProcessEnv);
  assert.ok(blocked);
  assert.equal(blocked?.code, "durable_protection_unavailable");

  const local = getAgentProtectionMode({
    NODE_ENV: "test",
  } as NodeJS.ProcessEnv);
  assert.equal(local.kind, "process-local-nonproduction");
  assert.equal(local.durable, false);
});

test("image/video generation idempotency collapses concurrent duplicates and replays once", () => {
  resetAgentIdempotencyStoreForTests();
  const fingerprint = buildImageGenerationFingerprint({
    postId: "post-1",
    prompt: "Family-friendly still. No prices.",
    preset: "kids-playing",
    mode: "edit",
    assetId: "https://example.com/a.png",
    aspectRatio: "4:5",
  });

  const first = beginAgentIdempotentAction({
    clientKey: "client",
    action: "generate-image",
    idempotencyKey: "gen-1",
    fingerprint,
  });
  assert.equal(first.kind, "proceed");

  const concurrent = beginAgentIdempotentAction({
    clientKey: "client",
    action: "generate-image",
    idempotencyKey: "gen-1",
    fingerprint,
  });
  assert.equal(concurrent.kind, "in_progress");

  if (first.kind === "proceed") {
    completeAgentIdempotentAction({
      storeKey: first.storeKey,
      fingerprint,
      status: 200,
      body: { ok: true, providerCalls: 1, publication: { published: false } },
    });
  }

  const replay = beginAgentIdempotentAction({
    clientKey: "client",
    action: "generate-image",
    idempotencyKey: "gen-1",
    fingerprint,
  });
  assert.equal(replay.kind, "replay");
  if (replay.kind === "replay") {
    assert.equal((replay.body as { providerCalls: number }).providerCalls, 1);
  }

  resetAgentIdempotencyStoreForTests();
  const videoFp = buildVideoGenerationFingerprint({
    postId: "post-1",
    prompt: "Family video prompt",
    motionPreset: "default",
    cameraPreset: "static",
    assetId: "asset-1",
  });
  const v1 = beginAgentIdempotentAction({
    clientKey: "client",
    action: "generate-media",
    idempotencyKey: null,
    fingerprint: videoFp,
  });
  const v2 = beginAgentIdempotentAction({
    clientKey: "client",
    action: "generate-media",
    idempotencyKey: null,
    fingerprint: videoFp,
  });
  assert.equal(v1.kind, "proceed");
  assert.equal(v2.kind, "in_progress");

  resetAgentIdempotencyStoreForTests();
  const conceptsFp = buildImageConceptGenerationFingerprint({
    postId: "post-1",
    prompt: "Concept batch prompt",
    preset: "kids-playing",
    mode: "edit",
    assetId: "https://example.com/a.png",
    conceptId: null,
    providerId: null,
  });
  const c1 = beginAgentIdempotentAction({
    clientKey: "client",
    action: "generate-image-concepts",
    idempotencyKey: "concepts-1",
    fingerprint: conceptsFp,
  });
  const c2 = beginAgentIdempotentAction({
    clientKey: "client",
    action: "generate-image-concepts",
    idempotencyKey: "concepts-1",
    fingerprint: conceptsFp,
  });
  assert.equal(c1.kind, "proceed");
  assert.equal(c2.kind, "in_progress");
});

test("changed prompt/preset/placement produce new preview fingerprints (stale replay prevention)", () => {
  const base = {
    postId: "p1",
    prompt: "Original prompt about family fun",
    goal: "Promote clean fun",
    preset: "kids-playing",
    placement: "feed",
    formatVariantId: "feed-4x5",
    assetId: "https://cdn.example/a.png",
    assetCategory: "Water Slides",
  };
  const a = buildImageDirectorPreviewFingerprint(base);
  const b = buildImageDirectorPreviewFingerprint({
    ...base,
    prompt: "Edited prompt about family fun",
  });
  const c = buildImageDirectorPreviewFingerprint({
    ...base,
    preset: "original-rental-photo",
  });
  const d = buildImageDirectorPreviewFingerprint({
    ...base,
    placement: "story",
  });
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.notEqual(a, d);
  assert.equal(isPreviewFingerprintStale(a, b), true);
  assert.equal(isPreviewFingerprintStale(a, a), false);

  const v1 = buildVideoDirectorPreviewFingerprint({
    postId: "p1",
    prompt: "Video prompt A",
    goal: "g",
    motionPreset: "default",
    cameraPreset: "static",
    placement: "reels",
    assetId: "asset",
    assetCategory: "Bounce Houses",
  });
  const v2 = buildVideoDirectorPreviewFingerprint({
    postId: "p1",
    prompt: "Video prompt B",
    goal: "g",
    motionPreset: "default",
    cameraPreset: "static",
    placement: "reels",
    assetId: "asset",
    assetCategory: "Bounce Houses",
  });
  assert.notEqual(v1, v2);
});

test("preview generationReady only when compliance allow", () => {
  assert.equal(previewGenerationReady(compliance("allow")).generationReady, true);
  assert.equal(previewGenerationReady(compliance("quarantine")).generationReady, false);
  assert.equal(previewGenerationReady(compliance("block")).generationReady, false);
  assert.equal(previewGenerationReady(null).generationReady, false);
});

test("manual asset policy rejects arbitrary external URLs", () => {
  const rejected = resolveApprovedAssetContext("https://evil.example/x.png?token=abc");
  assert.equal(rejected.ok, false);
});

test("owner-approved generated stills require matching post.approved_image_url", () => {
  const mismatch = resolveVideoSourceAssetContext({
    candidateUrl: "https://cdn.example/generated-other.png",
    postApprovedImageUrl: "https://cdn.example/generated-ok.png",
    postId: "post-1",
  });
  assert.equal(mismatch.ok, false);

  const match = resolveVideoSourceAssetContext({
    candidateUrl: "https://cdn.example/generated-ok.png?token=should-strip",
    postApprovedImageUrl: "https://cdn.example/generated-ok.png?sig=abc",
    postId: "post-1",
  });
  assert.equal(match.ok, true);
  if (match.ok) {
    assert.equal(match.kind, "owner-approved-generated");
    assert.ok(match.url);
    assert.doesNotMatch(match.url, /token=|sig=/i);
  }
});

test("auth/404-before-provider orchestration helpers: protection and compliance gates short-circuit", async () => {
  // Route order helpers: protection/compliance denial never starts a provider.
  let providerCalls = 0;
  const startProvider = () => {
    providerCalls += 1;
  };

  const protection = await paidGenerationProtectionBlock({
    NODE_ENV: "production",
    VERCEL_ENV: "production",
  } as NodeJS.ProcessEnv);
  if (protection) {
    // short-circuit
  } else if (!complianceAllowsPaidGeneration(compliance("quarantine"))) {
    // short-circuit
  } else {
    startProvider();
  }
  assert.equal(providerCalls, 0);

  if (!complianceAllowsPaidGeneration(compliance("quarantine"))) {
    // short-circuit
  } else {
    startProvider();
  }
  assert.equal(providerCalls, 0);

  if (complianceAllowsPaidGeneration(compliance("allow"))) {
    startProvider();
  }
  assert.equal(providerCalls, 1);
});

test("publication side-effect shapes stay unpublished on denial and draft policy", () => {
  const denied = paidGenerationDeniedResponse(compliance("block"));
  assert.equal(denied.publication.published, false);
  assert.equal(DRAFT_COMPLIANCE_PERSISTENCE_POLICY.ownerApprovalAlwaysRequired, true);
});
