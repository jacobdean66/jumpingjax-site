import assert from "node:assert/strict";

import {
  validateSocialOwnerApprovalPersistenceModel,
  type SocialOwnerApprovalPersistenceModel,
} from "./social-owner-approval-persistence";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

const NOW = "2026-06-29T12:00:00.000Z";

function validModel(
  input: Partial<Record<string, unknown>> = {},
): SocialOwnerApprovalPersistenceModel {
  const model = {
    proposal: {
      proposalId: "proposal-1",
      approvalId: "approval-1",
      socialPostId: "post-1",
      proposalFingerprint: "fingerprint-1",
      proposalVersion: "v1",
      proposalScope: {
        socialPostId: "post-1",
        proposalFingerprint: "fingerprint-1",
        proposalVersion: "v1",
        campaignId: "summer-water-slides",
        platforms: ["facebook", "instagram"],
      },
      snapshot: {
        socialPostId: "post-1",
        proposalFingerprint: "fingerprint-1",
        proposalVersion: "v1",
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
    },
    events: [
      {
        eventId: "event-1",
        approvalId: "approval-1",
        proposalId: "proposal-1",
        proposalFingerprint: "fingerprint-1",
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
      },
    ],
    ...input,
  };

  return model as unknown as SocialOwnerApprovalPersistenceModel;
}

function codes(model: unknown): string[] {
  const result = validateSocialOwnerApprovalPersistenceModel(model);

  if (result.ok) return [];
  return result.errors.map((error) => error.code);
}

await test("accepts a minimal immutable proposal and append-only event model", () => {
  const result = validateSocialOwnerApprovalPersistenceModel(validModel());

  assert.equal(result.ok, true);
});

await test("rejects missing required proposal fields", () => {
  const model = validModel({
    proposal: {
      ...validModel().proposal,
      proposalFingerprint: "",
      snapshot: null,
    },
  });

  assert.deepEqual(codes(model).slice(0, 2), [
    "required_field_missing",
    "required_field_missing",
  ]);
});

await test("rejects proposal identity collisions", () => {
  const base = validModel();
  const model = validModel({
    proposal: {
      ...base.proposal,
      approvalId: base.proposal.proposalId,
    },
  });

  assert.equal(codes(model).includes("identity_not_separated"), true);
});

await test("rejects proposal scope mismatches", () => {
  const base = validModel();
  const model = validModel({
    proposal: {
      ...base.proposal,
      proposalScope: {
        ...base.proposal.proposalScope,
        proposalFingerprint: "fingerprint-2",
      },
    },
  });

  assert.equal(codes(model).includes("proposal_scope_mismatch"), true);
});

await test("rejects snapshot identity mismatches", () => {
  const base = validModel();
  const model = validModel({
    proposal: {
      ...base.proposal,
      snapshot: {
        ...base.proposal.snapshot,
        proposalVersion: "v2",
      },
    },
  });

  assert.equal(codes(model).includes("snapshot_scope_mismatch"), true);
});

await test("rejects actor authority snapshots without historical authority", () => {
  const base = validModel();
  const model = validModel({
    events: [
      {
        ...base.events[0],
        actorSnapshot: {
          actorId: "owner-1",
          actorType: "human",
          authorityRole: "owner",
        },
      },
    ],
  });

  assert.equal(codes(model).includes("actor_snapshot_invalid"), true);
});

await test("rejects invalid event types", () => {
  const base = validModel();
  const model = validModel({
    events: [
      {
        ...base.events[0],
        eventType: "approval_published",
      },
    ],
  });

  assert.equal(codes(model).includes("event_type_invalid"), true);
});

await test("rejects invalid and duplicate event sequences", () => {
  const base = validModel();
  const invalid = validModel({
    events: [
      {
        ...base.events[0],
        eventSequence: 0,
      },
    ],
  });
  const duplicate = validModel({
    events: [
      base.events[0],
      {
        ...base.events[0],
        eventId: "event-2",
      },
    ],
  });

  assert.equal(codes(invalid).includes("event_sequence_invalid"), true);
  assert.equal(codes(duplicate).includes("event_sequence_invalid"), true);
});

await test("rejects event scope mismatches", () => {
  const base = validModel();
  const model = validModel({
    events: [
      {
        ...base.events[0],
        proposalId: "proposal-2",
      },
    ],
  });

  assert.equal(codes(model).includes("event_scope_mismatch"), true);
});

await test("rejects stored computed approval state", () => {
  const base = validModel();
  const model = validModel({
    proposal: {
      ...base.proposal,
      approvalStatus: "approved",
    },
  });

  assert.equal(codes(model).includes("stored_computed_state_forbidden"), true);
});

await test("rejects stored approval validity and current approval fields", () => {
  const base = validModel();
  const model = validModel({
    events: [
      {
        ...base.events[0],
        approvalValidity: true,
        currentApproval: "approval-1",
      },
    ],
  });

  assert.equal(codes(model).includes("stored_computed_state_forbidden"), true);
});

await test("rejects lower-layer payload duplication inside snapshots", () => {
  const base = validModel();
  const model = validModel({
    proposal: {
      ...base.proposal,
      snapshot: {
        ...base.proposal.snapshot,
        publicationManifest: {
          copied: true,
        },
      },
    },
  });

  assert.equal(codes(model).includes("lower_layer_payload_forbidden"), true);
});

await test("is deterministic for repeated validation", () => {
  const model = validModel();

  assert.deepEqual(
    validateSocialOwnerApprovalPersistenceModel(model),
    validateSocialOwnerApprovalPersistenceModel(model),
  );
});
