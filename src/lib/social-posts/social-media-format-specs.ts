/**
 * Canonical social media image/video format specs (2026).
 * Sources: Meta Instagram Graph API media specs, Facebook/Instagram creative guides, TikTok upload specs.
 */

export const SOCIAL_MEDIA_PLATFORMS = ["facebook", "instagram", "tiktok"] as const;
export type SocialMediaPlatform = (typeof SOCIAL_MEDIA_PLATFORMS)[number];

export const SOCIAL_MEDIA_PLACEMENTS = [
  "feed",
  "story",
  "reel",
  "carousel",
  "search",
] as const;
export type SocialMediaPlacement = (typeof SOCIAL_MEDIA_PLACEMENTS)[number];

export const SOCIAL_POST_PLACEMENTS = SOCIAL_MEDIA_PLACEMENTS;
export type SocialPostPlacement = SocialMediaPlacement;

export type SocialMediaFormatSpec = Readonly<{
  platform: SocialMediaPlatform;
  placement: SocialMediaPlacement;
  label: string;
  aspectRatio: string;
  recommendedWidth: number;
  recommendedHeight: number;
  ratioWidthOverHeight: number;
  ratioMin: number | null;
  ratioMax: number | null;
  replicateAspectRatio: string;
  adapterPostKind: string;
  notes: string;
}>;

const SPEC = (
  input: Omit<SocialMediaFormatSpec, "ratioWidthOverHeight"> & {
    ratioWidthOverHeight?: number;
  },
): SocialMediaFormatSpec => ({
  ...input,
  ratioWidthOverHeight:
    input.ratioWidthOverHeight ?? input.recommendedWidth / input.recommendedHeight,
});

/** Platform + placement format registry. */
export const SOCIAL_MEDIA_FORMAT_SPECS: readonly SocialMediaFormatSpec[] = [
  // Facebook
  SPEC({
    platform: "facebook",
    placement: "feed",
    label: "Facebook feed portrait",
    aspectRatio: "4:5",
    recommendedWidth: 1080,
    recommendedHeight: 1350,
    ratioMin: 0.8,
    ratioMax: 1.91,
    replicateAspectRatio: "4:5",
    adapterPostKind: "feed_post",
    notes: "Recommended feed portrait; also accepts 1:1 and 1.91:1 landscape.",
  }),
  SPEC({
    platform: "facebook",
    placement: "feed",
    label: "Facebook feed square",
    aspectRatio: "1:1",
    recommendedWidth: 1080,
    recommendedHeight: 1080,
    ratioMin: 0.8,
    ratioMax: 1.91,
    replicateAspectRatio: "1:1",
    adapterPostKind: "feed_post",
    notes: "Square feed alternative.",
  }),
  SPEC({
    platform: "facebook",
    placement: "story",
    label: "Facebook story",
    aspectRatio: "9:16",
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    ratioMin: 0.56,
    ratioMax: 0.56,
    replicateAspectRatio: "9:16",
    adapterPostKind: "story_post",
    notes: "Full-screen vertical story.",
  }),
  SPEC({
    platform: "facebook",
    placement: "reel",
    label: "Facebook reel",
    aspectRatio: "9:16",
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    ratioMin: 0.56,
    ratioMax: 0.56,
    replicateAspectRatio: "9:16",
    adapterPostKind: "feed_post",
    notes: "Reels use 9:16 video; cover may crop to 1:1 in feed.",
  }),
  SPEC({
    platform: "facebook",
    placement: "search",
    label: "Facebook search / in-feed ad",
    aspectRatio: "1:1",
    recommendedWidth: 1080,
    recommendedHeight: 1080,
    ratioMin: 1,
    ratioMax: 1.91,
    replicateAspectRatio: "1:1",
    adapterPostKind: "feed_post",
    notes: "Search placements accept 1:1 to 1.91:1.",
  }),
  // Instagram (Meta Graph API: feed images 4:5–1.91:1, stories/reels 9:16)
  SPEC({
    platform: "instagram",
    placement: "feed",
    label: "Instagram feed portrait",
    aspectRatio: "4:5",
    recommendedWidth: 1080,
    recommendedHeight: 1350,
    ratioMin: 0.8,
    ratioMax: 1.91,
    replicateAspectRatio: "4:5",
    adapterPostKind: "feed_post",
    notes: "Maximum feed presence; profile grid may crop to 3:4 center.",
  }),
  SPEC({
    platform: "instagram",
    placement: "feed",
    label: "Instagram feed tall (grid-safe)",
    aspectRatio: "3:4",
    recommendedWidth: 1080,
    recommendedHeight: 1440,
    ratioMin: 0.75,
    ratioMax: 1.91,
    replicateAspectRatio: "3:4",
    adapterPostKind: "feed_post",
    notes: "Matches profile grid crop without edge loss.",
  }),
  SPEC({
    platform: "instagram",
    placement: "feed",
    label: "Instagram feed square",
    aspectRatio: "1:1",
    recommendedWidth: 1080,
    recommendedHeight: 1080,
    ratioMin: 0.8,
    ratioMax: 1.91,
    replicateAspectRatio: "1:1",
    adapterPostKind: "feed_post",
    notes: "Classic square feed post.",
  }),
  SPEC({
    platform: "instagram",
    placement: "story",
    label: "Instagram story",
    aspectRatio: "9:16",
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    ratioMin: 0.56,
    ratioMax: 0.56,
    replicateAspectRatio: "9:16",
    adapterPostKind: "story_post",
    notes: "Full-screen vertical story.",
  }),
  SPEC({
    platform: "instagram",
    placement: "reel",
    label: "Instagram reel",
    aspectRatio: "9:16",
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    ratioMin: 0.56,
    ratioMax: 0.56,
    replicateAspectRatio: "9:16",
    adapterPostKind: "feed_post",
    notes: "Reels video 9:16; grid thumbnail may crop to 3:4.",
  }),
  SPEC({
    platform: "instagram",
    placement: "carousel",
    label: "Instagram carousel slide 1",
    aspectRatio: "4:5",
    recommendedWidth: 1080,
    recommendedHeight: 1350,
    ratioMin: 0.8,
    ratioMax: 1.91,
    replicateAspectRatio: "4:5",
    adapterPostKind: "feed_post",
    notes: "First slide sets carousel aspect ratio for all slides.",
  }),
  // TikTok
  SPEC({
    platform: "tiktok",
    placement: "feed",
    label: "TikTok feed / photo mode",
    aspectRatio: "9:16",
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    ratioMin: 0.56,
    ratioMax: 0.56,
    replicateAspectRatio: "9:16",
    adapterPostKind: "video_post",
    notes: "Vertical full-screen; keep key content in center safe zone.",
  }),
  SPEC({
    platform: "tiktok",
    placement: "story",
    label: "TikTok story",
    aspectRatio: "9:16",
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    ratioMin: 0.56,
    ratioMax: 0.56,
    replicateAspectRatio: "9:16",
    adapterPostKind: "video_post",
    notes: "Stories use same 9:16 canvas as feed video.",
  }),
  SPEC({
    platform: "tiktok",
    placement: "reel",
    label: "TikTok video",
    aspectRatio: "9:16",
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    ratioMin: 0.56,
    ratioMax: 0.56,
    replicateAspectRatio: "9:16",
    adapterPostKind: "video_post",
    notes: "Standard TikTok vertical video.",
  }),
  SPEC({
    platform: "tiktok",
    placement: "carousel",
    label: "TikTok photo carousel",
    aspectRatio: "9:16",
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    ratioMin: 0.56,
    ratioMax: 0.56,
    replicateAspectRatio: "9:16",
    adapterPostKind: "feed_post",
    notes: "Photo carousels use 9:16; 4:5 optional for text-heavy slides.",
  }),
] as const;

export type SocialMediaResolvedFormat = Readonly<{
  placement: SocialMediaPlacement;
  aspectRatio: string;
  recommendedWidth: number;
  recommendedHeight: number;
  replicateAspectRatio: string;
  framingLabel: string;
  supportedAspectRatios: readonly string[];
  platformSpecs: readonly SocialMediaFormatSpec[];
}>;

const DEFAULT_PLACEMENT: SocialMediaPlacement = "feed";

const PLACEMENT_DEFAULT_ASPECT: Readonly<Record<SocialMediaPlacement, string>> = {
  feed: "4:5",
  story: "9:16",
  reel: "9:16",
  carousel: "4:5",
  search: "1:1",
};

export function isSocialPostPlacement(value: string): value is SocialPostPlacement {
  return (SOCIAL_POST_PLACEMENTS as readonly string[]).includes(value);
}

export function normalizeSocialPostPlacement(
  value: string | null | undefined,
): SocialPostPlacement {
  return value && isSocialPostPlacement(value) ? value : DEFAULT_PLACEMENT;
}

export function getFormatSpecsForPlatformPlacement(
  platform: SocialMediaPlatform,
  placement: SocialMediaPlacement,
): readonly SocialMediaFormatSpec[] {
  return SOCIAL_MEDIA_FORMAT_SPECS.filter(
    (spec) => spec.platform === platform && spec.placement === placement,
  );
}

export function getPrimaryFormatSpec(
  platform: SocialMediaPlatform,
  placement: SocialMediaPlacement,
  preferredAspectRatio?: string | null,
): SocialMediaFormatSpec | null {
  const matches = getFormatSpecsForPlatformPlacement(platform, placement);
  if (matches.length === 0) return null;
  if (preferredAspectRatio) {
    const preferred = matches.find((spec) => spec.aspectRatio === preferredAspectRatio);
    if (preferred) return preferred;
  }
  const defaultAspect = PLACEMENT_DEFAULT_ASPECT[placement];
  return matches.find((spec) => spec.aspectRatio === defaultAspect) ?? matches[0] ?? null;
}

export function resolveSocialMediaFormat(input: {
  platforms: readonly string[];
  placement?: string | null;
  preferredAspectRatio?: string | null;
}): SocialMediaResolvedFormat {
  const placement = normalizeSocialPostPlacement(input.placement);
  const normalizedPlatforms = input.platforms.filter((platform): platform is SocialMediaPlatform =>
    (SOCIAL_MEDIA_PLATFORMS as readonly string[]).includes(platform),
  );
  const platforms =
    normalizedPlatforms.length > 0
      ? normalizedPlatforms
      : (["facebook", "instagram"] as const);

  const platformSpecs = platforms
    .map((platform) => getPrimaryFormatSpec(platform, placement, input.preferredAspectRatio))
    .filter((spec): spec is SocialMediaFormatSpec => spec !== null);

  const primary =
    platformSpecs.find((spec) => spec.aspectRatio === PLACEMENT_DEFAULT_ASPECT[placement]) ??
    platformSpecs[0] ??
    getPrimaryFormatSpec("instagram", placement, input.preferredAspectRatio)!;

  const supportedAspectRatios = [
    ...new Set(platformSpecs.map((spec) => spec.aspectRatio)),
  ] as string[];

  return {
    placement,
    aspectRatio: primary.aspectRatio,
    recommendedWidth: primary.recommendedWidth,
    recommendedHeight: primary.recommendedHeight,
    replicateAspectRatio: primary.replicateAspectRatio,
    framingLabel: primary.label,
    supportedAspectRatios,
    platformSpecs,
  };
}

export function getPublicationTargetAspectRatiosForPlacement(
  placement: SocialMediaPlacement,
): readonly string[] {
  switch (placement) {
    case "feed":
      return ["1:1", "4:5", "3:4", "16:9"];
    case "story":
    case "reel":
      return ["9:16"];
    case "carousel":
      return ["1:1", "4:5", "3:4", "9:16"];
    case "search":
      return ["1:1", "16:9"];
    default:
      return ["1:1", "4:5", "9:16"];
  }
}

export function aspectRatioWithinSpec(
  aspectRatio: string,
  spec: SocialMediaFormatSpec,
): boolean {
  if (aspectRatio === spec.aspectRatio) return true;
  if (spec.ratioMin === null || spec.ratioMax === null) return false;

  const [widthPart, heightPart] = aspectRatio.split(":").map(Number);
  if (!widthPart || !heightPart) return false;
  const ratio = widthPart / heightPart;
  return ratio >= spec.ratioMin && ratio <= spec.ratioMax;
}

export function formatDimensionsLabel(format: SocialMediaResolvedFormat): string {
  return `${format.recommendedWidth}×${format.recommendedHeight} (${format.aspectRatio})`;
}
