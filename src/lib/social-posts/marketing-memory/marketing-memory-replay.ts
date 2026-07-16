import type { SocialCampaign } from "../social-campaigns";
import type { SocialPost } from "../social-post-data";
import { buildMarketingMemory } from "./marketing-memory-service";
import type {
  MarketingMemoryCampaign,
  MarketingMemoryPost,
  MarketingMemorySnapshot,
} from "./marketing-memory-types";

function mediaUrls(post: SocialPost): string[] {
  return Array.from(
    new Set(
      [
        post.media_url,
        post.media_source_url,
        post.source_image_url,
        post.approved_image_url,
        post.generated_image_url,
      ].filter((value): value is string => Boolean(value?.trim())),
    ),
  );
}

export function marketingMemoryPost(post: SocialPost): MarketingMemoryPost {
  return {
    id: post.id,
    createdAt: post.created_at,
    title: post.title,
    campaignId: post.campaign_id,
    goal: post.goal,
    caption: post.caption,
    businessFocus: post.business_focus,
    status: post.status,
    scheduledFor: post.scheduled_for,
    postedAt: post.posted_at,
    mediaUrls: mediaUrls(post),
  };
}

export function marketingMemoryCampaign(
  campaign: SocialCampaign,
): MarketingMemoryCampaign {
  return {
    id: campaign.id,
    label: campaign.label,
    businessFocus: campaign.businessFocus,
  };
}

export function replayMarketingMemory(input: {
  posts: readonly SocialPost[];
  campaigns: readonly SocialCampaign[];
  generatedAt?: string;
}): MarketingMemorySnapshot {
  return buildMarketingMemory({
    posts: input.posts.map(marketingMemoryPost),
    campaigns: input.campaigns.map(marketingMemoryCampaign),
    generatedAt: input.generatedAt,
  });
}
