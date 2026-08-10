import assert from "node:assert/strict";
import test from "node:test";

import {
  createMemoryMetaOrganicPublishLedger,
  resetMetaOrganicPublishLedgerMemoryForTests,
  resolveMetaOrganicPublishDurableStatusFromMemory,
} from "./social-meta-page-publish-ledger";

const POST_ID = "50000000-0000-4000-8000-000000000001";
const TARGET_ID = "60000000-0000-4000-8000-000000000001";
const AUTH_ID = "exec-auth:ledger-1";
const FP =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FP2 =
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

test.beforeEach(() => {
  resetMetaOrganicPublishLedgerMemoryForTests();
});

test("atomic dual-claim => only one proceed", async () => {
  const ledger = createMemoryMetaOrganicPublishLedger();
  const [a, b] = await Promise.all([
    ledger.claim({
      authorizationId: AUTH_ID,
      socialPostId: POST_ID,
      publicationTargetId: TARGET_ID,
      pageId: "page-1",
      fingerprint: FP,
      ownerApprovalId: "owner-approval:1",
      adminActorId: "owner-a",
    }),
    ledger.claim({
      authorizationId: AUTH_ID,
      socialPostId: POST_ID,
      publicationTargetId: TARGET_ID,
      pageId: "page-1",
      fingerprint: FP,
      ownerApprovalId: "owner-approval:1",
      adminActorId: "owner-b",
    }),
  ]);
  const proceeds = [a, b].filter((c) => c.ok && c.kind === "proceed");
  const blocked = [a, b].filter(
    (c) => c.ok && (c.kind === "in_progress" || c.kind === "awaiting_reconciliation"),
  );
  assert.equal(proceeds.length, 1);
  assert.equal(blocked.length, 1);
});

test("completed replay returns durable sanitized external id", async () => {
  const ledger = createMemoryMetaOrganicPublishLedger();
  const claim = await ledger.claim({
    authorizationId: AUTH_ID,
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    fingerprint: FP,
    ownerApprovalId: "owner-approval:1",
    adminActorId: "owner",
  });
  assert.ok(claim.ok && claim.kind === "proceed");
  assert.equal((await ledger.markMetaInvoked({
    authorizationId: AUTH_ID,
    claimId: claim.claimId,
  })).ok, true);
  assert.equal(
    (
      await ledger.complete({
        authorizationId: AUTH_ID,
        claimId: claim.claimId,
        result: {
          externalPostId: "page-1_42",
          status: "published",
          socialPostId: POST_ID,
          publicationTargetId: TARGET_ID,
          pageId: "page-1",
          authorizationId: AUTH_ID,
          fingerprint: FP,
        },
      })
    ).ok,
    true,
  );

  const replay = await ledger.claim({
    authorizationId: AUTH_ID,
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    fingerprint: FP,
    ownerApprovalId: "owner-approval:1",
    adminActorId: "owner",
  });
  assert.equal(replay.ok && replay.kind === "replay", true);
  if (replay.ok && replay.kind === "replay") {
    assert.equal(replay.result.externalPostId, "page-1_42");
  }
  const status = resolveMetaOrganicPublishDurableStatusFromMemory(AUTH_ID);
  assert.equal(status.kind, "recorded");
});

test("stale pre-Meta reclaim allowed; post-Meta no reclaim", async () => {
  let nowMs = 1_000;
  const ledger = createMemoryMetaOrganicPublishLedger({ now: () => nowMs });
  const first = await ledger.claim({
    authorizationId: AUTH_ID,
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    fingerprint: FP,
    ownerApprovalId: "owner-approval:1",
    adminActorId: "owner",
    leaseMs: 1000,
  });
  assert.ok(first.ok && first.kind === "proceed");

  nowMs = 5_000;
  const reclaimed = await ledger.claim({
    authorizationId: AUTH_ID,
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    fingerprint: FP,
    ownerApprovalId: "owner-approval:1",
    adminActorId: "owner",
    leaseMs: 1000,
  });
  assert.equal(reclaimed.ok && reclaimed.kind === "proceed", true);
  if (!(reclaimed.ok && reclaimed.kind === "proceed")) return;

  assert.equal(
    (
      await ledger.markMetaInvoked({
        authorizationId: AUTH_ID,
        claimId: reclaimed.claimId,
      })
    ).ok,
    true,
  );

  nowMs = 50_000;
  const afterMeta = await ledger.claim({
    authorizationId: AUTH_ID,
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    fingerprint: FP,
    ownerApprovalId: "owner-approval:1",
    adminActorId: "owner",
    leaseMs: 1000,
  });
  assert.equal(
    afterMeta.ok && afterMeta.kind === "awaiting_reconciliation",
    true,
  );
});

test("fail after meta_invoked returns awaiting reconciliation", async () => {
  const ledger = createMemoryMetaOrganicPublishLedger();
  const claim = await ledger.claim({
    authorizationId: AUTH_ID,
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    fingerprint: FP,
    ownerApprovalId: "owner-approval:1",
    adminActorId: "owner",
  });
  assert.ok(claim.ok && claim.kind === "proceed");
  await ledger.markMetaInvoked({
    authorizationId: AUTH_ID,
    claimId: claim.claimId,
  });
  const failed = await ledger.fail({
    authorizationId: AUTH_ID,
    claimId: claim.claimId,
    errorCode: "meta_publish_failed",
    message: "graph denied",
  });
  assert.equal(failed.ok, false);
  if (!failed.ok) {
    assert.equal(failed.awaitingReconciliation, true);
  }
});

test("conflicting completion id hard-fails", async () => {
  const ledger = createMemoryMetaOrganicPublishLedger();
  const claim = await ledger.claim({
    authorizationId: AUTH_ID,
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    fingerprint: FP,
    ownerApprovalId: "owner-approval:1",
    adminActorId: "owner",
  });
  assert.ok(claim.ok && claim.kind === "proceed");
  await ledger.markMetaInvoked({
    authorizationId: AUTH_ID,
    claimId: claim.claimId,
  });
  assert.equal(
    (
      await ledger.complete({
        authorizationId: AUTH_ID,
        claimId: claim.claimId,
        result: {
          externalPostId: "page-1_1",
          status: "published",
          socialPostId: POST_ID,
          publicationTargetId: TARGET_ID,
          pageId: "page-1",
          authorizationId: AUTH_ID,
          fingerprint: FP,
        },
      })
    ).ok,
    true,
  );
  const conflict = await ledger.complete({
    authorizationId: AUTH_ID,
    claimId: claim.claimId,
    result: {
      externalPostId: "page-1_2",
      status: "published",
      socialPostId: POST_ID,
      publicationTargetId: TARGET_ID,
      pageId: "page-1",
      authorizationId: AUTH_ID,
      fingerprint: FP,
    },
  });
  assert.equal(conflict.ok, false);
  if (!conflict.ok) {
    assert.equal(conflict.code, "external_publication_id_conflict");
  }
});

test("fingerprint mismatch denies", async () => {
  const ledger = createMemoryMetaOrganicPublishLedger();
  const claim = await ledger.claim({
    authorizationId: AUTH_ID,
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    fingerprint: FP,
    ownerApprovalId: "owner-approval:1",
    adminActorId: "owner",
  });
  assert.ok(claim.ok && claim.kind === "proceed");
  const mismatch = await ledger.claim({
    authorizationId: AUTH_ID,
    socialPostId: POST_ID,
    publicationTargetId: TARGET_ID,
    pageId: "page-1",
    fingerprint: FP2,
    ownerApprovalId: "owner-approval:1",
    adminActorId: "owner",
  });
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.equal(mismatch.code, "fingerprint_conflict");
});

console.log("social-meta-page-publish-ledger tests passed");
