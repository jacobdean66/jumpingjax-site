import "server-only";

import {
  getSocialCampaign,
  type SocialCampaign,
} from "./social-campaigns";
import {
  listSocialCampaignMemories,
  listSocialCampaignMemoryEvidence,
  type ListSocialCampaignMemoriesInput,
  type SocialCampaignMemory,
  type SocialCampaignMemoryEvidence,
} from "./social-campaign-memories";
import {
  listSocialPostDecisions,
  type DecisionStage,
  type DecisionType,
  type SocialPostDecision,
} from "./social-post-decisions";
import {
  listSocialPosts,
  type SocialPost,
} from "./social-post-data";

export type BuildSocialWorkingContextInput = {
  campaignId: string | null;
  recentPostLimit?: number;
  recentDecisionLimit?: number;
};

export type SocialWorkingContextCampaignSummary = {
  id: string | null;
  label: string | null;
  description: string | null;
  businessFocus: string | null;
  defaultMediaType: string | null;
};

export type SocialWorkingContextSourceSummary = {
  generatedAt: string;
  postCount: number;
  decisionCount: number;
  activeMemoryCount: number;
  evidenceCount: number;
};

export type SocialWorkingContextPost = {
  id: string;
  title: string | null;
  status: string;
  mediaType: string;
  goal: string | null;
  createdAt: string;
  scheduledFor: string | null;
};

export type SocialWorkingContextDecision = {
  id: string;
  socialPostId: string;
  assetId: string | null;
  assetFamilyId: string | null;
  campaignId: string | null;
  createdAt: string;
  stage: DecisionStage;
  type: DecisionType;
  decision: string;
  rationale: string | null;
  provider: string | null;
  model: string | null;
};

export type SocialWorkingContextDecisionSummary = {
  byStage: Record<string, number>;
  byType: Record<string, number>;
  recentDecisions: SocialWorkingContextDecision[];
};

export type SocialWorkingContextMemory = {
  id: string;
  key: string;
  type: string;
  text: string;
  recommendation: string | null;
  confidenceScore: number;
  supportCount: number;
  contradictionCount: number;
  evidenceCount: number;
};

export type SocialWorkingContextConstraints = {
  temporary: true;
  campaignScoped: true;
  readOnly: true;
  authoritative: false;
};

export type SocialWorkingContext = {
  campaign: SocialWorkingContextCampaignSummary;
  sourceSummary: SocialWorkingContextSourceSummary;
  recentPosts: SocialWorkingContextPost[];
  decisionSummary: SocialWorkingContextDecisionSummary;
  campaignMemory: SocialWorkingContextMemory[];
  constraints: SocialWorkingContextConstraints;
};

type SocialWorkingContextDependencies = {
  getCampaign: (id: string | null | undefined) => SocialCampaign | null;
  listPosts: () => Promise<SocialPost[]>;
  listPostDecisions: (postId: string) => Promise<SocialPostDecision[]>;
  listMemories: (
    input?: ListSocialCampaignMemoriesInput,
  ) => Promise<SocialCampaignMemory[]>;
  listMemoryEvidence: (
    memoryId: string,
  ) => Promise<SocialCampaignMemoryEvidence[]>;
  now: () => Date;
};

let socialWorkingContextDependencies: SocialWorkingContextDependencies = {
  getCampaign: getSocialCampaign,
  listPosts: listSocialPosts,
  listPostDecisions: listSocialPostDecisions,
  listMemories: listSocialCampaignMemories,
  listMemoryEvidence: listSocialCampaignMemoryEvidence,
  now: () => new Date(),
};

export function configureSocialWorkingContextTestDependencies(
  dependencies: Partial<SocialWorkingContextDependencies> | null,
): void {
  socialWorkingContextDependencies = {
    getCampaign: dependencies?.getCampaign ?? getSocialCampaign,
    listPosts: dependencies?.listPosts ?? listSocialPosts,
    listPostDecisions:
      dependencies?.listPostDecisions ?? listSocialPostDecisions,
    listMemories: dependencies?.listMemories ?? listSocialCampaignMemories,
    listMemoryEvidence:
      dependencies?.listMemoryEvidence ?? listSocialCampaignMemoryEvidence,
    now: dependencies?.now ?? (() => new Date()),
  };
}

function countBy<T extends string>(values: T[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function byNewestCreatedAt<T extends { created_at: string }>(left: T, right: T) {
  return (
    new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  );
}

function campaignSummary(
  campaignId: string | null,
): SocialWorkingContextCampaignSummary {
  const campaign = socialWorkingContextDependencies.getCampaign(campaignId);

  return {
    id: campaignId,
    label: campaign?.label ?? null,
    description: campaign?.description ?? null,
    businessFocus: campaign?.businessFocus ?? null,
    defaultMediaType: campaign?.defaultMediaType ?? null,
  };
}

function contextPost(post: SocialPost): SocialWorkingContextPost {
  return {
    id: post.id,
    title: post.title,
    status: post.status,
    mediaType: post.media_type,
    goal: post.goal,
    createdAt: post.created_at,
    scheduledFor: post.scheduled_for,
  };
}

function contextDecision(
  decision: SocialPostDecision,
): SocialWorkingContextDecision {
  return {
    id: decision.id,
    socialPostId: decision.social_post_id,
    assetId: decision.asset_id,
    assetFamilyId: decision.asset_family_id,
    campaignId: decision.campaign_id,
    createdAt: decision.created_at,
    stage: decision.decision_stage,
    type: decision.decision_type,
    decision: decision.decision,
    rationale: decision.rationale,
    provider: decision.provider,
    model: decision.model,
  };
}

function contextMemory(input: {
  memory: SocialCampaignMemory;
  evidenceCount: number;
}): SocialWorkingContextMemory {
  return {
    id: input.memory.id,
    key: input.memory.memory_key,
    type: input.memory.memory_type,
    text: input.memory.memory_text,
    recommendation: input.memory.recommendation,
    confidenceScore: input.memory.confidence_score,
    supportCount: input.memory.support_count,
    contradictionCount: input.memory.contradiction_count,
    evidenceCount: input.evidenceCount,
  };
}

export async function buildSocialWorkingContext(
  input: BuildSocialWorkingContextInput,
): Promise<SocialWorkingContext> {
  const recentPostLimit = input.recentPostLimit ?? 10;
  const recentDecisionLimit = input.recentDecisionLimit ?? 20;

  const allPosts = await socialWorkingContextDependencies.listPosts();
  const campaignPosts = allPosts
    .filter((post) => post.campaign_id === input.campaignId)
    .sort(byNewestCreatedAt);

  const decisionsByPost = await Promise.all(
    campaignPosts.map((post) =>
      socialWorkingContextDependencies.listPostDecisions(post.id),
    ),
  );
  const decisions = decisionsByPost.flat().sort(byNewestCreatedAt);

  const memories = (
    await socialWorkingContextDependencies.listMemories({
      campaignId: input.campaignId,
      status: "active",
    })
  ).filter((memory) => memory.status === "active");

  const memoryEvidence = await Promise.all(
    memories.map(async (memory) => ({
      memory,
      evidence: await socialWorkingContextDependencies.listMemoryEvidence(
        memory.id,
      ),
    })),
  );
  const evidenceCount = memoryEvidence.reduce(
    (count, item) => count + item.evidence.length,
    0,
  );

  return {
    campaign: campaignSummary(input.campaignId),
    sourceSummary: {
      generatedAt: socialWorkingContextDependencies.now().toISOString(),
      postCount: campaignPosts.length,
      decisionCount: decisions.length,
      activeMemoryCount: memories.length,
      evidenceCount,
    },
    recentPosts: campaignPosts.slice(0, recentPostLimit).map(contextPost),
    decisionSummary: {
      byStage: countBy(decisions.map((decision) => decision.decision_stage)),
      byType: countBy(decisions.map((decision) => decision.decision_type)),
      recentDecisions: decisions
        .slice(0, recentDecisionLimit)
        .map(contextDecision),
    },
    campaignMemory: memoryEvidence.map((item) =>
      contextMemory({
        memory: item.memory,
        evidenceCount: item.evidence.length,
      }),
    ),
    constraints: {
      temporary: true,
      campaignScoped: true,
      readOnly: true,
      authoritative: false,
    },
  };
}
