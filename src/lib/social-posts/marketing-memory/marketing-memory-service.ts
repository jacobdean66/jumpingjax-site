import {
  collectHistory,
  extractHolidayMessaging,
  extractMarketingMemoryHashtags,
  extractPromotedCategories,
  findCaptionDuplicateWarnings,
} from "./marketing-memory-domain";
import type {
  MarketingMemoryCampaign,
  MarketingMemoryDuplicateWarning,
  MarketingMemoryPost,
  MarketingMemoryRecommendation,
  MarketingMemorySnapshot,
} from "./marketing-memory-types";

export type BuildMarketingMemoryInput = Readonly<{
  posts: readonly MarketingMemoryPost[];
  campaigns: readonly MarketingMemoryCampaign[];
  generatedAt?: string;
}>;

function textForPost(post: MarketingMemoryPost): string {
  return [post.title, post.goal, post.caption].filter(Boolean).join(" ");
}

function historyValues(
  posts: readonly MarketingMemoryPost[],
  valuesForPost: (post: MarketingMemoryPost) => readonly string[],
) {
  return posts.flatMap((post) =>
    valuesForPost(post).map((value) => ({ value, at: post.createdAt })),
  );
}

function repeatedValueWarnings(
  kind: Extract<
    MarketingMemoryDuplicateWarning["kind"],
    "repeated_hashtag" | "repeated_promotion" | "repeated_holiday"
  >,
  posts: readonly MarketingMemoryPost[],
  valuesForPost: (post: MarketingMemoryPost) => readonly string[],
): MarketingMemoryDuplicateWarning[] {
  const groups = new Map<string, string[]>();
  for (const post of posts) {
    for (const value of valuesForPost(post)) {
      const current = groups.get(value) ?? [];
      current.push(post.id);
      groups.set(value, current);
    }
  }

  return [...groups.entries()]
    .filter(([, postIds]) => postIds.length > 1)
    .map(([value, postIds]) => ({
      kind,
      value,
      postIds,
      message: `${kind.replaceAll("_", " ")} appears in ${postIds.length} posts.`,
    }))
    .sort((left, right) => left.value.localeCompare(right.value));
}

function recommendations(input: {
  duplicateRisk: readonly MarketingMemoryDuplicateWarning[];
  mediaCount: number;
  campaignCount: number;
}): MarketingMemoryRecommendation[] {
  const result: MarketingMemoryRecommendation[] = [];
  if (input.duplicateRisk.length > 0) {
    result.push({
      kind: "avoid_duplicate",
      message: "Review duplicate warnings before reusing captions, themes, or promotions.",
      relatedValues: input.duplicateRisk.map((warning) => warning.value),
    });
  }
  if (input.campaignCount > 0) {
    result.push({
      kind: "rotate_campaign",
      message: "Use campaign history to rotate recently repeated promotions.",
      relatedValues: [],
    });
  }
  if (input.mediaCount > 0) {
    result.push({
      kind: "rotate_media",
      message: "Prefer a media asset not shown in recent history when practical.",
      relatedValues: [],
    });
  }
  if (result.length === 0) {
    result.push({
      kind: "explore_history",
      message: "No usable history is available yet; future posts will populate this read-only view.",
      relatedValues: [],
    });
  }
  return result;
}

export function buildMarketingMemory(
  input: BuildMarketingMemoryInput,
): MarketingMemorySnapshot {
  const campaignsById = new Map(input.campaigns.map((campaign) => [campaign.id, campaign]));
  const campaignHistory = collectHistory(
    historyValues(input.posts, (post) => {
      if (!post.campaignId) return [];
      return [campaignsById.get(post.campaignId)?.label ?? post.campaignId];
    }),
  );
  const activeCampaigns = collectHistory(
    historyValues(
      input.posts.filter(
        (post) => post.status === "approved" || post.status === "scheduled",
      ),
      (post) => {
        if (!post.campaignId) return [];
        return [campaignsById.get(post.campaignId)?.label ?? post.campaignId];
      },
    ),
  );
  const seasonalHistory = collectHistory(
    historyValues(input.posts, (post) => extractHolidayMessaging(textForPost(post))),
  );
  const promotedCategories = collectHistory(
    historyValues(input.posts, (post) => extractPromotedCategories(textForPost(post))),
  );
  const promotedProducts = collectHistory(
    historyValues(input.posts, (post) => (post.title?.trim() ? [post.title.trim()] : [])),
  );
  const facilityPartyPromotions = collectHistory(
    historyValues(
      input.posts.filter((post) => post.businessFocus === "facility-parties" || post.businessFocus === "both"),
      (post) => [post.goal, post.title].filter((value): value is string => Boolean(value?.trim())),
    ),
  );
  const mediaHistory = collectHistory(
    historyValues(input.posts, (post) => post.mediaUrls),
  );
  const approvalHistory = collectHistory(
    historyValues(
      input.posts.filter((post) => post.status === "approved" || post.status === "scheduled" || post.status === "posted"),
      (post) => [post.status],
    ),
  );
  const recentThemes = collectHistory(
    historyValues(input.posts, (post) => {
      const campaign = post.campaignId ? campaignsById.get(post.campaignId) : null;
      return [campaign?.label, post.goal].filter((value): value is string => Boolean(value?.trim()));
    }),
  );

  const duplicateRisk = [
    ...findCaptionDuplicateWarnings(input.posts),
    ...repeatedValueWarnings(
      "repeated_hashtag",
      input.posts,
      (post) => extractMarketingMemoryHashtags(post.caption),
    ),
    ...repeatedValueWarnings(
      "repeated_promotion",
      input.posts,
      (post) => (post.campaignId ? [post.campaignId] : []),
    ),
    ...repeatedValueWarnings(
      "repeated_holiday",
      input.posts,
      (post) => extractHolidayMessaging(textForPost(post)),
    ),
  ];

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    campaignHistory,
    activeCampaigns,
    seasonalHistory,
    promotedCategories,
    promotedProducts,
    facilityPartyPromotions,
    mediaHistory,
    approvalHistory,
    recentThemes,
    duplicateRisk,
    recommendations: recommendations({
      duplicateRisk,
      mediaCount: mediaHistory.length,
      campaignCount: campaignHistory.length,
    }),
    constraints: {
      readOnly: true,
      deterministic: true,
      performsNoWrites: true,
      performsNoNetworkCalls: true,
      authoritative: false,
    },
  };
}
