import assert from "node:assert/strict";

import {
  appendOwnerApprovalEvent,
  configureOwnerApprovalStoreTestDependencies,
  createOwnerApprovalProposal,
  getOwnerApprovalProposalByApprovalId,
  getOwnerApprovalProposalById,
  listOwnerApprovalEventsByApprovalId,
  listOwnerApprovalEventsByProposalId,
  type SocialOwnerApprovalRepositoryResult,
} from "./social-owner-approval-store";
import * as storeExports from "./social-owner-approval-store";
import type {
  SocialOwnerApprovalApprovalId,
  SocialOwnerApprovalEventRecord,
  SocialOwnerApprovalProposalId,
  SocialOwnerApprovalProposalRecord,
} from "./social-owner-approval-persistence";

type TestFn = () => void | Promise<void>;

type ProposalRow = {
  proposal_id: string;
  approval_id: string;
  social_post_id: string;
  proposal_fingerprint: string;
  proposal_version: string;
  proposal_scope: Record<string, unknown>;
  snapshot: Record<string, unknown>;
  requested_readiness_summary: Record<string, unknown>;
  created_by_actor: Record<string, unknown>;
  created_at: string;
  request_metadata: Record<string, unknown> | null;
};

type EventRow = {
  event_id: string;
  approval_id: string;
  proposal_id: string;
  proposal_fingerprint: string;
  event_type: string;
  actor_snapshot: Record<string, unknown>;
  event_reason: string | null;
  occurred_at: string;
  event_sequence: number;
  event_metadata: Record<string, unknown> | null;
};

async function test(name: string, fn: TestFn): Promise<void> {
  configureOwnerApprovalStoreTestDependencies(null);
  try {
    await fn();
    console.log(`ok - ${name}`);
  } finally {
    configureOwnerApprovalStoreTestDependencies(null);
  }
}

const NOW = "2026-06-29T12:00:00.000Z";

function proposal(
  input: Partial<SocialOwnerApprovalProposalRecord> = {},
): SocialOwnerApprovalProposalRecord {
  return {
    proposalId: "proposal-1" as SocialOwnerApprovalProposalId,
    approvalId: "approval-1" as SocialOwnerApprovalApprovalId,
    socialPostId:
      "post-1" as SocialOwnerApprovalProposalRecord["socialPostId"],
    proposalFingerprint:
      "fingerprint-1" as SocialOwnerApprovalProposalRecord["proposalFingerprint"],
    proposalVersion:
      "v1" as SocialOwnerApprovalProposalRecord["proposalVersion"],
    proposalScope: {
      socialPostId:
        "post-1" as SocialOwnerApprovalProposalRecord["socialPostId"],
      proposalFingerprint:
        "fingerprint-1" as SocialOwnerApprovalProposalRecord["proposalFingerprint"],
      proposalVersion:
        "v1" as SocialOwnerApprovalProposalRecord["proposalVersion"],
      campaignId: "summer-water-slides",
      platforms: ["facebook", "instagram"],
    },
    snapshot: {
      socialPostId:
        "post-1" as SocialOwnerApprovalProposalRecord["socialPostId"],
      proposalFingerprint:
        "fingerprint-1" as SocialOwnerApprovalProposalRecord["proposalFingerprint"],
      proposalVersion:
        "v1" as SocialOwnerApprovalProposalRecord["proposalVersion"],
      title: "Weekend Water Slide",
      caption: "Cool off this weekend.",
      mediaType: "image",
      platforms: ["facebook", "instagram"],
      campaignId: "summer-water-slides",
      businessFocus: "rentals",
      socialPostStatusAtRequest: "draft",
      mediaReference: {
        assetId: "asset-1",
        assetFamilyId: "family-1",
        assetType: "image",
        assetStage: "approved",
        url: "https://example.test/asset.png",
        storagePath: null,
      },
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

function event(
  input: Partial<SocialOwnerApprovalEventRecord> = {},
): SocialOwnerApprovalEventRecord {
  return {
    eventId: "event-1" as SocialOwnerApprovalEventRecord["eventId"],
    approvalId: "approval-1" as SocialOwnerApprovalApprovalId,
    proposalId: "proposal-1" as SocialOwnerApprovalProposalId,
    proposalFingerprint:
      "fingerprint-1" as SocialOwnerApprovalEventRecord["proposalFingerprint"],
    eventType: "approval_requested",
    actorSnapshot: {
      actorId: "owner-1",
      actorType: "human",
      authorityRole: "owner",
      canApprove: true,
      authoritySource: "admin_session",
    },
    eventReason: null,
    occurredAt: NOW,
    eventSequence: 1,
    eventMetadata: {
      source: "owner_approval_lifecycle",
      context: {},
    },
    ...input,
  };
}

function memoryStorage(input?: {
  proposals?: ProposalRow[];
  events?: EventRow[];
  fail?: boolean;
}) {
  const proposals = [...(input?.proposals ?? [])];
  const events = [...(input?.events ?? [])];
  const calls = {
    insertProposal: 0,
    insertEvent: 0,
  };

  return {
    calls,
    storage: {
      async insertProposal(row: ProposalRow): Promise<ProposalRow> {
        calls.insertProposal += 1;
        if (input?.fail) throw new Error("storage failed");
        proposals.push(row);
        return row;
      },
      async insertEvent(row: EventRow): Promise<EventRow> {
        calls.insertEvent += 1;
        if (input?.fail) throw new Error("storage failed");
        events.push(row);
        return row;
      },
      async getProposalById(
        proposalId: SocialOwnerApprovalProposalId,
      ): Promise<ProposalRow | null> {
        return proposals.find((item) => item.proposal_id === proposalId) ?? null;
      },
      async getProposalByApprovalId(
        approvalId: SocialOwnerApprovalApprovalId,
      ): Promise<ProposalRow | null> {
        return proposals.find((item) => item.approval_id === approvalId) ?? null;
      },
      async listEventsByProposalId(
        proposalId: SocialOwnerApprovalProposalId,
      ): Promise<EventRow[]> {
        return events
          .filter((item) => item.proposal_id === proposalId)
          .sort((a, b) => a.event_sequence - b.event_sequence);
      },
      async listEventsByApprovalId(
        approvalId: SocialOwnerApprovalApprovalId,
      ): Promise<EventRow[]> {
        return events
          .filter((item) => item.approval_id === approvalId)
          .sort((a, b) => a.event_sequence - b.event_sequence);
      },
    },
  };
}

function rowFromProposal(record: SocialOwnerApprovalProposalRecord): ProposalRow {
  return {
    proposal_id: record.proposalId,
    approval_id: record.approvalId,
    social_post_id: record.socialPostId,
    proposal_fingerprint: record.proposalFingerprint,
    proposal_version: record.proposalVersion,
    proposal_scope: record.proposalScope as Record<string, unknown>,
    snapshot: record.snapshot as Record<string, unknown>,
    requested_readiness_summary:
      record.requestedReadinessSummary as Record<string, unknown>,
    created_by_actor: record.createdByActor as Record<string, unknown>,
    created_at: record.createdAt,
    request_metadata: record.requestMetadata as Record<string, unknown> | null,
  };
}

function rowFromEvent(record: SocialOwnerApprovalEventRecord): EventRow {
  return {
    event_id: record.eventId,
    approval_id: record.approvalId,
    proposal_id: record.proposalId,
    proposal_fingerprint: record.proposalFingerprint,
    event_type: record.eventType,
    actor_snapshot: record.actorSnapshot as Record<string, unknown>,
    event_reason: record.eventReason,
    occurred_at: record.occurredAt,
    event_sequence: record.eventSequence,
    event_metadata: record.eventMetadata as Record<string, unknown> | null,
  };
}

function assertOk<T>(result: SocialOwnerApprovalRepositoryResult<T>): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Expected ok result.");
  return result.value;
}

await test("validates proposals before write", async () => {
  const { storage, calls } = memoryStorage();
  configureOwnerApprovalStoreTestDependencies(storage);

  const result = await createOwnerApprovalProposal(
    proposal({
      proposalFingerprint: "" as SocialOwnerApprovalProposalRecord["proposalFingerprint"],
    }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "validation_failed");
  assert.equal(calls.insertProposal, 0);
});

await test("creates proposals and preserves identity mapping", async () => {
  const { storage, calls } = memoryStorage();
  configureOwnerApprovalStoreTestDependencies(storage);

  const created = assertOk(await createOwnerApprovalProposal(proposal()));

  assert.equal(created.proposalId, "proposal-1");
  assert.equal(created.approvalId, "approval-1");
  assert.notEqual(created.proposalId, created.approvalId);
  assert.equal(calls.insertProposal, 1);
});

await test("reads proposals by proposal id and approval id", async () => {
  const stored = rowFromProposal(proposal());
  const { storage } = memoryStorage({ proposals: [stored] });
  configureOwnerApprovalStoreTestDependencies(storage);

  const byProposal = assertOk(
    await getOwnerApprovalProposalById(
      "proposal-1" as SocialOwnerApprovalProposalId,
    ),
  );
  const byApproval = assertOk(
    await getOwnerApprovalProposalByApprovalId(
      "approval-1" as SocialOwnerApprovalApprovalId,
    ),
  );

  assert.equal(byProposal.proposalId, "proposal-1");
  assert.equal(byApproval.approvalId, "approval-1");
});

await test("returns explicit not-found errors for missing proposals", async () => {
  const { storage } = memoryStorage();
  configureOwnerApprovalStoreTestDependencies(storage);

  const result = await getOwnerApprovalProposalById(
    "missing" as SocialOwnerApprovalProposalId,
  );

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "not_found");
});

await test("validates events before write", async () => {
  const { storage, calls } = memoryStorage();
  configureOwnerApprovalStoreTestDependencies(storage);

  const result = await appendOwnerApprovalEvent({
    proposal: proposal(),
    event: event({
      proposalId: "proposal-2" as SocialOwnerApprovalProposalId,
    }),
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "validation_failed");
  assert.equal(calls.insertEvent, 0);
});

await test("appends events and preserves identity mapping", async () => {
  const { storage, calls } = memoryStorage();
  configureOwnerApprovalStoreTestDependencies(storage);

  const appended = assertOk(
    await appendOwnerApprovalEvent({
      proposal: proposal(),
      event: event(),
    }),
  );

  assert.equal(appended.eventId, "event-1");
  assert.equal(appended.proposalId, "proposal-1");
  assert.equal(appended.approvalId, "approval-1");
  assert.notEqual(appended.eventId, appended.proposalId);
  assert.notEqual(appended.eventId, appended.approvalId);
  assert.equal(calls.insertEvent, 1);
});

await test("lists events by proposal id and approval id in deterministic order", async () => {
  const eventOne = event({ eventId: "event-1" as never, eventSequence: 1 });
  const eventTwo = event({ eventId: "event-2" as never, eventSequence: 2 });
  const { storage } = memoryStorage({
    events: [rowFromEvent(eventTwo), rowFromEvent(eventOne)],
  });
  configureOwnerApprovalStoreTestDependencies(storage);

  const byProposal = assertOk(
    await listOwnerApprovalEventsByProposalId(
      "proposal-1" as SocialOwnerApprovalProposalId,
    ),
  );
  const byApproval = assertOk(
    await listOwnerApprovalEventsByApprovalId(
      "approval-1" as SocialOwnerApprovalApprovalId,
    ),
  );

  assert.deepEqual(
    byProposal.map((item) => item.eventSequence),
    [1, 2],
  );
  assert.deepEqual(
    byApproval.map((item) => item.eventId),
    ["event-1", "event-2"],
  );
});

await test("surfaces explicit storage errors", async () => {
  const { storage } = memoryStorage({ fail: true });
  configureOwnerApprovalStoreTestDependencies(storage);

  const result = await createOwnerApprovalProposal(proposal());

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "storage_error");
});

await test("repository exports no replay or current-state helpers", () => {
  const forbidden = [
    "replayApprovalLifecycle",
    "getCurrentApproval",
    "computeCurrentApproval",
    "evaluateApprovalValidity",
    "isApprovalValid",
    "getActiveApproval",
  ];

  for (const name of forbidden) {
    assert.equal(name in storeExports, false);
  }
});
