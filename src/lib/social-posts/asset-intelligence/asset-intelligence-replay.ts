import {
  CATEGORY_COPY,
  HOMEPAGE_HERO_ASSET,
  RENTALS,
  type RentalCategoryId,
} from "@/data/rentals";
import type { SocialCampaign } from "../social-campaigns";
import type { SocialPost } from "../social-post-data";
import type { MarketingMemorySnapshot } from "../marketing-memory/marketing-memory-types";
import {
  listPublicAssetMetadata,
  publicAssetDimensions,
} from "../public-asset-metadata";
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
      const dimensions = publicAssetDimensions(url);
      const classified = classifyAspectRatio(
        dimensions?.width ?? null,
        dimensions?.height ?? null,
      );
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
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
        aspectRatioClass: classified.aspectRatioClass,
        orientation: classified.orientation,
        supportedPlacements: classified.supportedPlacements,
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
    const dimensions = publicAssetDimensions(path);
    const classified = classifyAspectRatio(
      dimensions?.width ?? null,
      dimensions?.height ?? null,
    );
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
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      aspectRatioClass: classified.aspectRatioClass,
      orientation: classified.orientation,
      supportedPlacements: classified.supportedPlacements,
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
    const dimensions = publicAssetDimensions(heroPath);
    const classified = classifyAspectRatio(
      dimensions?.width ?? null,
      dimensions?.height ?? null,
    );
    assets.push({
      id: "brand:homepage-hero",
      source: "brand",
      mediaType: "image",
      title: "Homepage hero",
      sourceRecordId: "homepage-hero",
      sourcePathOrUrl: heroPath,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      aspectRatioClass: classified.aspectRatioClass,
      orientation: classified.orientation,
      supportedPlacements: classified.supportedPlacements,
      createdAt: null,
      ageDays: null,
      usability: "usable",
      campaignHints: ["brand-awareness"],
      subjectHints: ["homepage", "brand"],
      // Keep brand-only terms. Broad words like "family"/"party" falsely match
      // birthday, private-party, and testimonial campaigns.
      matchingTerms: ["homepage", "hero", "brand"],
    });
  }

  const logoDimensions = publicAssetDimensions("/logo.png");
  const logoClassified = classifyAspectRatio(
    logoDimensions?.width ?? null,
    logoDimensions?.height ?? null,
  );
  assets.push({
    id: "brand:logo",
    source: "brand",
    mediaType: "graphic",
    title: "Jumping Jax logo",
    sourceRecordId: "logo",
    sourcePathOrUrl: "/logo.png",
    width: logoDimensions?.width ?? null,
    height: logoDimensions?.height ?? null,
    aspectRatioClass: logoClassified.aspectRatioClass,
    orientation: logoClassified.orientation,
    supportedPlacements: logoClassified.supportedPlacements,
    createdAt: null,
    ageDays: null,
    usability: "usable",
    campaignHints: ["brand-awareness"],
    subjectHints: ["logo", "brand"],
    matchingTerms: ["logo", "brand", "awareness"],
  });

  // The source library must reflect the whole live website, not only the
  // hand-maintained rental catalog. Add every measured public image that is
  // not already represented above, including Invitation Agent theme assets.
  const representedPaths = new Set(
    assets.map((asset) => normalizeAssetText(asset.sourcePathOrUrl ?? "")),
  );
  for (const item of listPublicAssetMetadata()) {
    if (representedPaths.has(normalizeAssetText(item.path))) continue;
    const classified = classifyAspectRatio(item.width, item.height);
    const pathTerms = normalizeAssetText(item.path)
      .split(" ")
      .filter((term) => term.length >= 3);
    const filename = item.path.split("/").at(-1)?.replace(/\.[^.]+$/, "") ?? item.path;
    assets.push({
      id: `public:${item.path}`,
      source: item.path.startsWith("/invitations/") ? "brand" : "catalog",
      mediaType: item.path.includes("logo") ? "graphic" : "image",
      title: filename.replace(/[-_]+/g, " "),
      sourceRecordId: item.path,
      sourcePathOrUrl: item.path,
      width: item.width,
      height: item.height,
      aspectRatioClass: classified.aspectRatioClass,
      orientation: classified.orientation,
      supportedPlacements: classified.supportedPlacements,
      createdAt: null,
      ageDays: null,
      usability: "usable",
      campaignHints: item.path.startsWith("/invitations/") ? ["facility-parties"] : [],
      subjectHints: pathTerms,
      matchingTerms: Array.from(new Set(pathTerms)).sort(),
    });
  }

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
