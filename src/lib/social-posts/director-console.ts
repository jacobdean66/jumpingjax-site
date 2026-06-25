import { getSocialCampaign } from "./social-campaigns";
import {
  createVideoDirectorPrompt,
  normalizeCameraPresetValue,
  normalizeMotionPresetValue,
  sourceImageCategory,
  sourceImageLabel,
  type CameraPreset,
  type MotionPreset,
} from "./video-director";
import { aiVideoAppUrl, socialVideoSourceImageUrl } from "./social-video-utils";
import type { SocialPostBusinessFocus } from "./social-post-data";

export type CreativeSource = "openai" | "rule-fallback" | "unknown";

export type DirectorPreviewInput = {
  originalPrompt: string;
  campaignId: string | null;
  goal: string | null;
  businessFocus: SocialPostBusinessFocus;
  postSourceImageUrl: string | null;
  motionPreset?: string | null;
  cameraPreset?: string | null;
  creativeSource?: string | null;
};

export type GenerationSettings = {
  aiVideoAppUrl: string;
  model: string;
  qualityMode: "draft" | "high";
  durationSeconds: number;
  aspectRatio: string;
  motionPreset: MotionPreset;
  cameraPreset: CameraPreset;
};

export type CostEstimate = {
  openAiUsd: number;
  videoGenerationUsd: number;
  totalUsd: number;
  notes: string[];
};

export type DirectorPreviewResult = {
  campaignLabel: string | null;
  goal: string | null;
  businessFocus: SocialPostBusinessFocus;
  creativeSource: CreativeSource;
  originalCreativePrompt: string;
  finalVideoPrompt: string;
  resolvedSourceImageUrl: string | null;
  sourceImageCategory: string | null;
  sourceImageLabel: string | null;
  generationSettings: GenerationSettings;
  safetyWarnings: string[];
  costEstimate: CostEstimate;
};

const PRODUCT_IMAGE_CATEGORIES = new Set([
  "Water Slides",
  "Bounce Houses",
  "Combos",
  "Inflatable Games",
  "Homepage",
  "Brand",
]);

function containsPhrase(text: string, phrase: string): boolean {
  return text.includes(phrase);
}

function containsWholeWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(text);
}

function promptContainsAction(text: string, action: string): boolean {
  return action.includes(" ")
    ? containsPhrase(text, action)
    : containsWholeWord(text, action);
}

const CONFLICTING_ACTION_PAIRS: Array<[string, string]> = [
  ["slide down", "jump"],
  ["waterslide", "bounce house"],
  ["sit still", "run fast"],
  ["indoor", "backyard"],
  ["belly-first", "standing upright on slide"],
];

const IMPOSSIBLE_MOTION_KEYWORDS = [
  "fly through the air",
  "backflip",
  "front flip",
  "double bounce launch",
  "launch into orbit",
  "teleport",
  "morph into",
];

const PROMPT_LENGTH_WARNING = 2_500;

function normalizeCreativeSource(value: string | null | undefined): CreativeSource {
  if (value === "openai" || value === "rule-fallback") return value;
  return "unknown";
}

function campaignExpectsWaterSlide(campaignId: string | null): boolean {
  if (!campaignId) return false;
  return campaignId === "summer-water-slides" || campaignId === "beat-the-heat";
}

function campaignExpectsBounce(campaignId: string | null): boolean {
  if (!campaignId) return false;
  const campaign = getSocialCampaign(campaignId);
  if (!campaign) return false;
  const text = [
    campaign.label,
    campaign.description,
    ...campaign.preferredImageKeywords,
    ...campaign.promptAngles,
  ]
    .join(" ")
    .toLowerCase();
  return /bounce|party|birthday|combo|jumper|castle/.test(text);
}

export function getDirectorSafetyWarnings(input: {
  finalPrompt: string;
  campaignId: string | null;
  resolvedSourceImageUrl: string | null;
}): string[] {
  const warnings: string[] = [];
  const prompt = input.finalPrompt.toLowerCase();
  const category = sourceImageCategory(input.resolvedSourceImageUrl);

  if (
    category &&
    PRODUCT_IMAGE_CATEGORIES.has(category) &&
    !/child|kid|children|family|toddler|preschool/.test(prompt)
  ) {
    warnings.push(
      "Source image has no visible children — product photos may produce unrealistic kid animation.",
    );
  }

  for (const [left, right] of CONFLICTING_ACTION_PAIRS) {
    if (promptContainsAction(prompt, left) && promptContainsAction(prompt, right)) {
      warnings.push(`Prompt contains conflicting actions: "${left}" and "${right}".`);
    }
  }

  for (const keyword of IMPOSSIBLE_MOTION_KEYWORDS) {
    if (prompt.includes(keyword)) {
      warnings.push(`Prompt requests impossible or risky motion: "${keyword}".`);
    }
  }

  if (input.finalPrompt.length > PROMPT_LENGTH_WARNING) {
    warnings.push(
      `Prompt length is excessive (${input.finalPrompt.length} characters). Shorter prompts often produce better video results.`,
    );
  }

  if (category && input.campaignId) {
    const waterCampaign = campaignExpectsWaterSlide(input.campaignId);
    const bounceCampaign = campaignExpectsBounce(input.campaignId);

    if (waterCampaign && category !== "Water Slides" && category !== "Combos") {
      warnings.push(
        `Source image category "${category}" may not match the water slide campaign.`,
      );
    }

    if (
      bounceCampaign &&
      !waterCampaign &&
      category === "Water Slides"
    ) {
      warnings.push(
        `Source image category "${category}" may not match the bounce/party campaign.`,
      );
    }
  }

  if (!input.resolvedSourceImageUrl) {
    warnings.push("No source image URL is configured for video generation.");
  }

  return warnings;
}

export function getGenerationSettings(
  motionPreset: MotionPreset,
  cameraPreset: CameraPreset,
): GenerationSettings {
  return {
    aiVideoAppUrl: aiVideoAppUrl(),
    model: process.env.AI_VIDEO_MODEL?.trim() || "Configured by AI Video App",
    qualityMode: "draft",
    durationSeconds: 5,
    aspectRatio: "9:16 (vertical social ad)",
    motionPreset,
    cameraPreset,
  };
}

export function estimateDirectorCosts(
  qualityMode: "draft" | "high" = "draft",
): CostEstimate {
  const openAiUsd = 0;
  const videoGenerationUsd = qualityMode === "high" ? 0.45 : 0.15;
  const notes = [
    "OpenAI cost is $0 for preview/generate because the Creative Director prompt is already stored.",
    "Video cost is a rough draft-mode estimate for the external AI Video App.",
  ];

  return {
    openAiUsd,
    videoGenerationUsd,
    totalUsd: openAiUsd + videoGenerationUsd,
    notes,
  };
}

export function buildDirectorPreview(
  input: DirectorPreviewInput,
): DirectorPreviewResult {
  const motionPreset = normalizeMotionPresetValue(input.motionPreset);
  const cameraPreset = normalizeCameraPresetValue(input.cameraPreset);
  const resolvedSourceImageUrl = socialVideoSourceImageUrl(input.postSourceImageUrl);
  const campaign = getSocialCampaign(input.campaignId);

  const { improvedPrompt } = createVideoDirectorPrompt({
    originalPrompt: input.originalPrompt,
    campaignId: input.campaignId,
    goal: input.goal,
    businessFocus: input.businessFocus,
    sourceImageUrl: resolvedSourceImageUrl,
    motionPreset,
    cameraPreset,
  });

  const generationSettings = getGenerationSettings(motionPreset, cameraPreset);
  const safetyWarnings = getDirectorSafetyWarnings({
    finalPrompt: improvedPrompt,
    campaignId: input.campaignId,
    resolvedSourceImageUrl,
  });

  return {
    campaignLabel: campaign?.label ?? null,
    goal: input.goal,
    businessFocus: input.businessFocus,
    creativeSource: normalizeCreativeSource(input.creativeSource),
    originalCreativePrompt: input.originalPrompt,
    finalVideoPrompt: improvedPrompt,
    resolvedSourceImageUrl,
    sourceImageCategory: sourceImageCategory(resolvedSourceImageUrl),
    sourceImageLabel: sourceImageLabel(resolvedSourceImageUrl),
    generationSettings,
    safetyWarnings,
    costEstimate: estimateDirectorCosts(generationSettings.qualityMode),
  };
}
