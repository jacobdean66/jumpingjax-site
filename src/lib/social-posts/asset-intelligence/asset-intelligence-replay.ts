import {
  CATEGORY_COPY,
  HOMEPAGE_HERO_ASSET,
  RENTALS,
  type RentalCategoryId,
} from "@/data/rentals";
import type { SocialCampaign } from "../social-campaigns";
import type { SocialPost } from "../social-post-data";
import type { MarketingMemorySnapshot } from "../marketing-memory/marketing-memory-types";
import { classifyAspectRatio, normalizeAssetText } from "./asset-intelligence-domain";
import { buildAssetIntelligence } from "./asset-intelligence-service";
import type {
  AssetIntelligenceAsset,
  AssetIntelligenceCampaign,
  AssetIntelligenceMediaType,
  AssetIntelligenceSnapshot,
  AssetUsability,
} from "./asset-intelligence-types";

function categoryLabel(categoryId: RentalCategoryId): string {
  return CATEGORY_COPY[categoryId]?.title ?? categoryId;
}

function mediaTypeFromPost(post: SocialPost): AssetIntelligenceMediaType {
  const declared = (post.media_type ?? "").toLowerCase();
  if (declared.includes("video")) return "video";
  if (declared.includes("image") || declared.includes("photo")) return "image";
  return "unknown";
}

function usabilityFromPost(post: SocialPost): AssetUsability {
  if (post.approved_image_url?.trim()) return "usable";
  if (post.status === "approved" || post.status === "scheduled" || post.status === "posted") {
    return "usable";
  }
  if (post.status === "rejected" || post.status === "failed") return "unapproved";
  return "unknown";
}

function postMediaUrls(post: SocialPost): readonly string[] {
  return [
    post.media_url,
    post.media_source_url,
    post.source_image_url,
    post.original_image_url,
    post.approved_image_url,
    post.generated_image_url,
    post.generated_image_source_url,
  ]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);
}

function uniqueUrls(urls: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of urls) {
    const key = normalizeAssetText(url);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(url);
  }
  return result;
}

export function projectPostMediaAssets(
  posts: readonly SocialPost[],
): readonly AssetIntelligenceAsset[] {
  const assets: AssetIntelligenceAsset[] = [];
  for (const post of posts) {
    const urls = uniqueUrls(postMediaUrls(post));
    urls.forEach((url, index) => {
      const classified = classifyAspectRatio(null, null);
      const terms = [
        post.title ?? "",
        post.campaign_id ?? "",
        post.goal ?? "",
        post.caption ?? "",
        post.business_focus ?? "",
      ]
        .flatMap((value) => normalizeAssetText(value).split(" "))
        .filter((token) => token.length >= 3);

      assets.push({
        id: `post:${post.id}:${index}`,
        source: "post-media",
        mediaType: mediaTypeFromPost(post),
        title: post.title?.trim() || `Post ${post.id} media`,
        sourceRecordId: post.id,
        sourcePathOrUrl: url,
        width: null,
        height: null,
        aspectRatioClass: classified.aspectRatioClass,
        orientation: classified.orientation,
        supportedPlacements: post.post_placement ? [post.post_placement] : [],
        createdAt: post.created_at,
        ageDays: null,
        usability: usabilityFromPost(post),
        campaignHints: post.campaign_id ? [post.campaign_id] : [],
        subjectHints: terms,
        matchingTerms: Array.from(new Set(terms)).sort(),
      });
    });
  }
  return assets;
}

/**
 * Deterministic catalog projection using relative paths only.
 * Does not require NEXT_PUBLIC_SITE_URL and never invents remote URLs.
 */
export function projectCatalogAssets(): readonly AssetIntelligenceAsset[] {
  const assets: AssetIntelligenceAsset[] = [];

  for (const rental of RENTALS) {
    const path = rental.imageSrc?.trim();
    if (!path) continue;
    const category = categoryLabel(rental.categoryId);
    const terms = normalizeAssetText(
      `${rental.title} ${category} ${rental.categoryId}`,
    )
      .split(" ")
      .filter((token) => token.length >= 3);

    assets.push({
      id: `catalog:${rental.slug}`,
      source: "catalog",
      mediaType: "image",
      title: `${rental.title} (${category})`,
      sourceRecordId: rental.slug,
      sourcePathOrUrl: path,
      width: null,
      height: null,
      aspectRatioClass: "unknown",
      orientation: "unknown",
      supportedPlacements: [],
      createdAt: null,
      ageDays: null,
      usability: "usable",
      campaignHints: [],
      subjectHints: [category, rental.categoryId],
      matchingTerms: Array.from(new Set(terms)).sort(),
    });
  }

  const heroPath = HOMEPAGE_HERO_ASSET.src?.trim();
  if (heroPath) {
    assets.push({
      id: "brand:homepage-hero",
      source: "brand",
      mediaType: "image",
      title: "Homepage hero",
      sourceRecordId: "homepage-hero",
      sourcePathOrUrl: heroPath,
      width: null,
      height: null,
      aspectRatioClass: "unknown",
      orientation: "unknown",
      supportedPlacements: [],
      createdAt: null,
      ageDays: null,
      usability: "usable",
      campaignHints: ["brand-awareness"],
      subjectHints: ["homepage", "brand"],
      matchingTerms: ["homepage", "hero", "brand", "family", "party"],
    });
  }

  assets.push({
    id: "brand:logo",
    source: "brand",
    mediaType: "graphic",
    title: "Jumping Jax logo",
    sourceRecordId: "logo",
    sourcePathOrUrl: "/logo.png",
    width: null,
    height: null,
    aspectRatioClass: "unknown",
    orientation: "unknown",
    supportedPlacements: [],
    createdAt: null,
    ageDays: null,
    usability: "usable",
    campaignHints: ["brand-awareness"],
    subjectHints: ["logo", "brand"],
    matchingTerms: ["logo", "brand", "awareness"],
  });

  return assets;
}

export function assetIntelligenceCampaign(
  campaign: SocialCampaign,
): AssetIntelligenceCampaign {
  return {
    id: campaign.id,
    label: campaign.label,
    businessFocus: campaign.businessFocus,
    defaultMediaType: campaign.defaultMediaType,
    preferredImageKeywords: campaign.preferredImageKeywords,
  };
}

export function replayAssetIntelligence(input: {
  posts: readonly SocialPost[];
  campaigns: readonly SocialCampaign[];
  marketingMemory?: MarketingMemorySnapshot;
  asOf: string;
  extraAssets?: readonly AssetIntelligenceAsset[];
}): AssetIntelligenceSnapshot {
  const assets = [
    ...projectCatalogAssets(),
    ...projectPostMediaAssets(input.posts),
    ...(input.extraAssets ?? []),
  ];

  return buildAssetIntelligence({
    assets,
    campaigns: input.campaigns.map(assetIntelligenceCampaign),
    mediaHistory: input.marketingMemory?.mediaHistory ?? [],
    asOf: input.asOf,
  });
}
