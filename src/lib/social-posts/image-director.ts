/**
 * Image Director — still-image prompt planning only.
 * No video motion, camera, or animation instructions belong here.
 */

import {
  formatVariantDimensionsLabel,
  resolvePostMediaFormat,
} from "./social-media-format-variants";
import { verifyImageDimensionsAgainstVariant } from "./social-media-image-verification-core";

export type ImageStudioPreset =
  | "original-rental-photo"
  | "kids-playing"
  | "parents-watching"
  | "birthday-party"
  | "church-event"
  | "backyard-party"
  | "toddler-play"
  | "commercial-hero-shot"
  | "comedy"
  | "custom";

/** @deprecated Use ImageStudioPreset — kept for API backward compatibility */
export type ImageDirectionPreset = ImageStudioPreset;

export type ImageStudioPresetOption = {
  id: ImageStudioPreset;
  label: string;
};

export const IMAGE_STUDIO_PRESETS: ImageStudioPresetOption[] = [
  { id: "original-rental-photo", label: "Original Rental Photo" },
  { id: "kids-playing", label: "Kids Playing" },
  { id: "parents-watching", label: "Parents Watching" },
  { id: "birthday-party", label: "Birthday Party" },
  { id: "church-event", label: "Church Event" },
  { id: "backyard-party", label: "Backyard Party" },
  { id: "toddler-play", label: "Toddler Play" },
  { id: "commercial-hero-shot", label: "Commercial Hero Shot" },
  { id: "comedy", label: "Comedy" },
  { id: "custom", label: "Custom" },
];

export const IMAGE_DIRECTION_PRESETS = IMAGE_STUDIO_PRESETS;

export const IMAGE_STUDIO_PRESET_LABELS: Record<ImageStudioPreset, string> =
  Object.fromEntries(
    IMAGE_STUDIO_PRESETS.map((preset) => [preset.id, preset.label]),
  ) as Record<ImageStudioPreset, string>;

export const IMAGE_DIRECTION_PRESET_LABELS = IMAGE_STUDIO_PRESET_LABELS;

export type ImageConceptId = "A" | "B" | "C" | "D";

export const IMAGE_CONCEPT_IDS: ImageConceptId[] = ["A", "B", "C", "D"];

export type ImageDirectorInput = {
  originalSourceImageUrl: string | null;
  campaignName: string | null;
  postPrompt: string;
  sourceImageCategory: string | null;
  imageStudioPreset: ImageStudioPreset;
  platforms?: readonly string[];
  postPlacement?: string | null;
  formatVariantId?: string | null;
  /** Saved owner creative preferences already formatted for the prompt. */
  creativePreferenceBlock?: string | null;
  /** One-shot feedback for this regeneration only (not saved). */
  oneShotFeedback?: string | null;
  /** @deprecated */
  imageDirectionPreset?: ImageStudioPreset;
};

export type ImageDirectorOutput = {
  prompt: string;
};

export type ImageQualityWarningCode =
  | "no-children-detected"
  | "children-too-old"
  | "inflatable-hidden"
  | "bad-composition"
  | "low-resolution"
  | "faces-distorted"
  | "unsafe-positioning"
  | "background-clutter"
  | "aspect-ratio-mismatch"
  | "platform-crop-risk"
  | "likely-blank-or-solid"
  | "likely-letterboxed";

export type ImageQualityWarning = {
  code: ImageQualityWarningCode;
  message: string;
};

export type ImageDirectorCostEstimate = {
  previewUsd: number;
  imageGenerationUsd: number;
  totalUsd: number;
  notes: string[];
};

const LEGACY_PRESET_MAP: Record<string, ImageStudioPreset> = {
  "keep-original": "original-rental-photo",
  "add-child-at-top": "toddler-play",
  "add-child-sliding-down": "kids-playing",
  "add-splash-at-bottom": "kids-playing",
  "product-hero-shot": "commercial-hero-shot",
  "backyard-lifestyle-scene": "backyard-party",
  "clean-product-background": "original-rental-photo",
  "facebook-ad-starting-frame": "commercial-hero-shot",
};

const CHILD_EXPECTING_PRESETS = new Set<ImageStudioPreset>([
  "kids-playing",
  "parents-watching",
  "birthday-party",
  "backyard-party",
  "toddler-play",
  "comedy",
]);

type ImageDirectorFormat = Readonly<{
  framingLabel: string;
  recommendedWidth: number;
  recommendedHeight: number;
  aspectRatio: string;
  compositionGuidance: string;
}>;

function stillImageSuffix(format: ImageDirectorFormat): string {
  return `${format.compositionGuidance} Photorealistic still photograph for ${format.framingLabel} (${formatVariantDimensionsLabel(format)}). No text, logos, watermarks, or captions. No motion blur, no video frames, no animation.`;
}

function resolveImageDirectorFormat(input: ImageDirectorInput): ImageDirectorFormat {
  const resolved = resolvePostMediaFormat({
    platforms: input.platforms ?? ["facebook", "instagram"],
    placement: input.postPlacement,
    formatVariantId: input.formatVariantId,
  });
  return resolved;
}

const PRESET_PROMPTS: Record<Exclude<ImageStudioPreset, "custom">, string> = {
  "original-rental-photo":
    "A photorealistic still of the exact inflatable rental from the source image, preserved with the same colors, shape, vinyl details, slide lanes, and pool. Clean backyard daylight, premium product clarity, no added people unless already present.",
  "kids-playing":
    "A realistic still photograph of young children ages 3–7 with proper child-sized bodies playing safely on the exact inflatable from the source image. Supervised backyard fun, bright summer colors, natural smiles, the inflatable unchanged in color and shape.",
  "parents-watching":
    "A realistic still photograph of parents watching young children ages 3–7 with child-sized bodies play safely on the exact inflatable from the source image. Warm family energy, sunny backyard, the inflatable preserved exactly as shown.",
  "birthday-party":
    "A realistic still photograph of a cheerful backyard birthday party with young children ages 3–7 and child-sized bodies near the exact inflatable from the source image. Colorful party atmosphere, balloons optional, supervised play, inflatable details preserved.",
  "church-event":
    "A realistic still photograph of a wholesome church family event with young children ages 3–7 and child-sized bodies enjoying the exact inflatable from the source image. Friendly community energy, modest summer clothing, supervised play, inflatable unchanged.",
  "backyard-party":
    "A realistic still photograph of a lively backyard party with young children ages 3–7 and child-sized bodies around the exact inflatable from the source image. Green lawn, fence or trees softly in the background, vibrant summer daylight, inflatable preserved.",
  "toddler-play":
    "A realistic still photograph of a 3–4 year old child with proper toddler proportions at the top of the exact inflatable waterslide from the source image, smiling naturally, sunny backyard, parents watching nearby, inflatable colors and shape preserved.",
  "commercial-hero-shot":
    "A premium commercial hero still of the exact inflatable from the source image, crisp product detail, clean composition, bright natural light, scroll-stopping framing, minimal distraction.",
  comedy:
    "A playful but realistic still photograph with young children ages 3–7 and child-sized bodies having wholesome funny moments on the exact inflatable from the source image. Lighthearted energy, safe supervised play, inflatable preserved exactly.",
};

const CONCEPT_VARIATIONS: Record<ImageConceptId, string> = {
  A: "Primary composition with balanced framing.",
  B: "Slightly warmer golden-hour lighting and softer background depth.",
  C: "Wider framing that shows more of the backyard environment.",
  D: "Closer emphasis on faces and inflatable hero details with vibrant color.",
};

function normalizeImageStudioPreset(
  value: ImageStudioPreset | string | null | undefined,
): ImageStudioPreset {
  if (value && IMAGE_STUDIO_PRESETS.some((preset) => preset.id === value)) {
    return value as ImageStudioPreset;
  }
  if (value && LEGACY_PRESET_MAP[value]) {
    return LEGACY_PRESET_MAP[value];
  }
  return "original-rental-photo";
}

function categoryContext(category: string | null): string {
  if (!category?.trim()) return "";
  return `The source image category is ${category.trim()}.`;
}

function campaignContext(campaignName: string | null): string {
  if (!campaignName?.trim()) return "";
  return `Campaign theme: ${campaignName.trim()}.`;
}

function feedbackContext(input: ImageDirectorInput): string {
  const parts = [
    input.creativePreferenceBlock?.trim() || null,
    input.oneShotFeedback?.trim()
      ? `One-shot owner feedback for this generation only: ${input.oneShotFeedback.trim()}`
      : null,
  ].filter(Boolean);
  return parts.join(" ");
}

function buildCustomPrompt(
  input: ImageDirectorInput,
  format: ImageDirectorFormat,
): string {
  const brief = input.postPrompt.trim();
  const parts = [
    brief ||
      "Create a family-friendly photorealistic still image for a Jumping Jax inflatable rental social ad.",
    categoryContext(input.sourceImageCategory),
    campaignContext(input.campaignName),
    "Preserve the exact inflatable from the source image — same product, colors, shape, and visible details.",
    feedbackContext(input),
    stillImageSuffix(format),
  ].filter(Boolean);
  return parts.join(" ");
}

export function buildImageDirectorPrompt(input: ImageDirectorInput): ImageDirectorOutput {
  const preset = normalizeImageStudioPreset(
    input.imageStudioPreset ?? input.imageDirectionPreset,
  );
  const format = resolveImageDirectorFormat(input);

  if (preset === "custom") {
    return { prompt: buildCustomPrompt(input, format) };
  }

  const parts = [
    PRESET_PROMPTS[preset],
    categoryContext(input.sourceImageCategory),
    campaignContext(input.campaignName),
    feedbackContext(input),
    stillImageSuffix(format),
  ].filter(Boolean);

  return { prompt: parts.join(" ") };
}

export function buildConceptPrompt(
  basePrompt: string,
  conceptId: ImageConceptId,
): string {
  const cleaned = basePrompt.trim();
  if (!cleaned) return cleaned;
  return `${cleaned} ${CONCEPT_VARIATIONS[conceptId]}`;
}

export function getImageQualityWarnings(input: {
  prompt: string;
  sourceImageCategory: string | null;
  imageStudioPreset: ImageStudioPreset;
  platforms?: readonly string[];
  postPlacement?: string | null;
  formatVariantId?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
}): ImageQualityWarning[] {
  const warnings: ImageQualityWarning[] = [];
  const prompt = input.prompt;
  const promptLower = prompt.toLowerCase();
  const preset = normalizeImageStudioPreset(input.imageStudioPreset);

  if (
    CHILD_EXPECTING_PRESETS.has(preset) &&
    !/child|kid|children|toddler|preschool|family/.test(promptLower)
  ) {
    warnings.push({
      code: "no-children-detected",
      message: "No children detected — this preset expects kids in the still image.",
    });
  }

  if (
    /ages?\s*(8|9|10|11|12|13|teen|preteen)|older child|adult-sized child|grown kid/.test(
      promptLower,
    )
  ) {
    warnings.push({
      code: "children-too-old",
      message: "Children appear too old — keep subjects around ages 3–7.",
    });
  }

  if (/hidden inflatable|partially obscured|blocked slide|cut off inflatable/.test(promptLower)) {
    warnings.push({
      code: "inflatable-hidden",
      message: "Inflatable partially hidden — preserve the full rental unit.",
    });
  }

  if (/awkward crop|off-center product|cluttered framing|poor composition/.test(promptLower)) {
    warnings.push({
      code: "bad-composition",
      message: "Bad composition — center the inflatable with clean vertical framing.",
    });
  }

  const width = input.imageWidth ?? 0;
  const height = input.imageHeight ?? 0;
  if ((width > 0 && width < 800) || (height > 0 && height < 800)) {
    warnings.push({
      code: "low-resolution",
      message: `Low resolution (${width || "?"} × ${height || "?"}) — higher source images produce better edits.`,
    });
  }

  if (width > 0 && height > 0 && input.postPlacement) {
    const mediaFormat = resolvePostMediaFormat({
      platforms: input.platforms ?? ["facebook", "instagram"],
      placement: input.postPlacement,
      formatVariantId: input.formatVariantId,
    });
    const dimensionCheck = verifyImageDimensionsAgainstVariant({
      width,
      height,
      variant: mediaFormat.variant,
      platforms: input.platforms ?? ["facebook", "instagram"],
      placement: mediaFormat.placement,
    });
    for (const issue of dimensionCheck.issues) {
      if (issue.code === "aspect_ratio_mismatch") {
        warnings.push({
          code: "aspect-ratio-mismatch",
          message: issue.message,
        });
      } else if (issue.code === "platform_crop_risk") {
        warnings.push({
          code: "platform-crop-risk",
          message: issue.message,
        });
      }
    }
  }

  if (/distort|warped face|melted face|extra limb|deformed/.test(promptLower)) {
    warnings.push({
      code: "faces-distorted",
      message: "Faces distorted — keep natural child proportions and realistic faces.",
    });
  }

  if (/unsafe|unsupervised|standing on edge|climbing railing|dangerous/.test(promptLower)) {
    warnings.push({
      code: "unsafe-positioning",
      message: "Unsafe positioning — show supervised, age-appropriate play only.",
    });
  }

  if (/cluttered background|messy yard|distracting objects|busy background/.test(promptLower)) {
    warnings.push({
      code: "background-clutter",
      message: "Background clutter — simplify the scene around the inflatable.",
    });
  }

  return warnings;
}

export function getImageDirectorSafetyWarnings(input: {
  prompt: string;
  sourceImageCategory: string | null;
  originalSourceImageUrl: string | null;
  imageStudioPreset?: ImageStudioPreset;
  imageDirectionPreset?: ImageStudioPreset;
}): string[] {
  const warnings: string[] = [];
  const promptLower = input.prompt.toLowerCase();

  if (!input.originalSourceImageUrl?.trim()) {
    warnings.push("No source image URL is configured for image generation.");
  }

  if (/\b(video|motion|camera move|pan|tracking shot|slow motion|animate)\b/.test(promptLower)) {
    warnings.push(
      "Prompt contains video or motion language — Image Studio prompts must describe a still photograph only.",
    );
  }

  if (/\b(text overlay|watermark|logo on|caption on|sign with text)\b/.test(promptLower)) {
    warnings.push("Prompt may add text or logos — still frames should stay text-free.");
  }

  const quality = getImageQualityWarnings({
    prompt: input.prompt,
    sourceImageCategory: input.sourceImageCategory,
    imageStudioPreset:
      input.imageStudioPreset ??
      input.imageDirectionPreset ??
      "original-rental-photo",
  });

  return [...warnings, ...quality.map((item) => item.message)];
}

export function estimateImageDirectorCost(
  conceptCount = 4,
  providerId?: string,
): ImageDirectorCostEstimate {
  const perImageUsd = 0.08;
  const previewUsd = 0;
  const imageGenerationUsd = perImageUsd * conceptCount;
  const providerLabel = providerId?.trim() || "default configured provider";

  return {
    previewUsd,
    imageGenerationUsd,
    totalUsd: previewUsd + imageGenerationUsd,
    notes: [
      "Preview cost is $0 — prompt planning only.",
      `Image concepts use the configured provider (${providerLabel}) via the Image Engine adapter.`,
      `Estimate assumes ${conceptCount} concept generations at ~$${perImageUsd.toFixed(2)} each.`,
      "Swap providers through IMAGE_PROVIDER without UI changes.",
    ],
  };
}

export function normalizeImageStudioPresetValue(
  value: string | null | undefined,
): ImageStudioPreset {
  return normalizeImageStudioPreset(value);
}

/** @deprecated */
export function normalizeImageDirectionPresetValue(
  value: string | null | undefined,
): ImageStudioPreset {
  return normalizeImageStudioPreset(value);
}

export function imageSourceLabel(input: {
  sourceImageUrl: string | null;
  originalImageUrl: string | null;
  approvedImageUrl: string | null;
}): string {
  if (input.approvedImageUrl?.trim()) return "Image Studio approved";
  if (
    input.originalImageUrl?.trim() &&
    input.sourceImageUrl?.trim() &&
    input.originalImageUrl.trim() !== input.sourceImageUrl.trim()
  ) {
    return "Replaced source";
  }
  if (input.sourceImageUrl?.trim()) return "Rental catalog / draft";
  return "None";
}
