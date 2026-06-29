import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { OwnerApprovalStateServiceDependencies } from "./social-owner-approval-state-service";
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

const originalRequire = Module.prototype.require;
Module.prototype.require = function patchedRequire(
  this: NodeModule,
  id: string,
) {
  if (id === "server-only") {
    return {};
  }
  return originalRequire.apply(this, [id]);
};

const {
  getOwnerApprovalCurrentState,
  getOwnerApprovalCurrentStateByApprovalId,
  getOwnerApprovalCurrentStateByProposalId,
  OWNER_APPROVAL_STATE_SERVICE_ERROR_CODES,
} = await import("./social-owner-approval-state-service");
const stateServiceExports = await import("./social-owner-approval-state-service");

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

const NOW = "2026-06-29T17:00:00.000Z";
const REQUESTED_AT = "2026-06-29T17:01:00.000Z";
const DECIDED_AT = "2026-06-29T17:02:00.000Z";

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

function approvedEvents(): SocialOwnerApprovalEventRecord[] {
  return [
    event({ eventType: "approval_requested", eventSequence: 1 }),
    event({
      eventId: "event-2" as SocialOwnerApprovalEventId,
      eventType: "approval_approved",
      eventSequence: 2,
      occurredAt: DECIDED_AT,
    }),
  ];
}

function dependencies(input?: {
  proposal?: SocialOwnerApprovalProposalRecord | null;
  events?: SocialOwnerApprovalEventRecord[];
  eventsReadFailure?: boolean;
  proposalReadFailureCode?: "not_found" | "storage_error";
  calls?: string[];
}): OwnerApprovalStateServiceDependencies {
  const storedProposal =
    input?.proposal === undefined ? proposal() : input.proposal;
  const storedEvents = input?.events ?? approvedEvents();

  return {
    async getProposalById() {
      input?.calls?.push("getProposalById");
      if (!storedProposal) {
        return {
          ok: false,
          error: {
            code: input?.proposalReadFailureCode ?? "not_found",
            message: "proposal missing",
          },
        };
      }
      return { ok: true, value: storedProposal };
    },
    async getProposalByApprovalId() {
      input?.calls?.push("getProposalByApprovalId");
      if (!storedProposal) {
        return {
          ok: false,
          error: {
            code: input?.proposalReadFailureCode ?? "not_found",
            message: "proposal missing",
          },
        };
      }
      return { ok: true, value: storedProposal };
    },
    async listEventsByProposalId() {
      input?.calls?.push("listEventsByProposalId");
      if (input?.eventsReadFailure) {
        return {
          ok: false,
          error: {
            code: "storage_error",
            message: "events read failed",
          },
        };
      }
      return { ok: true, value: storedEvents };
    },
    async listEventsByApprovalId() {
      input?.calls?.push("listEventsByApprovalId");
      if (input?.eventsReadFailure) {
        return {
          ok: false,
          error: {
            code: "storage_error",
            message: "events read failed",
          },
        };
      }
      return { ok: true, value: storedEvents };
    },
  };
}

await test("getOwnerApprovalCurrentState delegates to M7 for approved state", () => {
  const result = getOwnerApprovalCurrentState({
    proposal: proposal(),
    events: approvedEvents(),
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.lifecycleStatus, "approved");
    assert.equal(result.value.decisionStatus, "approved");
    assert.equal(result.value.decidedAt, DECIDED_AT);
    assert.equal(result.value.computedOnly, true);
  }
});

await test("getOwnerApprovalCurrentStateByProposalId loads via deps and returns computed state", async () => {
  const calls: string[] = [];
  const result = await getOwnerApprovalCurrentStateByProposalId({
    proposalId: "proposal-1" as SocialOwnerApprovalProposalId,
    dependencies: dependencies({ calls }),
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.lifecycleStatus, "approved");
    assert.equal(result.value.proposalId, "proposal-1");
  }
  assert.deepEqual(calls, ["getProposalById", "listEventsByProposalId"]);
});

await test("getOwnerApprovalCurrentStateByApprovalId loads via deps and returns computed state", async () => {
  const calls: string[] = [];
  const result = await getOwnerApprovalCurrentStateByApprovalId({
    approvalId: "approval-1" as SocialOwnerApprovalApprovalId,
    dependencies: dependencies({ calls }),
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.lifecycleStatus, "approved");
    assert.equal(result.value.approvalId, "approval-1");
  }
  assert.deepEqual(calls, ["getProposalByApprovalId", "listEventsByApprovalId"]);
});

await test("proposal_not_found when getProposal returns not_found", async () => {
  const result = await getOwnerApprovalCurrentStateByProposalId({
    proposalId: "proposal-missing" as SocialOwnerApprovalProposalId,
    dependencies: dependencies({ proposal: null }),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "proposal_not_found");
    assert.equal(result.error.repositoryError?.code, "not_found");
  }
});

await test("events_read_failed when listEvents fails", async () => {
  const result = await getOwnerApprovalCurrentStateByProposalId({
    proposalId: "proposal-1" as SocialOwnerApprovalProposalId,
    dependencies: dependencies({ eventsReadFailure: true }),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "events_read_failed");
    assert.equal(result.error.repositoryError?.code, "storage_error");
  }
});

await test("compute_failed when M7 returns error for invalid history", () => {
  const result = getOwnerApprovalCurrentState({
    proposal: proposal(),
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
    assert.equal(result.error.code, "compute_failed");
    assert.equal(result.error.computeError?.code, "invalid_history");
    assert.equal(
      result.error.computeError?.reasonCode,
      "invalid_history:duplicate_event_sequence",
    );
  }
});

await test("state service exports no authorization or flow execution", () => {
  const forbidden = [
    "evaluateOwnerApprovalAuthorization",
    "requestOwnerApproval",
    "decideOwnerApproval",
    "createOwnerApprovalProposal",
    "appendOwnerApprovalEvent",
    "prepareOwnerApprovalRequestProposal",
    "computeOwnerApprovalCurrentState",
  ];

  for (const name of forbidden) {
    assert.equal(name in stateServiceExports, false);
  }
});

await test("state service module has no Supabase, API, route, or flow imports", () => {
  const source = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "social-owner-approval-state-service.ts",
    ),
    "utf8",
  );

  assert.equal(source.includes("../supabase"), false);
  assert.equal(source.includes("/api/"), false);
  assert.equal(source.includes("next/"), false);
  assert.equal(source.includes(".tsx"), false);
  assert.equal(source.includes("social-owner-approval-authorization"), false);
  assert.equal(source.includes("social-owner-approval-request-flow"), false);
  assert.equal(source.includes("social-owner-approval-decision-flow"), false);
});

await test("computed state is not stored on input records", () => {
  const proposalRecord = proposal();
  const events = approvedEvents();

  getOwnerApprovalCurrentState({
    proposal: proposalRecord,
    events,
  });

  assert.equal("lifecycleStatus" in proposalRecord, false);
  assert.equal("computedOnly" in proposalRecord, false);
  assert.equal("currentState" in proposalRecord, false);
  assert.equal(
    "approvalStatus" in (events[0] as Record<string, unknown>),
    false,
  );
});

await test("error codes include required integration vocabulary", () => {
  assert.deepEqual(OWNER_APPROVAL_STATE_SERVICE_ERROR_CODES, [
    "proposal_not_found",
    "events_read_failed",
    "compute_failed",
    "repository_error",
  ]);
});
