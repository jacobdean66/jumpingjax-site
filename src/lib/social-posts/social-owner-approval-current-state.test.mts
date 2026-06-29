import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  computeOwnerApprovalCurrentState,
  type OwnerApprovalCurrentStateInput,
} from "./social-owner-approval-current-state";
import * as currentStateExports from "./social-owner-approval-current-state";
import type {
  SocialOwnerApprovalApprovalId,
  SocialOwnerApprovalEventId,
  SocialOwnerApprovalEventRecord,
  SocialOwnerApprovalProposalFingerprint,
  SocialOwnerApprovalProposalId,
  SocialOwnerApprovalProposalRecord,
  SocialOwnerApprovalProposalVersion,
  SocialOwnerApprovalSocialPostId,
} from "./social-owner-approval-persistence";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

const NOW = "2026-06-29T17:00:00.000Z";
const REQUESTED_AT = "2026-06-29T17:01:00.000Z";
const DECIDED_AT = "2026-06-29T17:02:00.000Z";
const REVOKED_AT = "2026-06-29T17:03:00.000Z";

function proposal(
  input: Partial<SocialOwnerApprovalProposalRecord> = {},
): SocialOwnerApprovalProposalRecord {
  return {
    proposalId: "proposal-1" as SocialOwnerApprovalProposalId,
    approvalId: "approval-1" as SocialOwnerApprovalApprovalId,
    socialPostId: "post-1" as SocialOwnerApprovalSocialPostId,
    proposalFingerprint:
      "fingerprint-1" as SocialOwnerApprovalProposalFingerprint,
    proposalVersion: "v1" as SocialOwnerApprovalProposalVersion,
    proposalScope: {
      socialPostId: "post-1" as SocialOwnerApprovalSocialPostId,
      proposalFingerprint:
        "fingerprint-1" as SocialOwnerApprovalProposalFingerprint,
      proposalVersion: "v1" as SocialOwnerApprovalProposalVersion,
      campaignId: "campaign-1",
      platforms: ["facebook", "instagram"],
    },
    snapshot: {
      socialPostId: "post-1" as SocialOwnerApprovalSocialPostId,
      proposalFingerprint:
        "fingerprint-1" as SocialOwnerApprovalProposalFingerprint,
      proposalVersion: "v1" as SocialOwnerApprovalProposalVersion,
      title: "Weekend Water Slide",
      caption: "Cool off this weekend.",
      mediaType: "image",
      platforms: ["facebook", "instagram"],
      campaignId: "campaign-1",
      businessFocus: "rentals",
      socialPostStatusAtRequest: "draft",
      mediaReference: null,
      selectedAssetReferences: [],
      approvedAssetReferences: [],
      humanSummary: "Ready for owner review.",
    },
    requestedReadinessSummary: {
      state: "ready_for_approval",
      blockerCount: 0,
      warningCodes: [],
      computedOnly: true,
      authoritative: false,
    },
    createdByActor: {
      actorId: "owner-1",
      actorType: "human",
      authorityRole: "owner",
      canApprove: true,
      authoritySource: "admin_session",
    },
    createdAt: NOW,
    requestMetadata: {
      source: "owner_approval_request",
      notes: null,
      context: {},
    },
    ...input,
  };
}

function actorSnapshot() {
  return {
    actorId: "owner-1",
    actorType: "human" as const,
    authorityRole: "owner" as const,
    canApprove: true,
    authoritySource: "admin_session",
  };
}

function event(
  input: Partial<SocialOwnerApprovalEventRecord> = {},
): SocialOwnerApprovalEventRecord {
  return {
    eventId: "event-1" as SocialOwnerApprovalEventId,
    approvalId: "approval-1" as SocialOwnerApprovalApprovalId,
    proposalId: "proposal-1" as SocialOwnerApprovalProposalId,
    proposalFingerprint:
      "fingerprint-1" as SocialOwnerApprovalProposalFingerprint,
    eventType: "approval_requested",
    actorSnapshot: actorSnapshot(),
    eventReason: null,
    occurredAt: REQUESTED_AT,
    eventSequence: 1,
    eventMetadata: {
      source: "owner_approval_lifecycle",
      context: {},
    },
    ...input,
  };
}

function compute(input: Partial<OwnerApprovalCurrentStateInput> = {}) {
  return computeOwnerApprovalCurrentState({
    proposal: proposal(),
    events: [],
    ...input,
  });
}

await test("zero events returns no_events lifecycle", () => {
  const result = compute();

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.lifecycleStatus, "no_events");
    assert.equal(result.value.decisionStatus, "none");
    assert.equal(result.value.latestEventId, null);
    assert.equal(result.value.latestEventSequence, null);
    assert.equal(result.value.requestedAt, null);
    assert.equal(result.value.reasonCode, "computed:no_events");
    assert.equal(result.value.computedOnly, true);
  }
});

await test("approval_requested event yields requested lifecycle", () => {
  const result = compute({
    events: [event({ eventType: "approval_requested", eventSequence: 1 })],
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.lifecycleStatus, "requested");
    assert.equal(result.value.decisionStatus, "none");
    assert.equal(result.value.requestedAt, REQUESTED_AT);
    assert.equal(result.value.latestEventId, "event-1");
    assert.equal(result.value.latestEventSequence, 1);
    assert.equal(result.value.latestDecisionEventId, null);
  }
});

await test("approval_approved event yields approved lifecycle", () => {
  const result = compute({
    events: [
      event({ eventType: "approval_requested", eventSequence: 1 }),
      event({
        eventId: "event-2" as SocialOwnerApprovalEventId,
        eventType: "approval_approved",
        eventSequence: 2,
        occurredAt: DECIDED_AT,
      }),
    ],
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.lifecycleStatus, "approved");
    assert.equal(result.value.decisionStatus, "approved");
    assert.equal(result.value.decidedAt, DECIDED_AT);
    assert.equal(result.value.latestDecisionEventId, "event-2");
    assert.equal(result.value.latestDecisionKind, "approve");
  }
});

await test("approval_rejected event yields rejected lifecycle", () => {
  const result = compute({
    events: [
      event({ eventType: "approval_requested", eventSequence: 1 }),
      event({
        eventId: "event-2" as SocialOwnerApprovalEventId,
        eventType: "approval_rejected",
        eventSequence: 2,
        occurredAt: DECIDED_AT,
      }),
    ],
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.lifecycleStatus, "rejected");
    assert.equal(result.value.decisionStatus, "rejected");
    assert.equal(result.value.latestDecisionKind, "reject");
  }
});

await test("approval_revoked event yields revoked lifecycle", () => {
  const result = compute({
    events: [
      event({ eventType: "approval_requested", eventSequence: 1 }),
      event({
        eventId: "event-2" as SocialOwnerApprovalEventId,
        eventType: "approval_approved",
        eventSequence: 2,
        occurredAt: DECIDED_AT,
      }),
      event({
        eventId: "event-3" as SocialOwnerApprovalEventId,
        eventType: "approval_revoked",
        eventSequence: 3,
        occurredAt: REVOKED_AT,
      }),
    ],
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.lifecycleStatus, "revoked");
    assert.equal(result.value.decisionStatus, "revoked");
    assert.equal(result.value.revokedAt, REVOKED_AT);
    assert.equal(result.value.latestDecisionEventId, "event-3");
    assert.equal(result.value.latestDecisionKind, "revoke");
  }
});

await test("events are sorted by event_sequence before replay", () => {
  const result = compute({
    events: [
      event({
        eventId: "event-3" as SocialOwnerApprovalEventId,
        eventType: "approval_revoked",
        eventSequence: 3,
        occurredAt: REVOKED_AT,
      }),
      event({ eventType: "approval_requested", eventSequence: 1 }),
      event({
        eventId: "event-2" as SocialOwnerApprovalEventId,
        eventType: "approval_approved",
        eventSequence: 2,
        occurredAt: DECIDED_AT,
      }),
    ],
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.lifecycleStatus, "revoked");
    assert.equal(result.value.latestEventSequence, 3);
    assert.equal(result.value.latestEventId, "event-3");
  }
});

await test("duplicate event_sequence returns invalid_history", () => {
  const result = compute({
    events: [
      event({ eventSequence: 1 }),
      event({
        eventId: "event-2" as SocialOwnerApprovalEventId,
        eventSequence: 1,
      }),
    ],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "invalid_history");
    assert.equal(
      result.error.reasonCode,
      "invalid_history:duplicate_event_sequence",
    );
  }
});

await test("proposal_id mismatch returns invalid_history", () => {
  const result = compute({
    events: [
      event({
        proposalId: "proposal-2" as SocialOwnerApprovalProposalId,
      }),
    ],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "invalid_history");
    assert.equal(
      result.error.reasonCode,
      "invalid_history:proposal_id_mismatch",
    );
  }
});

await test("approval_id mismatch returns invalid_history", () => {
  const result = compute({
    events: [
      event({
        approvalId: "approval-2" as SocialOwnerApprovalApprovalId,
      }),
    ],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "invalid_history");
    assert.equal(
      result.error.reasonCode,
      "invalid_history:approval_id_mismatch",
    );
  }
});

await test("unknown event type returns invalid_history", () => {
  const invalidEvent = {
    ...event(),
    eventType: "approval_published",
  } as unknown as SocialOwnerApprovalEventRecord;

  const result = compute({
    events: [invalidEvent],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "invalid_history");
    assert.equal(result.error.reasonCode, "invalid_history:unknown_event_type");
  }
});

await test("latest decision event is deterministic across replays", () => {
  const events = [
    event({ eventType: "approval_requested", eventSequence: 1 }),
    event({
      eventId: "event-2" as SocialOwnerApprovalEventId,
      eventType: "approval_approved",
      eventSequence: 2,
      occurredAt: DECIDED_AT,
    }),
    event({
      eventId: "event-3" as SocialOwnerApprovalEventId,
      eventType: "approval_revoked",
      eventSequence: 3,
      occurredAt: REVOKED_AT,
    }),
  ];

  const first = compute({ events });
  const second = compute({ events: [...events].reverse() });

  assert.deepEqual(first, second);
  if (first.ok) {
    assert.equal(first.value.latestDecisionEventId, "event-3");
    assert.equal(first.value.latestDecisionKind, "revoke");
  }
});

await test("computed state is not stored on input records", () => {
  const proposalRecord = proposal();
  const events = [
    event({ eventType: "approval_requested", eventSequence: 1 }),
  ];

  compute({ proposal: proposalRecord, events });

  assert.equal("lifecycleStatus" in proposalRecord, false);
  assert.equal("computedOnly" in proposalRecord, false);
  assert.equal("currentState" in proposalRecord, false);
  assert.equal(
    "approvalStatus" in (events[0] as Record<string, unknown>),
    false,
  );
});

await test("current state module exports no authorization or flow execution", () => {
  const forbidden = [
    "evaluateOwnerApprovalAuthorization",
    "requestOwnerApproval",
    "decideOwnerApproval",
    "createOwnerApprovalProposal",
    "appendOwnerApprovalEvent",
    "getOwnerApprovalProposalById",
    "validateTransition",
    "isApprovalValid",
  ];

  for (const name of forbidden) {
    assert.equal(name in currentStateExports, false);
  }
});

await test("current state module has no Supabase, API, route, or UI imports", () => {
  const source = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "social-owner-approval-current-state.ts",
    ),
    "utf8",
  );

  assert.equal(source.includes("supabase"), false);
  assert.equal(source.includes("/api/"), false);
  assert.equal(source.includes("next/"), false);
  assert.equal(source.includes(".tsx"), false);
  assert.equal(source.includes("social-owner-approval-store"), false);
  assert.equal(source.includes("social-owner-approval-authorization"), false);
  assert.equal(source.includes("social-owner-approval-request-flow"), false);
  assert.equal(source.includes("social-owner-approval-decision-flow"), false);
});

await test("replay is deterministic for repeated computation", () => {
  const input = {
    proposal: proposal(),
    events: [
      event({ eventType: "approval_requested", eventSequence: 1 }),
      event({
        eventId: "event-2" as SocialOwnerApprovalEventId,
        eventType: "approval_approved",
        eventSequence: 2,
        occurredAt: DECIDED_AT,
      }),
    ],
  };

  assert.deepEqual(
    computeOwnerApprovalCurrentState(input),
    computeOwnerApprovalCurrentState(input),
  );
});
