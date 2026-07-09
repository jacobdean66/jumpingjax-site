import assert from "node:assert/strict";

import {
  evaluatePublicationReadiness,
  type PublicationReadiness,
} from "./social-publication-readiness";
import type { PublicationManifest } from "./social-publication-manifest";

const NOW = "2026-06-28T12:00:00.000Z";

type TestFn = () => void | Promise<void>;

type ManifestInput = Partial<
  Omit<
    PublicationManifest,
    | "identity"
    | "source"
    | "campaign"
    | "content"
    | "assets"
    | "destinations"
    | "placement"
    | "decisionSummary"
    | "workingContextSummary"
    | "constraints"
  >
> & {
  identity?: Partial<PublicationManifest["identity"]>;
  source?: Partial<PublicationManifest["source"]>;
  campaign?: Partial<PublicationManifest["campaign"]>;
  content?: Partial<PublicationManifest["content"]>;
  assets?: Partial<PublicationManifest["assets"]>;
  destinations?: Partial<PublicationManifest["destinations"]>;
  placement?: Partial<PublicationManifest["placement"]>;
  decisionSummary?: Partial<PublicationManifest["decisionSummary"]>;
  workingContextSummary?: Partial<
    PublicationManifest["workingContextSummary"]
  >;
  constraints?: Partial<PublicationManifest["constraints"]>;
};

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function manifest(input: ManifestInput = {}): PublicationManifest {
  return {
    identity: {
      socialPostId: "post-1",
      ...input.identity,
    },
    source: {
      status: "draft",
      createdAt: NOW,
      updatedAt: NOW,
      ...input.source,
    },
    campaign: {
      campaignId: "summer-water-slides",
      label: "Summer Water Slides",
      businessFocus: "rentals",
      ...input.campaign,
    },
    content: {
      title: "Weekend Water Slide",
      goal: "Promote water slide rentals",
      caption: "Cool off this weekend.",
      prompt: "Bright summer ad",
      mediaType: "image",
      businessFocus: "rentals",
      ...input.content,
    },
    assets: {
      approvedImageUrl: null,
      generatedImageUrl: null,
      mediaUrl: null,
      sourceImageUrl: null,
      selected: [
        {
          id: "asset-1",
          assetFamilyId: "family-1",
          assetType: "image",
          assetStage: "approved",
          url: "https://example.test/asset.png",
          storagePath: null,
          provider: null,
          model: null,
          isSelected: true,
          isRejected: false,
          isFavorite: false,
          createdAt: NOW,
        },
      ],
      approved: [],
      totalAssetCount: 1,
      ...input.assets,
    },
    destinations: {
      platforms: ["facebook"],
      ...input.destinations,
    },
    placement: {
      postPlacement: "feed",
      formatVariantId: null,
      ...input.placement,
    },
    decisionSummary: {
      totalCount: 1,
      byStage: {
        image_review: 1,
      },
      byType: {
        accepted: 1,
      },
      recentDecisionIds: ["decision-1"],
      ...input.decisionSummary,
    },
    workingContextSummary: {
      campaignScoped: true,
      activeMemoryCount: 1,
      contextPostCount: 2,
      contextDecisionCount: 1,
      contextEvidenceCount: 3,
      ...input.workingContextSummary,
    },
    constraints: {
      derivedEphemeral: true,
      deterministic: true,
      readOnly: true,
      authoritative: false,
      approvesNothing: true,
      publishesNothing: true,
      schedulesNothing: true,
      recordsNoMetrics: true,
      performsNoLearning: true,
      ...input.constraints,
    },
  };
}

function codes(readiness: PublicationReadiness): string[] {
  return [
    ...readiness.blockers.map((blocker) => blocker.code),
    ...readiness.warnings.map((warning) => warning.code),
  ];
}

await test("returns ready_for_approval for a complete manifest", () => {
  const readiness = evaluatePublicationReadiness(manifest());

  assert.equal(readiness.state, "ready_for_approval");
  assert.equal(readiness.nextAction, "request_owner_approval");
  assert.deepEqual(readiness.blockers, []);
  assert.deepEqual(readiness.warnings, []);
  assert.equal(readiness.constraints.derivedEphemeral, true);
  assert.equal(readiness.constraints.approvesNothing, true);
  assert.equal(readiness.constraints.publishesNothing, true);
});

await test("blocks missing manifest safely", () => {
  const readiness = evaluatePublicationReadiness(null);

  assert.equal(readiness.manifest, null);
  assert.equal(readiness.state, "blocked");
  assert.deepEqual(codes(readiness), ["manifest_missing"]);
});

await test("blocks missing required publication inputs", () => {
  const readiness = evaluatePublicationReadiness(
    manifest({
      identity: {
        socialPostId: "",
      },
      content: {
        caption: " ",
      },
      assets: {
        selected: [],
        approved: [],
        approvedImageUrl: null,
        generatedImageUrl: null,
        mediaUrl: null,
        sourceImageUrl: null,
      },
      destinations: {
        platforms: [],
      },
    }),
  );

  assert.equal(readiness.state, "blocked");
  assert.deepEqual(codes(readiness).slice(0, 5), [
    "identity_missing",
    "caption_missing",
    "destination_missing",
    "media_missing",
    "selected_or_approved_asset_missing",
  ]);
});

await test("blocks rejected and failed posts", () => {
  const rejected = evaluatePublicationReadiness(
    manifest({
      source: {
        status: "rejected",
      },
    }),
  );
  const failed = evaluatePublicationReadiness(
    manifest({
      source: {
        status: "failed",
      },
    }),
  );

  assert.deepEqual(codes(rejected), ["post_not_publishable"]);
  assert.deepEqual(codes(failed), ["post_not_publishable"]);
});

await test("warns for advisory gaps without blocking approval request", () => {
  const readiness = evaluatePublicationReadiness(
    manifest({
      campaign: {
        campaignId: null,
        label: null,
      },
      decisionSummary: {
        totalCount: 0,
        byStage: {},
        byType: {},
        recentDecisionIds: [],
      },
      workingContextSummary: {
        campaignScoped: true,
        activeMemoryCount: 0,
        contextPostCount: 0,
        contextDecisionCount: 0,
        contextEvidenceCount: 0,
      },
    }),
  );

  assert.equal(readiness.state, "ready_for_approval");
  assert.deepEqual(codes(readiness), [
    "campaign_uncategorized",
    "decision_history_empty",
    "active_memory_missing",
    "working_context_empty",
  ]);
});

await test("warns when only fallback media is available", () => {
  const readiness = evaluatePublicationReadiness(
    manifest({
      assets: {
        selected: [],
        approved: [],
        sourceImageUrl: "https://example.test/fallback.png",
        approvedImageUrl: null,
        generatedImageUrl: null,
        mediaUrl: null,
      },
    }),
  );

  assert.equal(readiness.state, "ready_for_approval");
  assert.deepEqual(codes(readiness), ["fallback_media_used"]);
});
