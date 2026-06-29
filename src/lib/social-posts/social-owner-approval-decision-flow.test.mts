import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createOwnerApprovalAuthoritySnapshot,
  type OwnerApprovalActor,
} from "./social-owner-approval-authorization";
import {
  decideOwnerApproval,
  type OwnerApprovalDecisionFlowDependencies,
  type OwnerApprovalDecisionInput,
} from "./social-owner-approval-decision-flow";
import * as decisionFlowExports from "./social-owner-approval-decision-flow";
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

const NOW = "2026-06-29T16:00:00.000Z";

function actor(input: Partial<OwnerApprovalActor> = {}): OwnerApprovalActor {
  return {
    actorId: "owner-1",
    actorType: "human",
    authoritySnapshot: createOwnerApprovalAuthoritySnapshot({
      actorId: "owner-1",
      actorType: "human",
      authorityRole: "owner",
      canApprove: true,
      authoritySource: "admin_session",
    }),
    authorityScope: {
      socialPostId: "post-1" as SocialOwnerApprovalSocialPostId,
      campaignId: "campaign-1",
      manifestId: null,
    },
    displayName: "Owner",
    ...input,
  };
}

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
    createdByActor: createOwnerApprovalAuthoritySnapshot({
      actorId: "owner-1",
      actorType: "human",
      authorityRole: "owner",
      canApprove: true,
      authoritySource: "admin_session",
    }),
    createdAt: NOW,
    requestMetadata: {
      source: "owner_approval_request",
      notes: null,
      context: {},
    },
    ...input,
  };
}

function decision(
  input: Partial<OwnerApprovalDecisionInput> = {},
): OwnerApprovalDecisionInput {
  return {
    proposalId: "proposal-1" as SocialOwnerApprovalProposalId,
    approvalId: "approval-1" as SocialOwnerApprovalApprovalId,
    decisionEventId: "event-2" as SocialOwnerApprovalEventId,
    decisionKind: "approve",
    actor: actor(),
    occurredAt: NOW,
    eventSequence: 2,
    reason: "Looks good.",
    context: {
      source: "test",
    },
    ...input,
  };
}

function dependencies(input?: {
  proposal?: SocialOwnerApprovalProposalRecord | null;
  appendFailure?: boolean;
  calls?: string[];
  appended?: SocialOwnerApprovalEventRecord[];
}): OwnerApprovalDecisionFlowDependencies {
  const storedProposal = input?.proposal === undefined ? proposal() : input.proposal;

  return {
    async getProposal() {
      input?.calls?.push("getProposal");
      if (!storedProposal) {
        return {
          ok: false,
          error: {
            code: "not_found",
            message: "proposal missing",
          },
        };
      }
      return { ok: true, value: storedProposal };
    },
    async appendEvent(appendInput) {
      input?.calls?.push("appendEvent");
      if (input?.appendFailure) {
        return {
          ok: false,
          error: {
            code: "storage_error",
            message: "append failed",
          },
        };
      }
      input?.appended?.push(appendInput.event);
      return { ok: true, value: appendInput.event };
    },
  };
}

await test("approve decision appends approval_approved event", async () => {
  const appended: SocialOwnerApprovalEventRecord[] = [];
  const result = await decideOwnerApproval({
    decision: decision({ decisionKind: "approve" }),
    dependencies: dependencies({ appended }),
  });

  assert.equal(result.ok, true);
  assert.equal(appended[0]?.eventType, "approval_approved");
});

await test("reject decision appends approval_rejected event", async () => {
  const appended: SocialOwnerApprovalEventRecord[] = [];
  const result = await decideOwnerApproval({
    decision: decision({
      decisionKind: "reject",
      decisionEventId: "event-3" as SocialOwnerApprovalEventId,
    }),
    dependencies: dependencies({ appended }),
  });

  assert.equal(result.ok, true);
  assert.equal(appended[0]?.eventType, "approval_rejected");
});

await test("revoke decision appends approval_revoked event", async () => {
  const appended: SocialOwnerApprovalEventRecord[] = [];
  const result = await decideOwnerApproval({
    decision: decision({
      decisionKind: "revoke",
      decisionEventId: "event-4" as SocialOwnerApprovalEventId,
    }),
    dependencies: dependencies({ appended }),
  });

  assert.equal(result.ok, true);
  assert.equal(appended[0]?.eventType, "approval_revoked");
});

await test("unauthorized actor is denied before event append", async () => {
  const calls: string[] = [];
  const result = await decideOwnerApproval({
    decision: decision({
      actor: actor({
        authorityScope: {
          socialPostId: "post-2" as SocialOwnerApprovalSocialPostId,
          campaignId: "campaign-1",
          manifestId: null,
        },
      }),
    }),
    dependencies: dependencies({ calls }),
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "authorization_denied");
  assert.deepEqual(calls, ["getProposal"]);
});

await test("missing proposal context returns explicit error", async () => {
  const result = await decideOwnerApproval({
    decision: decision(),
    dependencies: dependencies({ proposal: null }),
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "proposal_context_missing");
});

await test("repository append failure returns explicit error", async () => {
  const result = await decideOwnerApproval({
    decision: decision(),
    dependencies: dependencies({ appendFailure: true }),
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "event_append_failed");
});

await test("identity separation is preserved", async () => {
  const appended: SocialOwnerApprovalEventRecord[] = [];
  await decideOwnerApproval({
    decision: decision(),
    dependencies: dependencies({ appended }),
  });

  assert.equal(appended[0]?.proposalId, "proposal-1");
  assert.equal(appended[0]?.approvalId, "approval-1");
  assert.equal(appended[0]?.eventId, "event-2");
  assert.notEqual(appended[0]?.eventId, appended[0]?.proposalId);
  assert.notEqual(appended[0]?.eventId, appended[0]?.approvalId);
});

await test("event sequence is explicit and not computed from replay", async () => {
  const appended: SocialOwnerApprovalEventRecord[] = [];
  await decideOwnerApproval({
    decision: decision({ eventSequence: 7 }),
    dependencies: dependencies({ appended }),
  });

  assert.equal(appended[0]?.eventSequence, 7);
});

await test("decision flow exports no current, replay, validity, or request helpers", () => {
  const forbidden = [
    "computeCurrentApproval",
    "getCurrentApproval",
    "replayApprovalLifecycle",
    "evaluateApprovalValidity",
    "isApprovalValid",
    "prepareOwnerApprovalRequestProposal",
    "requestOwnerApproval",
  ];

  for (const name of forbidden) {
    assert.equal(name in decisionFlowExports, false);
  }
});

await test("decision flow module has no Supabase, API, route, or UI imports", () => {
  const source = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "social-owner-approval-decision-flow.ts",
    ),
    "utf8",
  );

  assert.equal(source.includes("supabase"), false);
  assert.equal(source.includes("/api/"), false);
  assert.equal(source.includes("next/"), false);
  assert.equal(source.includes(".tsx"), false);
});
