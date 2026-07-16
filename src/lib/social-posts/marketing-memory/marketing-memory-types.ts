export type MarketingMemoryPost = Readonly<{
  id: string;
  createdAt: string;
  title: string | null;
  campaignId: string | null;
  goal: string | null;
  caption: string | null;
  businessFocus: "rentals" | "facility-parties" | "both";
  status: string;
  scheduledFor: string | null;
  postedAt: string | null;
  mediaUrls: readonly string[];
}>;

export type MarketingMemoryCampaign = Readonly<{
  id: string;
  label: string;
  businessFocus: string;
}>;

export type MarketingMemoryHistoryItem = Readonly<{
  value: string;
  count: number;
  mostRecentAt: string;
}>;

export type MarketingMemoryDuplicateWarning = Readonly<{
  kind:
    | "identical_caption"
    | "similar_caption"
    | "repeated_hashtag"
    | "repeated_promotion"
    | "repeated_holiday";
  message: string;
  postIds: readonly string[];
  value: string;
}>;

export type MarketingMemoryRecommendation = Readonly<{
  kind: "rotate_campaign" | "rotate_media" | "avoid_duplicate" | "explore_history";
  message: string;
  relatedValues: readonly string[];
}>;

export type MarketingMemorySnapshot = Readonly<{
  generatedAt: string;
  campaignHistory: readonly MarketingMemoryHistoryItem[];
  activeCampaigns: readonly MarketingMemoryHistoryItem[];
  seasonalHistory: readonly MarketingMemoryHistoryItem[];
  promotedCategories: readonly MarketingMemoryHistoryItem[];
  promotedProducts: readonly MarketingMemoryHistoryItem[];
  facilityPartyPromotions: readonly MarketingMemoryHistoryItem[];
  mediaHistory: readonly MarketingMemoryHistoryItem[];
  approvalHistory: readonly MarketingMemoryHistoryItem[];
  recentThemes: readonly MarketingMemoryHistoryItem[];
  duplicateRisk: readonly MarketingMemoryDuplicateWarning[];
  recommendations: readonly MarketingMemoryRecommendation[];
  constraints: Readonly<{
    readOnly: true;
    deterministic: true;
    performsNoWrites: true;
    performsNoNetworkCalls: true;
    authoritative: false;
  }>;
}>;
