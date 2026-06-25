import { getSocialCampaign } from "./social-campaigns";
import { SOCIAL_SOURCE_IMAGES } from "./social-source-images";

export type MotionPreset =
  | "default"
  | "fast-waterslide"
  | "slow-waterslide"
  | "natural-playground"
  | "bounce-house"
  | "inflatable-setup"
  | "adults-playing"
  | "kids-playing"
  | "cinematic-commercial";

export type CameraPreset =
  | "static"
  | "tracking"
  | "drone"
  | "close-up"
  | "wide-angle"
  | "slow-pan"
  | "handheld";

export const MOTION_PRESET_LABELS: Record<MotionPreset, string> = {
  default: "Default",
  "fast-waterslide": "Fast Waterslide",
  "slow-waterslide": "Slow Waterslide",
  "natural-playground": "Natural Playground",
  "bounce-house": "Bounce House",
  "inflatable-setup": "Inflatable Setup",
  "adults-playing": "Adults Playing",
  "kids-playing": "Kids Playing",
  "cinematic-commercial": "Cinematic Commercial",
};

export const CAMERA_PRESET_LABELS: Record<CameraPreset, string> = {
  static: "Static",
  tracking: "Tracking",
  drone: "Drone",
  "close-up": "Close Up",
  "wide-angle": "Wide Angle",
  "slow-pan": "Slow Pan",
  handheld: "Handheld",
};

export const MOTION_PRESETS = Object.keys(MOTION_PRESET_LABELS) as MotionPreset[];
export const CAMERA_PRESETS = Object.keys(CAMERA_PRESET_LABELS) as CameraPreset[];

export type VideoDirectorInput = {
  originalPrompt: string;
  campaignId: string | null;
  goal: string | null;
  businessFocus: "rentals" | "facility-parties" | "both";
  sourceImageUrl: string | null;
  motionPreset?: MotionPreset | null;
  cameraPreset?: CameraPreset | null;
};

export type VideoDirectorOutput = {
  improvedPrompt: string;
};

type VideoSceneType = "water-slide" | "bounce-house" | "general";

const WATER_SLIDE_CAMPAIGN_IDS = new Set(["summer-water-slides", "beat-the-heat"]);

const WATER_SLIDE_KEYWORDS = [
  "water slide",
  "waterslide",
  "water-slide",
  "splash",
  "wet slide",
  "pool slide",
];

const BOUNCE_HOUSE_KEYWORDS = [
  "bounce house",
  "bounce-house",
  "bouncer",
  "jump castle",
  "jumper",
  "inflatable castle",
  "bounce",
  "jumping",
];

const MOTION_PRESET_SNIPPETS: Record<MotionPreset, string | null> = {
  default: null,
  "fast-waterslide":
    "Motion: fast waterslide descent with energetic splash at the bottom, quick natural movement.",
  "slow-waterslide":
    "Motion: slow controlled waterslide descent, gentle splash, calm realistic physics.",
  "natural-playground":
    "Motion: natural playground energy, varied kid movement, playful but realistic pacing.",
  "bounce-house":
    "Motion: rhythmic safe bouncing, natural kid hops, steady inflatable movement.",
  "inflatable-setup":
    "Motion: subtle setup motion, blower airflow cues, minimal human movement around the inflatable.",
  "adults-playing":
    "Motion: adults playing safely with children, supervised family interaction, natural movement.",
  "kids-playing":
    "Motion: kids playing with authentic child movement, varied safe activity, happy energy.",
  "cinematic-commercial":
    "Motion: polished commercial pacing, smooth hero moments, premium ad rhythm.",
};

const CAMERA_PRESET_SNIPPETS: Record<CameraPreset, string | null> = {
  static: "Camera: static locked-off shot, stable framing.",
  tracking: "Camera: smooth tracking shot following the main action.",
  drone: "Camera: elevated drone-style angle with gentle movement.",
  "close-up": "Camera: close-up framing on faces and action details.",
  "wide-angle": "Camera: wide-angle establishing shot showing full inflatable and yard.",
  "slow-pan": "Camera: slow pan across the scene, steady cinematic movement.",
  handheld: "Camera: subtle handheld documentary feel, natural micro-movement.",
};

function normalizeText(...parts: Array<string | null | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .toLowerCase();
}

function keywordMatch(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

export function sourceImageCategory(sourceImageUrl: string | null): string | null {
  if (!sourceImageUrl?.trim()) return null;

  const normalizedUrl = sourceImageUrl.trim();
  const match = SOCIAL_SOURCE_IMAGES.find((image) => image.url === normalizedUrl);
  return match?.category ?? null;
}

export function sourceImageLabel(sourceImageUrl: string | null): string | null {
  if (!sourceImageUrl?.trim()) return null;

  const normalizedUrl = sourceImageUrl.trim();
  const match = SOCIAL_SOURCE_IMAGES.find((image) => image.url === normalizedUrl);
  return match?.label ?? null;
}

function detectVideoSceneType(input: VideoDirectorInput): VideoSceneType {
  const campaign = getSocialCampaign(input.campaignId);
  const text = normalizeText(
    input.originalPrompt,
    input.goal,
    campaign?.label,
    campaign?.description,
    ...(campaign?.preferredImageKeywords ?? []),
    ...(campaign?.promptAngles ?? []),
  );
  const category = sourceImageCategory(input.sourceImageUrl);

  if (
    (input.campaignId && WATER_SLIDE_CAMPAIGN_IDS.has(input.campaignId)) ||
    keywordMatch(text, WATER_SLIDE_KEYWORDS) ||
    category === "Water Slides"
  ) {
    return "water-slide";
  }

  if (
    keywordMatch(text, BOUNCE_HOUSE_KEYWORDS) ||
    category === "Bounce Houses" ||
    category === "Combos"
  ) {
    return "bounce-house";
  }

  return "general";
}

function waterSlideDirections(): string {
  return [
    "VIDEO DIRECTOR — Water slide scene:",
    "Show young children ages 3–7 with child-sized bodies only.",
    "Children slide down correctly using belly-first or seated sliding motion with hands forward.",
    "Include a realistic splash at the bottom with believable physics.",
    "Bright sunny backyard, family-friendly tone, safe supervised play.",
    "No adult-sized kids, no distorted bodies, no unsafe behavior, no text on screen.",
    "5-second vertical social ad style.",
  ].join(" ");
}

function bounceHouseDirections(): string {
  return [
    "VIDEO DIRECTOR — Bounce house scene:",
    "Show young children ages 3–7 with child-sized bodies only.",
    "Children jump safely with natural kid movement in a happy family party atmosphere.",
    "No adult-sized kids, no distorted bodies, no unsafe behavior, no text on screen.",
    "5-second vertical social ad style.",
  ].join(" ");
}

function generalDirections(): string {
  return [
    "VIDEO DIRECTOR — General scene:",
    "Show young children ages 3–7 with child-sized bodies only.",
    "Natural kid movement, family-friendly tone, safe supervised play.",
    "No adult-sized kids, no distorted bodies, no unsafe behavior, no text on screen.",
    "5-second vertical social ad style.",
  ].join(" ");
}

function sceneDirections(sceneType: VideoSceneType): string {
  if (sceneType === "water-slide") return waterSlideDirections();
  if (sceneType === "bounce-house") return bounceHouseDirections();
  return generalDirections();
}

function normalizeMotionPreset(value: MotionPreset | null | undefined): MotionPreset {
  if (value && MOTION_PRESETS.includes(value)) return value;
  return "default";
}

function normalizeCameraPreset(value: CameraPreset | null | undefined): CameraPreset {
  if (value && CAMERA_PRESETS.includes(value)) return value;
  return "static";
}

function appendPresetSnippets(
  prompt: string,
  motionPreset: MotionPreset,
  cameraPreset: CameraPreset,
): string {
  const snippets = [
    MOTION_PRESET_SNIPPETS[motionPreset],
    CAMERA_PRESET_SNIPPETS[cameraPreset],
  ].filter((snippet): snippet is string => Boolean(snippet));

  if (snippets.length === 0) return prompt;
  return `${prompt}\n\n${snippets.join(" ")}`;
}

export function createVideoDirectorPrompt(
  input: VideoDirectorInput,
): VideoDirectorOutput {
  const originalPrompt = input.originalPrompt.trim();
  const sceneType = detectVideoSceneType(input);
  const directions = sceneDirections(sceneType);
  const motionPreset = normalizeMotionPreset(input.motionPreset);
  const cameraPreset = normalizeCameraPreset(input.cameraPreset);

  const basePrompt = originalPrompt
    ? `${originalPrompt}\n\n${directions}`
    : directions;

  return {
    improvedPrompt: appendPresetSnippets(basePrompt, motionPreset, cameraPreset),
  };
}

export function normalizeMotionPresetValue(
  value: string | null | undefined,
): MotionPreset {
  return normalizeMotionPreset(value as MotionPreset | null | undefined);
}

export function normalizeCameraPresetValue(
  value: string | null | undefined,
): CameraPreset {
  return normalizeCameraPreset(value as CameraPreset | null | undefined);
}
