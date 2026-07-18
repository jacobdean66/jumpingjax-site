import { RENTALS } from "@/data/rentals";
import { SOCIAL_CAMPAIGNS } from "./social-campaigns";
import { SOCIAL_SOURCE_IMAGES } from "./social-source-images";
import { IMAGE_CONCEPT_IDS } from "./image-director";

export type RandomWorkflowChoice = {
  assetSlug: string;
  assetTitle: string;
  assetImageUrl: string;
  campaignId: string;
  campaignLabel: string;
  businessFocus: "rentals" | "facility-parties" | "both";
  audience: string;
  postType: "image" | "video";
  visualConcept: string;
  copyStyle: string;
  platform: "facebook" | "instagram" | "both";
};

export type RandomWorkflowOptions = {
  audiences: readonly string[];
  copyStyles: readonly string[];
  platforms: readonly RandomWorkflowChoice["platform"][];
  postTypes: readonly RandomWorkflowChoice["postType"][];
};

export const RANDOM_WORKFLOW_OPTIONS: RandomWorkflowOptions = {
  audiences: [
    "Parents booking birthday parties",
    "Churches and community groups",
    "Families looking for backyard fun",
    "Schools and daycares",
  ],
  copyStyles: [
    "Warm and helpful",
    "Energetic summer promo",
    "Clear and practical",
    "Playful and light",
  ],
  platforms: ["facebook", "instagram", "both"],
  postTypes: ["image", "video"],
};

export type SeededRng = () => number;

/** Mulberry32 — deterministic for tests. */
export function createSeededRng(seed: number): SeededRng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickOne<T>(items: readonly T[], rng: SeededRng): T {
  if (items.length === 0) {
    throw new Error("Cannot pick from an empty list.");
  }
  const index = Math.floor(rng() * items.length);
  return items[Math.min(items.length - 1, Math.max(0, index))]!;
}

export function listValidRandomAssets(): Array<{
  slug: string;
  title: string;
  imageUrl: string;
}> {
  const fromCatalog = RENTALS.filter(
    (rental) =>
      rental.categoryId !== "accessories" &&
      Boolean(rental.imageSrc?.trim()) &&
      Boolean(rental.slug?.trim()),
  ).map((rental) => ({
    slug: rental.slug,
    title: rental.title,
    imageUrl: rental.imageSrc,
  }));

  if (fromCatalog.length > 0) return fromCatalog;

  return SOCIAL_SOURCE_IMAGES.filter((image) => image.url).map((image, index) => ({
    slug: `source-image-${index}`,
    title: image.label,
    imageUrl: image.url,
  }));
}

export function buildRandomWorkflowSelection(
  rng: SeededRng = Math.random,
): RandomWorkflowChoice {
  const assets = listValidRandomAssets();
  const campaigns = SOCIAL_CAMPAIGNS.filter((campaign) => campaign.id);
  if (assets.length === 0) {
    throw new Error("No valid inventory assets available for random testing.");
  }
  if (campaigns.length === 0) {
    throw new Error("No valid campaigns available for random testing.");
  }

  const asset = pickOne(assets, rng);
  const campaign = pickOne(campaigns, rng);
  const postType = pickOne(RANDOM_WORKFLOW_OPTIONS.postTypes, rng);
  const platform = pickOne(RANDOM_WORKFLOW_OPTIONS.platforms, rng);
  const audience = pickOne(RANDOM_WORKFLOW_OPTIONS.audiences, rng);
  const copyStyle = pickOne(RANDOM_WORKFLOW_OPTIONS.copyStyles, rng);
  const visualConcept = pickOne(IMAGE_CONCEPT_IDS, rng);

  return {
    assetSlug: asset.slug,
    assetTitle: asset.title,
    assetImageUrl: asset.imageUrl,
    campaignId: campaign.id,
    campaignLabel: campaign.label,
    businessFocus: campaign.businessFocus,
    audience,
    postType,
    visualConcept,
    copyStyle,
    platform,
  };
}

export function isValidRandomWorkflowSelection(
  selection: RandomWorkflowChoice,
): boolean {
  const assets = listValidRandomAssets();
  const campaigns = SOCIAL_CAMPAIGNS;
  return (
    assets.some((asset) => asset.slug === selection.assetSlug) &&
    campaigns.some((campaign) => campaign.id === selection.campaignId) &&
    RANDOM_WORKFLOW_OPTIONS.audiences.includes(selection.audience) &&
    RANDOM_WORKFLOW_OPTIONS.copyStyles.includes(selection.copyStyle) &&
    RANDOM_WORKFLOW_OPTIONS.platforms.includes(selection.platform) &&
    RANDOM_WORKFLOW_OPTIONS.postTypes.includes(selection.postType) &&
    (IMAGE_CONCEPT_IDS as readonly string[]).includes(selection.visualConcept)
  );
}
