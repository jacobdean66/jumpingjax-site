export type ImageDirectionPreset =
  | "keep-original"
  | "add-child-at-top"
  | "add-child-sliding-down"
  | "add-splash-at-bottom"
  | "product-hero-shot"
  | "backyard-lifestyle-scene"
  | "clean-product-background"
  | "facebook-ad-starting-frame";

export type ImageDirectionPresetOption = {
  id: ImageDirectionPreset;
  label: string;
};

export const IMAGE_DIRECTION_PRESETS: ImageDirectionPresetOption[] = [
  { id: "keep-original", label: "Keep Original" },
  { id: "add-child-at-top", label: "Add Child At Top Of Slide" },
  { id: "add-child-sliding-down", label: "Add Child Sliding Down" },
  { id: "add-splash-at-bottom", label: "Add Splash At Bottom" },
  { id: "product-hero-shot", label: "Product Hero Shot" },
  { id: "backyard-lifestyle-scene", label: "Backyard Lifestyle Scene" },
  { id: "clean-product-background", label: "Clean Product Background" },
  { id: "facebook-ad-starting-frame", label: "Facebook Ad Starting Frame" },
];

export const IMAGE_DIRECTION_PRESET_LABELS: Record<ImageDirectionPreset, string> =
  Object.fromEntries(
    IMAGE_DIRECTION_PRESETS.map((preset) => [preset.id, preset.label]),
  ) as Record<ImageDirectionPreset, string>;

export type ImageDirectorInput = {
  originalSourceImageUrl: string | null;
  campaignName: string | null;
  postPrompt: string;
  sourceImageCategory: string | null;
  imageDirectionPreset: ImageDirectionPreset;
};

export type ImageDirectorOutput = {
  prompt: string;
};

export type ImageDirectorCostEstimate = {
  previewUsd: number;
  imageGenerationUsd: number;
  totalUsd: number;
  notes: string[];
};

const PRODUCT_IMAGE_CATEGORIES = new Set([
  "Water Slides",
  "Bounce Houses",
  "Combos",
  "Inflatable Games",
  "Homepage",
  "Brand",
]);

const WATER_SLIDE_PRESETS = new Set<ImageDirectionPreset>([
  "add-child-at-top",
  "add-child-sliding-down",
  "add-splash-at-bottom",
]);

const CHILD_ACTION_PRESETS = new Set<ImageDirectionPreset>([
  "add-child-at-top",
  "add-child-sliding-down",
  "add-splash-at-bottom",
  "backyard-lifestyle-scene",
  "facebook-ad-starting-frame",
]);

const UNSAFE_MOTION_WORDS = ["backflip", "teleport", "flying", "launch"] as const;

const TEXT_LOGO_RISK_PATTERNS = [
  /\btext overlay\b/,
  /\bon-screen text\b/,
  /\bwatermark\b/,
  /\blogo on\b/,
  /\bcaption on\b/,
  /\bsign with text\b/,
  /\bbanner with text\b/,
  /\badd (a |the )?logo\b/,
  /\badd (a |the )?sign\b/,
];

const PROMPT_LENGTH_WARNING = 2_500;

const BASE_CONSTRAINTS = [
  "IMAGE DIRECTOR — Starting frame for a vertical 9:16 social ad.",
  "Preserve the exact inflatable from the source image — same product, colors, shape, slide lanes, pool, vinyl details, and visible accessories.",
  "Do not redesign, replace, recolor, or stylize the inflatable.",
  "Use a vertical 9:16 social ad starting-frame composition.",
  "Add only realistic, family-friendly elements that belong in a supervised backyard rental scene.",
  "Any children must look ages 3–7 with child-sized bodies and realistic proportions.",
  "Safe supervised play only — no unsafe behavior or impossible poses.",
  "No distorted bodies, no adult-sized kids, no extra limbs, no warped faces.",
  "No text, logos, signs, captions, or watermarks.",
  "Bright natural daylight, photorealistic, premium social ad quality.",
];

const PRESET_SNIPPETS: Record<ImageDirectionPreset, string> = {
  "keep-original":
    "Preserve the source image composition. Keep every inflatable detail exactly as shown. Only improve clarity, lighting, or framing if needed — no new subjects or scene changes.",
  "add-child-at-top":
    "Add one young child ages 3–7 with a child-sized body at the top of the slide, ready to slide. Child positioned naturally on the slide entry with supervised play energy.",
  "add-child-sliding-down":
    "Add one young child ages 3–7 with a child-sized body sliding down the slide using belly-first or seated motion with hands forward. Natural descent pose, realistic physics.",
  "add-splash-at-bottom":
    "Add a realistic splash at the bottom of the slide or pool area. Believable water spray and ripples. Preserve the inflatable exactly; splash should match the existing pool or landing zone.",
  "product-hero-shot":
    "Frame the inflatable as a clean product hero shot. Center the unit, crisp detail on colors, vinyl, shape, and accessories, minimal distraction, premium catalog-meets-ad composition.",
  "backyard-lifestyle-scene":
    "Place the preserved inflatable in a welcoming backyard lifestyle scene — green lawn, fence or trees in soft background, warm family party atmosphere. Optional young children ages 3–7 with child-sized bodies playing safely nearby.",
  "clean-product-background":
    "Isolate the exact inflatable on a clean, bright background. Preserve all product details, colors, vinyl, pool, lanes, and accessories. Minimal props, studio-clean social ad starting frame.",
  "facebook-ad-starting-frame":
    "Compose a scroll-stopping Facebook ad starting frame in vertical 9:16. Hero inflatable preserved exactly, optional young children ages 3–7 with child-sized bodies in safe supervised play, bright backyard energy, no text overlays.",
};

function normalizeImageDirectionPreset(
  value: ImageDirectionPreset | string | null | undefined,
): ImageDirectionPreset {
  if (value && IMAGE_DIRECTION_PRESETS.some((preset) => preset.id === value)) {
    return value as ImageDirectionPreset;
  }
  return "keep-original";
}

function containsWholeWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

function buildContextLines(input: ImageDirectorInput): string[] {
  const lines: string[] = [];

  if (input.originalSourceImageUrl?.trim()) {
    lines.push(`Source image reference: ${input.originalSourceImageUrl.trim()}`);
  }

  if (input.campaignName?.trim()) {
    lines.push(`Campaign: ${input.campaignName.trim()}`);
  }

  if (input.sourceImageCategory?.trim()) {
    lines.push(`Source image category: ${input.sourceImageCategory.trim()}`);
  }

  return lines;
}

export function buildImageDirectorPrompt(input: ImageDirectorInput): ImageDirectorOutput {
  const preset = normalizeImageDirectionPreset(input.imageDirectionPreset);
  const postPrompt = input.postPrompt.trim();
  const contextLines = buildContextLines(input);

  const sections = [
    ...BASE_CONSTRAINTS,
    `Direction preset: ${IMAGE_DIRECTION_PRESET_LABELS[preset]}.`,
    PRESET_SNIPPETS[preset],
  ];

  if (postPrompt) {
    sections.push(`Creative brief: ${postPrompt}`);
  }

  if (contextLines.length > 0) {
    sections.push(contextLines.join("\n"));
  }

  return {
    prompt: sections.join("\n"),
  };
}

export function getImageDirectorSafetyWarnings(input: {
  prompt: string;
  sourceImageCategory: string | null;
  originalSourceImageUrl: string | null;
  imageDirectionPreset: ImageDirectionPreset;
}): string[] {
  const warnings: string[] = [];
  const prompt = input.prompt;
  const promptLower = prompt.toLowerCase();
  const preset = normalizeImageDirectionPreset(input.imageDirectionPreset);
  const category = input.sourceImageCategory;

  if (!input.originalSourceImageUrl?.trim()) {
    warnings.push("No source image URL is configured for image generation.");
  }

  if (
    WATER_SLIDE_PRESETS.has(preset) &&
    category &&
    category !== "Water Slides"
  ) {
    warnings.push(
      `Water-slide image preset "${IMAGE_DIRECTION_PRESET_LABELS[preset]}" may not match source category "${category}".`,
    );
  }

  if (
    category &&
    PRODUCT_IMAGE_CATEGORIES.has(category) &&
    CHILD_ACTION_PRESETS.has(preset) &&
    !/child|kid|children|family|toddler|preschool/.test(promptLower)
  ) {
    warnings.push(
      "Child or action preset used on a product-only source image — added kids may look composited or unrealistic.",
    );
  }

  if (prompt.length > PROMPT_LENGTH_WARNING) {
    warnings.push(
      `Image prompt is very long (${prompt.length} characters). Shorter prompts often produce better results.`,
    );
  }

  for (const word of UNSAFE_MOTION_WORDS) {
    if (containsWholeWord(promptLower, word)) {
      warnings.push(
        `Prompt contains unsafe or impossible motion language: "${word}".`,
      );
    }
  }

  if (/distort|warp|giant kid|adult-sized child/.test(promptLower)) {
    warnings.push(
      "Prompt language may encourage distorted bodies — keep child proportions natural.",
    );
  }

  for (const pattern of TEXT_LOGO_RISK_PATTERNS) {
    if (pattern.test(promptLower)) {
      warnings.push(
        "Prompt may request text, logos, signs, or watermarks — social ad frames should stay text-free.",
      );
      break;
    }
  }

  return warnings;
}

export function estimateImageDirectorCost(): ImageDirectorCostEstimate {
  const previewUsd = 0;
  const imageGenerationUsd = 0.08;
  const notes = [
    "Preview cost is $0 — prompt planning only.",
    "Image generation uses Replicate via the Image Engine provider adapter.",
    "Actual provider pricing may vary by model and resolution.",
  ];

  return {
    previewUsd,
    imageGenerationUsd,
    totalUsd: previewUsd + imageGenerationUsd,
    notes,
  };
}

export function normalizeImageDirectionPresetValue(
  value: string | null | undefined,
): ImageDirectionPreset {
  return normalizeImageDirectionPreset(value);
}
