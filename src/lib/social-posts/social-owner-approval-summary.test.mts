import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { OwnerApprovalComputedCurrentState } from "./social-owner-approval-current-state";
import type {
  SocialOwnerApprovalApprovalId,
  SocialOwnerApprovalProposalId,
} from "./social-owner-approval-persistence";
import type { OwnerApprovalStateServiceResult } from "./social-owner-approval-state-service";
import {
  projectOwnerApprovalStatusView,
  projectOwnerApprovalStatusViewUnavailable,
} from "./social-owner-approval-status-view";
import {
  buildOwnerApprovalSummary,
  buildOwnerApprovalSummaryUnavailable,
  OWNER_APPROVAL_SUMMARY_ERROR_CODES,
} from "./social-owner-approval-summary";
import * as summaryExports from "./social-owner-approval-summary";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function computedState(
  input: Partial<OwnerApprovalComputedCurrentState> = {},
): OwnerApprovalComputedCurrentState {
  return {
    proposalId: "proposal-1" as SocialOwnerApprovalProposalId,
    approvalId: "approval-1" as SocialOwnerApprovalApprovalId,
    lifecycleStatus: "no_events",
    decisionStatus: "none",
    latestEventId: null,
    latestEventSequence: null,
    latestDecisionEventId: null,
    latestDecisionKind: null,
    requestedAt: null,
    decidedAt: null,
    revokedAt: null,
    reasonCode: "computed:no_events",
    computedOnly: true,
    ...input,
  };
}

function okStateResult(
  state: OwnerApprovalComputedCurrentState,
): OwnerApprovalStateServiceResult {
  return { ok: true, value: state };
}

function errorStateResult(
  message = "Proposal not found",
): OwnerApprovalStateServiceResult {
  return {
    ok: false,
    error: {
      code: "proposal_not_found",
      message,
    },
  };
}

await test("builds summary from ok stateResult and matching statusView", () => {
  const state = computedState({ lifecycleStatus: "requested" });
  const statusView = projectOwnerApprovalStatusView(state);
  const result = buildOwnerApprovalSummary({
    stateResult: okStateResult(state),
    statusView,
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  const summary = result.value;
  assert.equal(summary.proposalId, "proposal-1");
  assert.equal(summary.approvalId, "approval-1");
  assert.equal(summary.statusKind, "requested");
  assert.equal(summary.statusLabel, statusView.statusLabel);
  assert.equal(summary.badgeTone, statusView.badgeTone);
  assert.equal(summary.ownerActionRequired, true);
  assert.equal(summary.canBeSubmittedForApproval, false);
  assert.equal(summary.source, "owner_approval_computed_state");
});

await test("returns state_unavailable when stateResult is error", () => {
  const state = computedState({ lifecycleStatus: "approved" });
  const statusView = projectOwnerApprovalStatusView(state);
  const result = buildOwnerApprovalSummary({
    stateResult: errorStateResult("Events read failed"),
    statusView,
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.equal(result.error.code, "state_unavailable");
  assert.equal(result.error.message, "Events read failed");
});

await test("returns status_view_mismatch when statusKind does not match lifecycle", () => {
  const state = computedState({ lifecycleStatus: "approved" });
  const mismatchedView = projectOwnerApprovalStatusView(
    computedState({ lifecycleStatus: "requested" }),
  );
  const result = buildOwnerApprovalSummary({
    stateResult: okStateResult(state),
    statusView: mismatchedView,
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.equal(result.error.code, "status_view_mismatch");
  assert.match(result.error.message, /approved/);
  assert.match(result.error.message, /requested/);
});

await test("buildOwnerApprovalSummaryUnavailable returns unavailable summary", () => {
  const unavailableView = projectOwnerApprovalStatusViewUnavailable();
  const summary = buildOwnerApprovalSummaryUnavailable();

  assert.equal(summary.proposalId, null);
  assert.equal(summary.approvalId, null);
  assert.equal(summary.statusKind, "unavailable");
  assert.equal(summary.statusLabel, unavailableView.statusLabel);
  assert.equal(summary.badgeTone, unavailableView.badgeTone);
  assert.equal(summary.ownerActionRequired, false);
  assert.equal(summary.canBeSubmittedForApproval, false);
  assert.equal(summary.source, "owner_approval_computed_state");
});

await test("canBePublishedSignalOnly is preserved with notPublicationPermission true", () => {
  const state = computedState({ lifecycleStatus: "approved" });
  const statusView = projectOwnerApprovalStatusView(state);
  const result = buildOwnerApprovalSummary({
    stateResult: okStateResult(state),
    statusView,
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.deepEqual(result.value.canBePublishedSignalOnly, {
    signal: true,
    authoritative: false,
    computedOnly: true,
    notPublicationPermission: true,
  });
  assert.equal(result.value.notPublicationPermission, true);
});

await test("summary carries computed-only non-authoritative invariant flags", () => {
  const state = computedState({ lifecycleStatus: "no_events" });
  const result = buildOwnerApprovalSummary({
    stateResult: okStateResult(state),
    statusView: projectOwnerApprovalStatusView(state),
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.value.computedOnly, true);
  assert.equal(result.value.authoritative, false);
  assert.equal(result.value.approvesNothing, true);
  assert.equal(result.value.publishesNothing, true);
  assert.equal(result.value.schedulesNothing, true);
  assert.equal(result.value.notPublicationPermission, true);
});

await test("summary module exports no forbidden runtime symbols", () => {
  const forbidden = [
    "getOwnerApprovalCurrentState",
    "getOwnerApprovalCurrentStateByProposalId",
    "getOwnerApprovalCurrentStateByApprovalId",
    "projectOwnerApprovalStatusView",
    "projectOwnerApprovalStatusViewUnavailable",
    "projectOwnerApprovalStatusViewInvalidHistory",
    "getOwnerApprovalStatusKind",
    "computeOwnerApprovalCurrentState",
    "getOwnerApprovalProposalById",
    "evaluateOwnerApprovalAuthorization",
    "requestOwnerApproval",
    "decideOwnerApproval",
  ];

  for (const name of forbidden) {
    assert.equal(name in summaryExports, false);
  }

  assert.equal("buildOwnerApprovalSummary" in summaryExports, true);
  assert.equal("buildOwnerApprovalSummaryUnavailable" in summaryExports, true);
  assert.equal("OWNER_APPROVAL_SUMMARY_ERROR_CODES" in summaryExports, true);
  assert.deepEqual(
    [...OWNER_APPROVAL_SUMMARY_ERROR_CODES],
    ["state_unavailable", "status_view_mismatch"],
  );
});

await test("summary module has no Supabase, store, readiness, or manifest imports", () => {
  const source = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "social-owner-approval-summary.ts",
    ),
    "utf8",
  );

  assert.equal(source.includes("supabase"), false);
  assert.equal(source.includes("social-owner-approval-store"), false);
  assert.equal(source.includes("social-owner-approval-authorization"), false);
  assert.equal(source.includes("social-owner-approval-request-flow"), false);
  assert.equal(source.includes("social-owner-approval-decision-flow"), false);
  assert.equal(source.includes("readiness"), false);
  assert.equal(source.includes("manifest"), false);
  assert.equal(source.includes("/api/"), false);
  assert.equal(source.includes("next/"), false);
  assert.equal(source.includes(".tsx"), false);
  assert.match(
    source,
    /import type \{ OwnerApprovalStateServiceResult \} from "\.\/social-owner-approval-state-service"/,
  );
  assert.doesNotMatch(
    source,
    /import \{[^}]*\} from "\.\/social-owner-approval-state-service"/,
  );
});

await test("summary input is not mutated by buildOwnerApprovalSummary", () => {
  const state = computedState({ lifecycleStatus: "approved" });
  const stateResult = okStateResult(state);
  const statusView = projectOwnerApprovalStatusView(state);
  const input = {
    stateResult,
    statusView,
  };
  const snapshot = structuredClone(input);

  buildOwnerApprovalSummary(input);

  assert.deepEqual(input, snapshot);
});

await test("summary build is deterministic for repeated calls", () => {
  const state = computedState({ lifecycleStatus: "rejected" });
  const input = {
    stateResult: okStateResult(state),
    statusView: projectOwnerApprovalStatusView(state),
  };

  assert.deepEqual(
    buildOwnerApprovalSummary(input),
    buildOwnerApprovalSummary(input),
  );
  assert.deepEqual(
    buildOwnerApprovalSummaryUnavailable(),
    buildOwnerApprovalSummaryUnavailable(),
  );
  assert.deepEqual(
    buildOwnerApprovalSummaryUnavailable({ reasonCode: "test" }),
    buildOwnerApprovalSummaryUnavailable({ reasonCode: "test" }),
  );
});
