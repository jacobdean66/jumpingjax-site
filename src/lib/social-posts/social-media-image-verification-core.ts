import {
  getFormatVariantById,
  getPlatformDisplayCrops,
  normalizeFormatVariantId,
  type SocialMediaDisplayCrop,
  type SocialMediaFormatVariant,
  type SocialMediaFormatVariantId,
} from "./social-media-format-variants";
import {
  normalizeSocialPostPlacement,
  type SocialMediaPlacement,
  type SocialMediaPlatform,
} from "./social-media-format-specs";

export type SocialMediaImageVerificationCode =
  | "image_unreachable"
  | "dimensions_unknown"
  | "aspect_ratio_mismatch"
  | "below_minimum_width"
  | "below_minimum_height"
  | "likely_blank_or_solid"
  | "likely_letterboxed"
  | "platform_crop_risk"
  | "safe_zone_violation_risk";

export type SocialMediaImageVerificationIssue = Readonly<{
  code: SocialMediaImageVerificationCode;
  severity: "error" | "warning";
  message: string;
}>;

export type SocialMediaImageContentSignals = Readonly<{
  luminanceMean: number;
  luminanceStdDev: number;
  likelyBlankOrSolid: boolean;
  likelyLetterboxed: boolean;
}>;

export type SocialMediaImageVerificationResult = Readonly<{
  ok: boolean;
  width: number;
  height: number;
  actualAspectRatio: string;
  expectedVariant: SocialMediaFormatVariant;
  issues: readonly SocialMediaImageVerificationIssue[];
  contentSignals: SocialMediaImageContentSignals | null;
  platformCrops: readonly SocialMediaDisplayCrop[];
}>;

const MIN_WIDTH = 800;
const MIN_HEIGHT = 800;
const ASPECT_RATIO_TOLERANCE = 0.06;

export function parseAspectRatioString(value: string): number | null {
  const [widthPart, heightPart] = value.split(":").map(Number);
  if (!widthPart || !heightPart) return null;
  return widthPart / heightPart;
}

export function formatActualAspectRatio(width: number, height: number): string {
  if (width <= 0 || height <= 0) return "unknown";
  const ratio = width / height;
  const candidates = [
    ["1:1", 1],
    ["4:5", 4 / 5],
    ["3:4", 3 / 4],
    ["9:16", 9 / 16],
    ["16:9", 16 / 9],
  ] as const;

  let best: (typeof candidates)[number] = candidates[0];
  let bestDelta = Math.abs(ratio - best[1]);
  for (const candidate of candidates.slice(1)) {
    const delta = Math.abs(ratio - candidate[1]);
    if (delta < bestDelta) {
      best = candidate;
      bestDelta = delta;
    }
  }
  return best[0];
}

export function verifyImageDimensionsAgainstVariant(input: {
  width: number;
  height: number;
  variant: SocialMediaFormatVariant;
  platforms: readonly string[];
  placement: SocialMediaPlacement;
}): SocialMediaImageVerificationResult {
  const issues: SocialMediaImageVerificationIssue[] = [];
  const { width, height, variant } = input;
  const actualAspectRatio = formatActualAspectRatio(width, height);
  const expectedRatio = parseAspectRatioString(variant.aspectRatio);
  const actualRatio = width > 0 && height > 0 ? width / height : null;

  if (width < MIN_WIDTH) {
    issues.push({
      code: "below_minimum_width",
      severity: "warning",
      message: `Image width ${width}px is below the ${MIN_WIDTH}px minimum for sharp feed delivery.`,
    });
  }

  if (height < MIN_HEIGHT) {
    issues.push({
      code: "below_minimum_height",
      severity: "warning",
      message: `Image height ${height}px is below the ${MIN_HEIGHT}px minimum for sharp feed delivery.`,
    });
  }

  if (expectedRatio && actualRatio) {
    const delta = Math.abs(actualRatio - expectedRatio) / expectedRatio;
    if (delta > ASPECT_RATIO_TOLERANCE) {
      issues.push({
        code: "aspect_ratio_mismatch",
        severity: "error",
        message: `Image is ${actualAspectRatio} (${width}×${height}) but ${variant.label} requires ${variant.aspectRatio} (${variant.recommendedWidth}×${variant.recommendedHeight}). Platforms will crop or letterbox the creative.`,
      });
    }
  }

  const platforms = input.platforms.filter((platform): platform is SocialMediaPlatform =>
    ["facebook", "instagram", "tiktok"].includes(platform),
  );

  const platformCrops = platforms.flatMap((platform) =>
    getPlatformDisplayCrops({ platform, placement: input.placement, variant }),
  );

  if (
    issues.some((issue) => issue.code === "aspect_ratio_mismatch") &&
    platformCrops.length > 0
  ) {
    issues.push({
      code: "platform_crop_risk",
      severity: "error",
      message:
        "Wrong aspect ratio — platform previews may crop out the inflatable and leave empty margins or clipped text.",
    });
  } else if (platformCrops.some((crop) => crop.surface === "profile_grid")) {
    issues.push({
      code: "platform_crop_risk",
      severity: "warning",
      message:
        "Profile/grid surfaces may center-crop this placement. Keep the inflatable and faces in the middle of the frame.",
    });
  }

  const blocking = issues.some((issue) => issue.severity === "error");

  return {
    ok: !blocking,
    width,
    height,
    actualAspectRatio,
    expectedVariant: variant,
    issues,
    contentSignals: null,
    platformCrops,
  };
}

export function mergeContentSignals(
  result: SocialMediaImageVerificationResult,
  signals: SocialMediaImageContentSignals,
): SocialMediaImageVerificationResult {
  const issues = [...result.issues];

  if (signals.likelyBlankOrSolid) {
    issues.push({
      code: "likely_blank_or_solid",
      severity: "error",
      message:
        "Image looks blank or nearly solid — generation may have failed or produced an empty frame instead of a photo.",
    });
  }

  if (signals.likelyLetterboxed) {
    issues.push({
      code: "likely_letterboxed",
      severity: "error",
      message:
        "Large empty borders detected — the inflatable may appear tiny after platform cropping instead of filling the feed.",
    });
  }

  return {
    ...result,
    ok: !issues.some((issue) => issue.severity === "error"),
    contentSignals: signals,
    issues,
  };
}

export function resolveVerificationTarget(input: {
  placement?: string | null;
  formatVariantId?: string | null;
  platforms: readonly string[];
}): Readonly<{
  placement: SocialMediaPlacement;
  variant: SocialMediaFormatVariant;
  variantId: SocialMediaFormatVariantId;
}> {
  const placement = normalizeSocialPostPlacement(input.placement);
  const variantId = normalizeFormatVariantId(placement, input.formatVariantId);
  return {
    placement,
    variantId,
    variant: getFormatVariantById(variantId),
  };
}
