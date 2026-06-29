import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createOwnerApprovalAuthoritySnapshot,
  type OwnerApprovalActor,
} from "./social-owner-approval-authorization";
import {
  prepareOwnerApprovalRequestProposal,
  requestOwnerApproval,
  type OwnerApprovalRequestFlowDependencies,
  type OwnerApprovalRequestInput,
} from "./social-owner-approval-request-flow";
import * as requestFlowExports from "./social-owner-approval-request-flow";
import type {
  SocialOwnerApprovalApprovalId,
  SocialOwnerApprovalEventId,
  SocialOwnerApprovalEventRecord,
  SocialOwnerApprovalProposalFingerprint,
  SocialOwnerApprovalProposalId,
  SocialOwnerApprovalProposalVersion,
  SocialOwnerApprovalSocialPostId,
} from "./social-owner-approval-persistence";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

const NOW = "2026-06-29T15:00:00.000Z";

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
      manifestId: "manifest-1",
    },
    displayName: "Owner",
    ...input,
  };
}

function requestInput(
  input: Partial<OwnerApprovalRequestInput> = {},
): OwnerApprovalRequestInput {
  return {
    proposalId: "proposal-1" as SocialOwnerApprovalProposalId,
    approvalId: "approval-1" as SocialOwnerApprovalApprovalId,
    requestEventId: "event-1" as SocialOwnerApprovalEventId,
    socialPostId: "post-1" as SocialOwnerApprovalSocialPostId,
    proposalFingerprint:
      "fingerprint-1" as SocialOwnerApprovalProposalFingerprint,
    proposalVersion: "v1" as SocialOwnerApprovalProposalVersion,
    campaignId: "campaign-1",
    platforms: ["facebook", "instagram"],
    actor: actor(),
    createdAt: NOW,
    requestedAt: NOW,
    reviewedSnapshot: {
      title: "Weekend Water Slide",
      caption: "Cool off this weekend.",
      mediaType: "image",
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
      humanSummary: "Ready for owner approval.",
    },
    manifestReference: {
      id: "manifest-1",
      kind: "publication_manifest",
      fingerprint: "manifest-fingerprint-1",
    },
    eligibilityReference: {
      id: "eligibility-1",
      kind: "eligibility_summary",
      fingerprint: "eligibility-fingerprint-1",
    },
    warningCodes: [],
    notes: "Please review.",
    context: {
      source: "test",
    },
    ...input,
  };
}

function successfulDependencies(calls: string[]): OwnerApprovalRequestFlowDependencies {
  return {
    async createProposal(proposal) {
      calls.push("proposal");
      return { ok: true, value: proposal };
    },
    async appendEvent(input) {
      calls.push("event");
      return { ok: true, value: input.event };
    },
  };
}

await test("prepareOwnerApprovalRequestProposal creates separated proposal and approval ids", () => {
  const prepared = prepareOwnerApprovalRequestProposal(requestInput());

  assert.equal(prepared.proposal.proposalId, "proposal-1");
  assert.equal(prepared.proposal.approvalId, "approval-1");
  assert.notEqual(prepared.proposal.proposalId, prepared.proposal.approvalId);
  assert.notEqual(prepared.requestEvent.eventId, prepared.proposal.proposalId);
});

await test("prepare function captures actor authority snapshot", () => {
  const prepared = prepareOwnerApprovalRequestProposal(requestInput());

  assert.deepEqual(
    prepared.proposal.createdByActor,
    requestInput().actor.authoritySnapshot,
  );
  assert.deepEqual(prepared.requestEvent.actorSnapshot, prepared.proposal.createdByActor);
});

await test("prepare function references scoped manifest and eligibility without duplicating payloads", () => {
  const prepared = prepareOwnerApprovalRequestProposal(requestInput());
  const proposalJson = JSON.stringify(prepared.proposal);

  assert.equal(proposalJson.includes("manifestReference"), true);
  assert.equal(proposalJson.includes("eligibilityReference"), true);
  assert.equal(proposalJson.includes("publicationManifest"), false);
  assert.equal(proposalJson.includes("\"manifest\":"), false);
  assert.equal(proposalJson.includes("\"readiness\":"), false);
  assert.equal(proposalJson.includes("publicationReadiness"), false);
});

await test("requestOwnerApproval denies unauthorized actor before repository write", async () => {
  const calls: string[] = [];
  const result = await requestOwnerApproval({
    request: requestInput({
      actor: actor({
        authorityScope: {
          socialPostId: "post-2" as SocialOwnerApprovalSocialPostId,
          campaignId: "campaign-1",
          manifestId: "manifest-1",
        },
      }),
    }),
    dependencies: successfulDependencies(calls),
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "authorization_denied");
  assert.deepEqual(calls, []);
});

await test("requestOwnerApproval writes proposal before event", async () => {
  const calls: string[] = [];
  const result = await requestOwnerApproval({
    request: requestInput(),
    dependencies: successfulDependencies(calls),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["proposal", "event"]);
});

await test("requestOwnerApproval appends approval requested lifecycle event", async () => {
  let appended: SocialOwnerApprovalEventRecord | null = null;
  const result = await requestOwnerApproval({
    request: requestInput(),
    dependencies: {
      async createProposal(proposal) {
        return { ok: true, value: proposal };
      },
      async appendEvent(input) {
        appended = input.event;
        return { ok: true, value: input.event };
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(appended?.eventType, "approval_requested");
  assert.equal(appended?.eventSequence, 1);
});

await test("requestOwnerApproval returns explicit repository failure if proposal write fails", async () => {
  const result = await requestOwnerApproval({
    request: requestInput(),
    dependencies: {
      async createProposal() {
        return {
          ok: false,
          error: {
            code: "storage_error",
            message: "proposal storage failed",
          },
        };
      },
      async appendEvent() {
        throw new Error("append should not run");
      },
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "proposal_write_failed");
});

await test("requestOwnerApproval returns explicit repository failure if event append fails", async () => {
  const result = await requestOwnerApproval({
    request: requestInput(),
    dependencies: {
      async createProposal(proposal) {
        return { ok: true, value: proposal };
      },
      async appendEvent() {
        return {
          ok: false,
          error: {
            code: "storage_error",
            message: "event storage failed",
          },
        };
      },
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "event_write_failed");
});

await test("request flow exports no decision, current approval, or replay helpers", () => {
  const forbidden = [
    "approveOwnerApproval",
    "rejectOwnerApproval",
    "revokeOwnerApproval",
    "computeCurrentApproval",
    "getCurrentApproval",
    "replayApprovalLifecycle",
    "evaluateApprovalValidity",
    "isApprovalValid",
  ];

  for (const name of forbidden) {
    assert.equal(name in requestFlowExports, false);
  }
});

await test("request flow module has no Supabase, API, route, or UI imports", () => {
  const source = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "social-owner-approval-request-flow.ts",
    ),
    "utf8",
  );

  assert.equal(source.includes("supabase"), false);
  assert.equal(source.includes("/api/"), false);
  assert.equal(source.includes("next/"), false);
  assert.equal(source.includes(".tsx"), false);
});
