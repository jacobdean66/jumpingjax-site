import "server-only";

import {
  getSocialCampaign,
  type SocialCampaign,
} from "./social-campaigns";
import {
  listSocialPostAssets,
  type SocialPostAsset,
} from "./social-post-assets";
import {
  listSocialPostDecisions,
  type SocialPostDecision,
} from "./social-post-decisions";
import {
  getSocialPostById,
  type SocialPost,
} from "./social-post-data";
import {
  buildSocialWorkingContext,
  type SocialWorkingContext,
} from "./social-working-context";

export type PublicationManifestIdentity = {
  socialPostId: string;
};

export type PublicationManifestSource = {
  status: SocialPost["status"];
  createdAt: string;
  updatedAt: string;
};

export type PublicationManifestCampaign = {
  campaignId: string | null;
  label: string | null;
  businessFocus: string | null;
};

export type PublicationManifestContent = {
  title: string | null;
  goal: string | null;
  caption: string | null;
  prompt: string | null;
  mediaType: SocialPost["media_type"];
  businessFocus: SocialPost["business_focus"];
};

export type PublicationManifestAsset = {
  id: string;
  assetFamilyId: string;
  assetType: SocialPostAsset["asset_type"];
  assetStage: SocialPostAsset["asset_stage"];
  url: string | null;
  storagePath: string | null;
  provider: string | null;
  model: string | null;
  isSelected: boolean;
  isRejected: boolean;
  isFavorite: boolean;
  createdAt: string;
};

export type PublicationManifestAssets = {
  approvedImageUrl: string | null;
  generatedImageUrl: string | null;
  mediaUrl: string | null;
  sourceImageUrl: string | null;
  selected: PublicationManifestAsset[];
  approved: PublicationManifestAsset[];
  totalAssetCount: number;
};

export type PublicationManifestDestinations = {
  platforms: SocialPost["platforms"];
};

export type PublicationManifestDecisionSummary = {
  totalCount: number;
  byStage: Record<string, number>;
  byType: Record<string, number>;
  recentDecisionIds: string[];
};

export type PublicationManifestWorkingContextSummary = {
  campaignScoped: true;
  activeMemoryCount: number;
  contextPostCount: number;
  contextDecisionCount: number;
  contextEvidenceCount: number;
};

export type PublicationManifestConstraints = {
  derivedEphemeral: true;
  deterministic: true;
  readOnly: true;
  authoritative: false;
  approvesNothing: true;
  publishesNothing: true;
  schedulesNothing: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
};

// D6.0 invariants:
// - The manifest is derived ephemeral state, not a source of truth.
// - It is deterministic and intentionally has no request timestamp, ID, readiness,
//   fingerprint, approval, ledger, target, metrics, learning, or scheduler fields.
// - It references lower-layer state and summarizes decisions/context without
//   duplicating Decision History reasoning or treating Working Context as authority.
export type PublicationManifest = {
  identity: PublicationManifestIdentity;
  source: PublicationManifestSource;
  campaign: PublicationManifestCampaign;
  content: PublicationManifestContent;
  assets: PublicationManifestAssets;
  destinations: PublicationManifestDestinations;
  decisionSummary: PublicationManifestDecisionSummary;
  workingContextSummary: PublicationManifestWorkingContextSummary;
  constraints: PublicationManifestConstraints;
};

type PublicationManifestDependencies = {
  getPostById: (postId: string) => Promise<SocialPost | null>;
  listAssets: (postId: string) => Promise<SocialPostAsset[]>;
  listDecisions: (postId: string) => Promise<SocialPostDecision[]>;
  buildWorkingContext: (input: {
    campaignId: string | null;
  }) => Promise<SocialWorkingContext>;
  getCampaign: (id: string | null | undefined) => SocialCampaign | null;
};

let publicationManifestDependencies: PublicationManifestDependencies = {
  getPostById: getSocialPostById,
  listAssets: listSocialPostAssets,
  listDecisions: listSocialPostDecisions,
  buildWorkingContext: ({ campaignId }) =>
    buildSocialWorkingContext({ campaignId }),
  getCampaign: getSocialCampaign,
};

export function configurePublicationManifestTestDependencies(
  dependencies: Partial<PublicationManifestDependencies> | null,
): void {
  publicationManifestDependencies = {
    getPostById: dependencies?.getPostById ?? getSocialPostById,
    listAssets: dependencies?.listAssets ?? listSocialPostAssets,
    listDecisions: dependencies?.listDecisions ?? listSocialPostDecisions,
    buildWorkingContext:
      dependencies?.buildWorkingContext ??
      (({ campaignId }) => buildSocialWorkingContext({ campaignId })),
    getCampaign: dependencies?.getCampaign ?? getSocialCampaign,
  };
}

function countBy<T extends string>(values: T[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function byNewestCreatedAt<T extends { created_at: string; id: string }>(
  left: T,
  right: T,
) {
  const delta =
    new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  return delta === 0 ? left.id.localeCompare(right.id) : delta;
}

function manifestAsset(asset: SocialPostAsset): PublicationManifestAsset {
  return {
    id: asset.id,
    assetFamilyId: asset.asset_family_id,
    assetType: asset.asset_type,
    assetStage: asset.asset_stage,
    url: asset.url,
    storagePath: asset.storage_path,
    provider: asset.provider,
    model: asset.model,
    isSelected: asset.is_selected,
    isRejected: asset.is_rejected,
    isFavorite: asset.is_favorite,
    createdAt: asset.created_at,
  };
}

export async function buildPublicationManifest(
  postId: string,
): Promise<PublicationManifest> {
  const cleanedPostId = postId.trim();
  if (!cleanedPostId) {
    throw new Error("Social post id is required.");
  }

  const post = await publicationManifestDependencies.getPostById(cleanedPostId);
  if (!post) {
    throw new Error("Social post not found.");
  }

  const [assets, decisions, workingContext] = await Promise.all([
    publicationManifestDependencies.listAssets(post.id),
    publicationManifestDependencies.listDecisions(post.id),
    publicationManifestDependencies.buildWorkingContext({
      campaignId: post.campaign_id,
    }),
  ]);
  const campaign = publicationManifestDependencies.getCampaign(post.campaign_id);
  const sortedAssets = [...assets].sort(byNewestCreatedAt);
  const sortedDecisions = [...decisions].sort(byNewestCreatedAt);

  return {
    identity: {
      socialPostId: post.id,
    },
    source: {
      status: post.status,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
    },
    campaign: {
      campaignId: post.campaign_id,
      label: campaign?.label ?? null,
      businessFocus: campaign?.businessFocus ?? null,
    },
    content: {
      title: post.title,
      goal: post.goal,
      caption: post.caption,
      prompt: post.prompt,
      mediaType: post.media_type,
      businessFocus: post.business_focus,
    },
    assets: {
      approvedImageUrl: post.approved_image_url,
      generatedImageUrl: post.generated_image_url,
      mediaUrl: post.media_url,
      sourceImageUrl: post.source_image_url,
      selected: sortedAssets
        .filter((asset) => asset.is_selected && !asset.is_rejected)
        .map(manifestAsset),
      approved: sortedAssets
        .filter((asset) => asset.asset_stage === "approved" && !asset.is_rejected)
        .map(manifestAsset),
      totalAssetCount: sortedAssets.length,
    },
    destinations: {
      platforms: post.platforms,
    },
    decisionSummary: {
      totalCount: sortedDecisions.length,
      byStage: countBy(
        sortedDecisions.map((decision) => decision.decision_stage),
      ),
      byType: countBy(
        sortedDecisions.map((decision) => decision.decision_type),
      ),
      recentDecisionIds: sortedDecisions
        .slice(0, 5)
        .map((decision) => decision.id),
    },
    workingContextSummary: {
      campaignScoped: workingContext.constraints.campaignScoped,
      activeMemoryCount: workingContext.sourceSummary.activeMemoryCount,
      contextPostCount: workingContext.sourceSummary.postCount,
      contextDecisionCount: workingContext.sourceSummary.decisionCount,
      contextEvidenceCount: workingContext.sourceSummary.evidenceCount,
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
    },
  };
}
