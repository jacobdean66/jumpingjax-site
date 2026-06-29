import assert from "node:assert/strict";

import {
  APPROVAL_STATUSES,
  APPROVAL_TRANSITIONS,
  canApprove,
  canExpire,
  canReject,
  canRequestApproval,
  canRevoke,
  canSupersede,
  evaluateApprovalValidity,
  getNextLegalStates,
  isApprovalActive,
  isApprovalTerminal,
  isApprovalValid,
  isProposalChanged,
  validateTransition,
  type ApprovalAuthority,
  type ApprovalDecision,
  type ApprovalEventType,
  type ApprovalScope,
  type ApprovalStatus,
  type ProposalIdentity,
} from "./social-owner-approval";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

const OWNER: ApprovalAuthority = {
  actorId: "owner-1",
  actorType: "human",
  role: "owner",
  canApprove: true,
};

const ADMIN: ApprovalAuthority = {
  actorId: "admin-1",
  actorType: "human",
  role: "admin",
  canApprove: false,
};

const AI: ApprovalAuthority = {
  actorId: "ai-1",
  actorType: "ai",
  role: "ai",
  canApprove: false,
};

const SYSTEM: ApprovalAuthority = {
  actorId: "system-1",
  actorType: "system",
  role: "system",
  canApprove: false,
};

const PROPOSAL: ProposalIdentity = {
  socialPostId: "post-1",
  proposalFingerprint: "fingerprint-1",
  version: "v1",
};

const CHANGED_PROPOSAL: ProposalIdentity = {
  socialPostId: "post-1",
  proposalFingerprint: "fingerprint-2",
  version: "v2",
};

const OTHER_POST_PROPOSAL: ProposalIdentity = {
  socialPostId: "post-2",
  proposalFingerprint: "fingerprint-1",
  version: "v1",
};

const SCOPE: ApprovalScope = {
  approval: {
    approvalId: "approval-1",
    proposal: PROPOSAL,
  },
  proposal: PROPOSAL,
};

function decision(
  eventType: ApprovalEventType,
  authority: ApprovalAuthority = OWNER,
  proposal: ProposalIdentity = PROPOSAL,
): ApprovalDecision {
  return {
    eventType,
    authority,
    proposal,
  };
}

function assertTransition(
  status: ApprovalStatus,
  eventType: ApprovalEventType,
  to: ApprovalStatus,
): void {
  const result = validateTransition({
    status,
    decision: decision(eventType),
    scope: SCOPE,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.from, status);
    assert.equal(result.value.eventType, eventType);
    assert.equal(result.value.to, to);
  }
}

function assertIllegal(
  status: ApprovalStatus,
  eventType: ApprovalEventType,
): void {
  const result = validateTransition({
    status,
    decision: decision(eventType),
    scope: SCOPE,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(
      result.errors.some((item) => item.code === "illegal_transition"),
      true,
    );
  }
}

await test("classifies every lifecycle state as active or terminal", () => {
  assert.deepEqual(APPROVAL_STATUSES, [
    "not_requested",
    "requested",
    "approved",
    "rejected",
    "revoked",
    "expired",
    "superseded",
  ]);

  assert.equal(isApprovalActive("not_requested"), false);
  assert.equal(isApprovalActive("requested"), true);
  assert.equal(isApprovalActive("approved"), true);
  assert.equal(isApprovalActive("rejected"), false);
  assert.equal(isApprovalActive("revoked"), false);
  assert.equal(isApprovalActive("expired"), false);
  assert.equal(isApprovalActive("superseded"), false);

  assert.equal(isApprovalTerminal("not_requested"), false);
  assert.equal(isApprovalTerminal("requested"), false);
  assert.equal(isApprovalTerminal("approved"), false);
  assert.equal(isApprovalTerminal("rejected"), true);
  assert.equal(isApprovalTerminal("revoked"), true);
  assert.equal(isApprovalTerminal("expired"), true);
  assert.equal(isApprovalTerminal("superseded"), true);
});

await test("lists next legal states for every lifecycle state", () => {
  assert.deepEqual(getNextLegalStates("not_requested"), ["requested"]);
  assert.deepEqual(getNextLegalStates("requested"), [
    "approved",
    "rejected",
    "expired",
    "superseded",
  ]);
  assert.deepEqual(getNextLegalStates("approved"), [
    "revoked",
    "expired",
    "superseded",
  ]);
  assert.deepEqual(getNextLegalStates("rejected"), []);
  assert.deepEqual(getNextLegalStates("revoked"), []);
  assert.deepEqual(getNextLegalStates("expired"), []);
  assert.deepEqual(getNextLegalStates("superseded"), []);
});

await test("implements every legal transition", () => {
  for (const transition of APPROVAL_TRANSITIONS) {
    assertTransition(transition.from, transition.eventType, transition.to);
  }
});

await test("rejects representative illegal transitions", () => {
  assertIllegal("not_requested", "approval_approved");
  assertIllegal("not_requested", "approval_rejected");
  assertIllegal("requested", "approval_requested");
  assertIllegal("approved", "approval_approved");
  assertIllegal("approved", "approval_rejected");
  assertIllegal("rejected", "approval_approved");
  assertIllegal("revoked", "approval_approved");
  assertIllegal("expired", "approval_approved");
  assertIllegal("superseded", "approval_approved");
});

await test("requires readiness before approval can be requested", () => {
  assert.equal(canRequestApproval({ readinessState: "blocked" }), false);
  assert.equal(
    canRequestApproval({ readinessState: "ready_for_approval" }),
    true,
  );
  assert.equal(
    canRequestApproval({
      readinessState: "ready_for_approval",
      activeApprovalCount: 1,
    }),
    false,
  );
});

await test("accepts owner authority and rejects admin ai and system approval authority", () => {
  assert.equal(canApprove("requested", OWNER), true);
  assert.equal(canReject("requested", OWNER), true);
  assert.equal(canRevoke("approved", OWNER), true);

  for (const authority of [ADMIN, AI, SYSTEM]) {
    assert.equal(canApprove("requested", authority), false);
    assert.equal(canReject("requested", authority), false);
    assert.equal(canRevoke("approved", authority), false);
  }
});

await test("rejects AI approval decisions with explicit invariant errors", () => {
  const result = validateTransition({
    status: "requested",
    decision: decision("approval_approved", AI),
    scope: SCOPE,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(
      result.errors.map((item) => item.code),
      ["ai_cannot_approve", "approval_authority_required"],
    );
  }
});

await test("rejects non-owner human approval decisions", () => {
  const result = validateTransition({
    status: "requested",
    decision: decision("approval_approved", ADMIN),
    scope: SCOPE,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(
      result.errors.map((item) => item.code),
      ["approval_authority_required"],
    );
  }
});

await test("allows expiration and supersession only from non-terminal states", () => {
  assert.equal(canExpire("requested"), true);
  assert.equal(canExpire("approved"), true);
  assert.equal(canExpire("rejected"), false);
  assert.equal(canExpire("revoked"), false);

  assert.equal(canSupersede("requested"), true);
  assert.equal(canSupersede("approved"), true);
  assert.equal(canSupersede("rejected"), false);
  assert.equal(canSupersede("revoked"), false);
  assert.equal(canSupersede("expired"), false);
});

await test("detects proposal identity changes", () => {
  assert.equal(isProposalChanged(PROPOSAL, PROPOSAL), false);
  assert.equal(isProposalChanged(PROPOSAL, CHANGED_PROPOSAL), true);
  assert.equal(isProposalChanged(PROPOSAL, OTHER_POST_PROPOSAL), true);
});

await test("computes approval validity from status and proposal identity", () => {
  assert.equal(
    isApprovalValid({
      status: "approved",
      approvedProposal: PROPOSAL,
      currentProposal: PROPOSAL,
    }),
    true,
  );

  const changed = evaluateApprovalValidity({
    status: "approved",
    approvedProposal: PROPOSAL,
    currentProposal: CHANGED_PROPOSAL,
  });

  assert.equal(changed.valid, false);
  assert.equal(changed.proposalChanged, true);
  assert.deepEqual(
    changed.reasons.map((item) => item.code),
    ["proposal_changed"],
  );
});

await test("invalidates every non-approved status", () => {
  for (const status of APPROVAL_STATUSES.filter((item) => item !== "approved")) {
    const validity = evaluateApprovalValidity({
      status,
      approvedProposal: PROPOSAL,
      currentProposal: PROPOSAL,
    });

    assert.equal(validity.valid, false);
    assert.equal(
      validity.reasons.some((item) => item.code === "approval_not_active"),
      true,
    );
  }
});

await test("preserves append-only semantics by returning transition values without mutating inputs", () => {
  const scopedProposalBefore = JSON.stringify(SCOPE);
  const decisionInput = decision("approval_approved");
  const decisionBefore = JSON.stringify(decisionInput);

  const result = validateTransition({
    status: "requested",
    decision: decisionInput,
    scope: SCOPE,
  });

  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(SCOPE), scopedProposalBefore);
  assert.equal(JSON.stringify(decisionInput), decisionBefore);
});

await test("rejects transition decisions scoped to another proposal", () => {
  const result = validateTransition({
    status: "requested",
    decision: decision("approval_approved", OWNER, CHANGED_PROPOSAL),
    scope: SCOPE,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(
      result.errors.some((item) => item.code === "proposal_scope_mismatch"),
      true,
    );
  }
});

await test("rejects internally inconsistent approval scopes", () => {
  const result = validateTransition({
    status: "requested",
    decision: decision("approval_approved", OWNER, PROPOSAL),
    scope: {
      approval: {
        approvalId: "approval-1",
        proposal: CHANGED_PROPOSAL,
      },
      proposal: PROPOSAL,
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(
      result.errors.some((item) => item.code === "proposal_scope_mismatch"),
      true,
    );
  }
});

await test("detects multiple active approvals as invalid", () => {
  const validity = evaluateApprovalValidity({
    status: "approved",
    approvedProposal: PROPOSAL,
    currentProposal: PROPOSAL,
    activeApprovalCount: 2,
  });

  assert.equal(validity.valid, false);
  assert.deepEqual(
    validity.reasons.map((item) => item.code),
    ["multiple_active_approvals"],
  );
});

await test("is deterministic for repeated validity and transition evaluations", () => {
  const firstValidity = evaluateApprovalValidity({
    status: "approved",
    approvedProposal: PROPOSAL,
    currentProposal: PROPOSAL,
  });
  const secondValidity = evaluateApprovalValidity({
    status: "approved",
    approvedProposal: PROPOSAL,
    currentProposal: PROPOSAL,
  });

  assert.deepEqual(firstValidity, secondValidity);

  const firstTransition = validateTransition({
    status: "requested",
    decision: decision("approval_approved"),
    scope: SCOPE,
  });
  const secondTransition = validateTransition({
    status: "requested",
    decision: decision("approval_approved"),
    scope: SCOPE,
  });

  assert.deepEqual(firstTransition, secondTransition);
});
