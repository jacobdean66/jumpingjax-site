import type { SocialMediaPlacement, SocialMediaPlatform } from "./social-media-format-specs";
import { normalizeSocialPostPlacement } from "./social-media-format-specs";

export type SocialMediaFormatVariantId =
  | "feed_portrait_4_5"
  | "feed_square_1_1"
  | "feed_tall_3_4"
  | "feed_landscape_16_9"
  | "story_vertical_9_16"
  | "reel_vertical_9_16"
  | "carousel_portrait_4_5"
  | "carousel_vertical_9_16"
  | "search_square_1_1"
  | "search_landscape_16_9";

export type SocialMediaFormatVariant = Readonly<{
  id: SocialMediaFormatVariantId;
  placement: SocialMediaPlacement;
  label: string;
  aspectRatio: string;
  recommendedWidth: number;
  recommendedHeight: number;
  replicateAspectRatio: string;
  compositionGuidance: string;
  allowedPlatforms: readonly SocialMediaPlatform[];
}>;

export const SOCIAL_MEDIA_FORMAT_VARIANTS: readonly SocialMediaFormatVariant[] = [
  {
    id: "feed_portrait_4_5",
    placement: "feed",
    label: "Feed portrait (4:5)",
    aspectRatio: "4:5",
    recommendedWidth: 1080,
    recommendedHeight: 1350,
    replicateAspectRatio: "4:5",
    compositionGuidance:
      "Center the full inflatable in frame with safe margins on all sides. Keep faces and product details away from the top and bottom 12% — Instagram may crop the profile grid to 3:4.",
    allowedPlatforms: ["facebook", "instagram", "tiktok"],
  },
  {
    id: "feed_square_1_1",
    placement: "feed",
    label: "Feed square (1:1)",
    aspectRatio: "1:1",
    recommendedWidth: 1080,
    recommendedHeight: 1080,
    replicateAspectRatio: "1:1",
    compositionGuidance:
      "Center the inflatable as the hero subject in a balanced square frame. Leave breathing room on all four sides.",
    allowedPlatforms: ["facebook", "instagram", "tiktok"],
  },
  {
    id: "feed_tall_3_4",
    placement: "feed",
    label: "Feed tall / grid-safe (3:4)",
    aspectRatio: "3:4",
    recommendedWidth: 1080,
    recommendedHeight: 1440,
    replicateAspectRatio: "3:4",
    compositionGuidance:
      "Compose for Instagram profile grid safety — keep the inflatable and any faces inside the central 3:4 area with minimal edge risk.",
    allowedPlatforms: ["instagram", "facebook"],
  },
  {
    id: "feed_landscape_16_9",
    placement: "feed",
    label: "Feed landscape (1.91:1)",
    aspectRatio: "16:9",
    recommendedWidth: 1080,
    recommendedHeight: 566,
    replicateAspectRatio: "16:9",
    compositionGuidance:
      "Wide cinematic framing with the inflatable clearly visible across the horizontal center. Avoid tall vertical subjects that will be cropped.",
    allowedPlatforms: ["facebook", "instagram"],
  },
  {
    id: "story_vertical_9_16",
    placement: "story",
    label: "Vertical full-screen (9:16)",
    aspectRatio: "9:16",
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    replicateAspectRatio: "9:16",
    compositionGuidance:
      "Full vertical frame. Keep the inflatable and faces in the center safe zone — avoid the top 10% and bottom 18% where platform UI overlays appear.",
    allowedPlatforms: ["facebook", "instagram", "tiktok"],
  },
  {
    id: "reel_vertical_9_16",
    placement: "reel",
    label: "Reel vertical (9:16)",
    aspectRatio: "9:16",
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    replicateAspectRatio: "9:16",
    compositionGuidance:
      "Reel cover/video frame at 9:16. Place title and hero subject vertically centered — profile grid may crop to 3:4.",
    allowedPlatforms: ["facebook", "instagram", "tiktok"],
  },
  {
    id: "carousel_portrait_4_5",
    placement: "carousel",
    label: "Carousel slide 1 (4:5)",
    aspectRatio: "4:5",
    recommendedWidth: 1080,
    recommendedHeight: 1350,
    replicateAspectRatio: "4:5",
    compositionGuidance:
      "First carousel slide sets the ratio for all slides. Center the inflatable with safe margins.",
    allowedPlatforms: ["facebook", "instagram", "tiktok"],
  },
  {
    id: "carousel_vertical_9_16",
    placement: "carousel",
    label: "Carousel vertical (9:16)",
    aspectRatio: "9:16",
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    replicateAspectRatio: "9:16",
    compositionGuidance:
      "Vertical carousel slide — keep subject in the center safe zone.",
    allowedPlatforms: ["instagram", "tiktok"],
  },
  {
    id: "search_square_1_1",
    placement: "search",
    label: "Search / ad square (1:1)",
    aspectRatio: "1:1",
    recommendedWidth: 1080,
    recommendedHeight: 1080,
    replicateAspectRatio: "1:1",
    compositionGuidance:
      "Square ad creative with a clear product hero and no small text that could be cropped away.",
    allowedPlatforms: ["facebook", "instagram"],
  },
  {
    id: "search_landscape_16_9",
    placement: "search",
    label: "Search / ad landscape (1.91:1)",
    aspectRatio: "16:9",
    recommendedWidth: 1080,
    recommendedHeight: 566,
    replicateAspectRatio: "16:9",
    compositionGuidance:
      "Horizontal ad placement — keep the inflatable fully visible across the wide frame.",
    allowedPlatforms: ["facebook", "instagram"],
  },
] as const;

export type SocialMediaDisplayCrop = Readonly<{
  platform: SocialMediaPlatform;
  surface: string;
  aspectRatio: string;
  widthFraction: number;
  heightFraction: number;
  xFraction: number;
  yFraction: number;
  description: string;
}>;

const VERTICAL_SAFE_ZONE = {
  topFraction: 0.1,
  bottomFraction: 0.18,
  leftFraction: 0.06,
  rightFraction: 0.12,
} as const;

export function getFormatVariantsForPlacement(
  placement: SocialMediaPlacement,
): readonly SocialMediaFormatVariant[] {
  const seen = new Set<SocialMediaFormatVariantId>();
  return SOCIAL_MEDIA_FORMAT_VARIANTS.filter((variant) => {
    if (variant.placement !== placement) return false;
    if (seen.has(variant.id)) return false;
    seen.add(variant.id);
    return true;
  });
}

export function getDefaultFormatVariantId(
  placement: SocialMediaPlacement,
): SocialMediaFormatVariantId {
  switch (placement) {
    case "story":
      return "story_vertical_9_16";
    case "reel":
      return "reel_vertical_9_16";
    case "search":
      return "search_square_1_1";
    case "carousel":
      return "carousel_portrait_4_5";
    case "feed":
    default:
      return "feed_portrait_4_5";
  }
}

export function isSocialMediaFormatVariantId(
  value: string,
): value is SocialMediaFormatVariantId {
  return SOCIAL_MEDIA_FORMAT_VARIANTS.some((variant) => variant.id === value);
}

export function normalizeFormatVariantId(
  placement: SocialMediaPlacement,
  value: string | null | undefined,
): SocialMediaFormatVariantId {
  if (value && isSocialMediaFormatVariantId(value)) {
    const match = SOCIAL_MEDIA_FORMAT_VARIANTS.find((variant) => variant.id === value);
    if (match && match.placement === placement) {
      return value;
    }
  }
  return getDefaultFormatVariantId(placement);
}

export function getFormatVariantById(
  variantId: SocialMediaFormatVariantId,
): SocialMediaFormatVariant {
  const match = SOCIAL_MEDIA_FORMAT_VARIANTS.find((variant) => variant.id === variantId);
  if (!match) {
    throw new Error(`Unknown format variant: ${variantId}`);
  }
  return match;
}

export function getPlatformDisplayCrops(input: {
  platform: SocialMediaPlatform;
  placement: SocialMediaPlacement;
  variant: SocialMediaFormatVariant;
}): readonly SocialMediaDisplayCrop[] {
  const crops: SocialMediaDisplayCrop[] = [];

  if (input.placement === "feed" && input.variant.aspectRatio === "4:5") {
    if (input.platform === "instagram") {
      crops.push({
        platform: "instagram",
        surface: "profile_grid",
        aspectRatio: "3:4",
        widthFraction: 1,
        heightFraction: 0.8,
        xFraction: 0,
        yFraction: 0.1,
        description: "Instagram profile grid center-crops 4:5 feed posts to 3:4.",
      });
    }
  }

  if (input.placement === "reel" && input.variant.aspectRatio === "9:16") {
    crops.push({
      platform: input.platform,
      surface: "profile_grid",
      aspectRatio: "3:4",
      widthFraction: 1,
      heightFraction: 0.75,
      xFraction: 0,
      yFraction: 0.125,
      description: "Reel covers may be center-cropped on the profile grid.",
    });
  }

  if (input.variant.aspectRatio === "9:16") {
    crops.push({
      platform: input.platform,
      surface: "safe_zone",
      aspectRatio: "9:16",
      widthFraction: 1 - VERTICAL_SAFE_ZONE.leftFraction - VERTICAL_SAFE_ZONE.rightFraction,
      heightFraction: 1 - VERTICAL_SAFE_ZONE.topFraction - VERTICAL_SAFE_ZONE.bottomFraction,
      xFraction: VERTICAL_SAFE_ZONE.leftFraction,
      yFraction: VERTICAL_SAFE_ZONE.topFraction,
      description: "Keep faces and the inflatable inside this safe zone.",
    });
  }

  return crops;
}

export function getVerticalSafeZone() {
  return VERTICAL_SAFE_ZONE;
}

export function formatVariantDimensionsLabel(
  variant: Pick<SocialMediaFormatVariant, "recommendedWidth" | "recommendedHeight" | "aspectRatio">,
): string {
  return `${variant.recommendedWidth}×${variant.recommendedHeight} (${variant.aspectRatio})`;
}

export function resolvePostMediaFormat(input: {
  platforms: readonly string[];
  placement?: string | null;
  formatVariantId?: string | null;
}): Readonly<{
  placement: SocialMediaPlacement;
  variantId: SocialMediaFormatVariantId;
  variant: SocialMediaFormatVariant;
  aspectRatio: string;
  recommendedWidth: number;
  recommendedHeight: number;
  replicateAspectRatio: string;
  framingLabel: string;
  compositionGuidance: string;
  variantOptions: readonly SocialMediaFormatVariant[];
}> {
  const placement = normalizeSocialPostPlacement(input.placement);
  const variantId = normalizeFormatVariantId(placement, input.formatVariantId);
  const variant = getFormatVariantById(variantId);

  return {
    placement,
    variantId,
    variant,
    aspectRatio: variant.aspectRatio,
    recommendedWidth: variant.recommendedWidth,
    recommendedHeight: variant.recommendedHeight,
    replicateAspectRatio: variant.replicateAspectRatio,
    framingLabel: variant.label,
    compositionGuidance: variant.compositionGuidance,
    variantOptions: getFormatVariantsForPlacement(placement),
  };
}
