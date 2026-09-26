import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "route.ts"), "utf8");

test("owner approval route is human-owner only and persists both lifecycle events", () => {
  assert.match(src, /verifyAdminOwnerAccess/);
  assert.match(src, /agent_approval_forbidden/);
  assert.match(src, /x-social-agent|x-cursor-agent/);
  assert.match(src, /requestOwnerApproval/);
  assert.match(src, /decideOwnerApproval/);
  assert.match(src, /decisionKind:\s*"approve"/);
  assert.match(src, /updateSocialPostStatus\(post\.id, "approved"\)/);
  assert.doesNotMatch(src, /publishOrganicMetaPagePost|fetch\(|META_APP_SECRET|accessToken/);
});
test("owner approval route checks current deterministic compliance before approval", () => {
  assert.match(src, /evaluateStatusTransitionFromStoredPost/);
  assert.match(src, /requestedStatus:\s*"approved"/);
  assert.match(src, /if \(!transition\.eligible\)/);
  assert.match(src, /compliance_blocked/);
});

test("owner approval is deterministic and replay-safe for identical reviewed content", () => {
  assert.match(src, /function deterministicUuid/);
  assert.match(src, /getOwnerApprovalProposalByApprovalId/);
  assert.match(src, /getOwnerApprovalCurrentStateByApprovalId/);
  assert.match(src, /lifecycleStatus === "approved"/);
  assert.match(src, /approval_recovery_required/);
  assert.doesNotMatch(src, /randomUUID/);
});
