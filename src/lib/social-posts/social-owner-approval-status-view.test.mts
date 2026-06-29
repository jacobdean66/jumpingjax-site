import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { OwnerApprovalComputedCurrentState } from "./social-owner-approval-current-state";
import type {
  SocialOwnerApprovalApprovalId,
  SocialOwnerApprovalProposalId,
} from "./social-owner-approval-persistence";
import {
  getOwnerApprovalStatusKind,
  projectOwnerApprovalStatusView,
  projectOwnerApprovalStatusViewInvalidHistory,
  projectOwnerApprovalStatusViewUnavailable,
} from "./social-owner-approval-status-view";
import * as statusViewExports from "./social-owner-approval-status-view";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

const LIFECYCLE_TO_STATUS_KIND = [
  ["no_events", "not_requested"],
  ["requested", "requested"],
  ["approved", "approved"],
  ["rejected", "rejected"],
  ["revoked", "revoked"],
  ["expired", "expired"],
  ["superseded", "superseded"],
] as const;

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

for (const [lifecycleStatus, statusKind] of LIFECYCLE_TO_STATUS_KIND) {
  await test(`lifecycle ${lifecycleStatus} maps to statusKind ${statusKind}`, () => {
    assert.equal(getOwnerApprovalStatusKind(lifecycleStatus), statusKind);

    const view = projectOwnerApprovalStatusView(
      computedState({ lifecycleStatus }),
    );
    assert.equal(view.statusKind, statusKind);
    assert.equal(typeof view.statusLabel, "string");
    assert.equal(view.statusLabel.length > 0, true);
    assert.equal(view.computedOnly, true);
    assert.equal(view.authoritative, false);
  });
}

await test("ownerActionRequired is true only for requested", () => {
  for (const [lifecycleStatus, statusKind] of LIFECYCLE_TO_STATUS_KIND) {
    const view = projectOwnerApprovalStatusView(
      computedState({ lifecycleStatus }),
    );
    assert.equal(view.ownerActionRequired, statusKind === "requested");
  }

  assert.equal(
    projectOwnerApprovalStatusViewUnavailable().ownerActionRequired,
    false,
  );
  assert.equal(
    projectOwnerApprovalStatusViewInvalidHistory().ownerActionRequired,
    false,
  );
});

await test("canBeSubmittedForApproval is true only for not_requested", () => {
  for (const [lifecycleStatus, statusKind] of LIFECYCLE_TO_STATUS_KIND) {
    const view = projectOwnerApprovalStatusView(
      computedState({ lifecycleStatus }),
    );
    assert.equal(
      view.canBeSubmittedForApproval,
      statusKind === "not_requested",
    );
  }

  assert.equal(
    projectOwnerApprovalStatusViewUnavailable().canBeSubmittedForApproval,
    false,
  );
  assert.equal(
    projectOwnerApprovalStatusViewInvalidHistory().canBeSubmittedForApproval,
    false,
  );
});

await test("canBePublishedSignalOnly.signal is true only for approved", () => {
  for (const [lifecycleStatus, statusKind] of LIFECYCLE_TO_STATUS_KIND) {
    const view = projectOwnerApprovalStatusView(
      computedState({ lifecycleStatus }),
    );
    assert.equal(
      view.canBePublishedSignalOnly.signal,
      statusKind === "approved",
    );
    assert.equal(view.canBePublishedSignalOnly.authoritative, false);
    assert.equal(view.canBePublishedSignalOnly.computedOnly, true);
    assert.equal(
      view.canBePublishedSignalOnly.notPublicationPermission,
      true,
    );
  }
});

await test("approved lifecycle uses success badge tone", () => {
  const view = projectOwnerApprovalStatusView(
    computedState({ lifecycleStatus: "approved" }),
  );
  assert.equal(view.badgeTone, "success");
});

await test("requested lifecycle uses info badge tone", () => {
  const view = projectOwnerApprovalStatusView(
    computedState({ lifecycleStatus: "requested" }),
  );
  assert.equal(view.badgeTone, "info");
});

await test("rejected and revoked lifecycles use danger badge tone", () => {
  assert.equal(
    projectOwnerApprovalStatusView(
      computedState({ lifecycleStatus: "rejected" }),
    ).badgeTone,
    "danger",
  );
  assert.equal(
    projectOwnerApprovalStatusView(
      computedState({ lifecycleStatus: "revoked" }),
    ).badgeTone,
    "danger",
  );
});

await test("expired and superseded lifecycles use warning badge tone", () => {
  assert.equal(
    projectOwnerApprovalStatusView(
      computedState({ lifecycleStatus: "expired" }),
    ).badgeTone,
    "warning",
  );
  assert.equal(
    projectOwnerApprovalStatusView(
      computedState({ lifecycleStatus: "superseded" }),
    ).badgeTone,
    "warning",
  );
});

await test("no_events lifecycle uses neutral badge tone", () => {
  const view = projectOwnerApprovalStatusView(
    computedState({ lifecycleStatus: "no_events" }),
  );
  assert.equal(view.badgeTone, "neutral");
});

await test("unavailable projection uses neutral tone and false action hints", () => {
  const view = projectOwnerApprovalStatusViewUnavailable();

  assert.equal(view.statusKind, "unavailable");
  assert.equal(view.badgeTone, "neutral");
  assert.equal(view.statusLabel, "Approval status unavailable");
  assert.equal(view.ownerActionRequired, false);
  assert.equal(view.canBeSubmittedForApproval, false);
  assert.equal(view.canBePublishedSignalOnly.signal, false);
  assert.equal(view.computedOnly, true);
  assert.equal(view.authoritative, false);
});

await test("invalid_history projection uses danger tone and false action hints", () => {
  const view = projectOwnerApprovalStatusViewInvalidHistory();

  assert.equal(view.statusKind, "invalid_history");
  assert.equal(view.badgeTone, "danger");
  assert.equal(view.statusLabel, "Invalid approval history");
  assert.equal(view.ownerActionRequired, false);
  assert.equal(view.canBeSubmittedForApproval, false);
  assert.equal(view.canBePublishedSignalOnly.signal, false);
});

await test("invalid_history projection includes reasonCode in label when provided", () => {
  const view = projectOwnerApprovalStatusViewInvalidHistory(
    "invalid_history:duplicate_event_sequence",
  );

  assert.equal(
    view.statusLabel,
    "Invalid approval history (invalid_history:duplicate_event_sequence)",
  );
});

await test("status view module exports no authorization or flow execution", () => {
  const forbidden = [
    "evaluateOwnerApprovalAuthorization",
    "requestOwnerApproval",
    "decideOwnerApproval",
    "createOwnerApprovalProposal",
    "appendOwnerApprovalEvent",
    "getOwnerApprovalProposalById",
    "validateTransition",
    "isApprovalValid",
    "computeOwnerApprovalCurrentState",
  ];

  for (const name of forbidden) {
    assert.equal(name in statusViewExports, false);
  }
});

await test("status view module has no Supabase, API, route, store, or flow imports", () => {
  const source = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "social-owner-approval-status-view.ts",
    ),
    "utf8",
  );

  assert.equal(source.includes("supabase"), false);
  assert.equal(source.includes("/api/"), false);
  assert.equal(source.includes("next/"), false);
  assert.equal(source.includes(".tsx"), false);
  assert.equal(source.includes("social-owner-approval-store"), false);
  assert.equal(source.includes("social-owner-approval-state-service"), false);
  assert.equal(source.includes("social-owner-approval-authorization"), false);
  assert.equal(source.includes("social-owner-approval-request-flow"), false);
  assert.equal(source.includes("social-owner-approval-decision-flow"), false);
});

await test("computed state input is not mutated by projection", () => {
  const state = computedState({ lifecycleStatus: "requested" });
  const snapshot = structuredClone(state);

  projectOwnerApprovalStatusView(state);

  assert.deepEqual(state, snapshot);
  assert.equal("statusKind" in state, false);
  assert.equal("statusLabel" in state, false);
});

await test("projection is deterministic for repeated calls", () => {
  const state = computedState({ lifecycleStatus: "approved" });

  assert.deepEqual(
    projectOwnerApprovalStatusView(state),
    projectOwnerApprovalStatusView(state),
  );
  assert.deepEqual(
    projectOwnerApprovalStatusViewUnavailable(),
    projectOwnerApprovalStatusViewUnavailable(),
  );
  assert.deepEqual(
    projectOwnerApprovalStatusViewInvalidHistory("invalid_history:test"),
    projectOwnerApprovalStatusViewInvalidHistory("invalid_history:test"),
  );
});
