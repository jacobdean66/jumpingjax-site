import {
  createVideoDirectorPrompt,
  normalizeCameraPresetValue,
  normalizeMotionPresetValue,
  type CameraPreset,
  type MotionPreset,
  type VideoDirectorInput,
} from "../video-director";
import {
  AGENT_INPUT_LIMITS,
  rejectUnknownKeys,
  requireExactStringArray,
  scanProhibitedBusinessClaims,
} from "./agent-input-bounds";
import {
  classifyAgentFailureKind,
  createRequestId,
  type AgentDiagnostics,
  type AgentResult,
} from "./agent-types";
import { getDefaultLlmJsonClient, type LlmJsonClient } from "./llm-json-client";

export type VideoDirectorAgentInput = VideoDirectorInput & {
  platforms?: readonly string[] | null;
  postPlacement?: string | null;
  durationSeconds?: number | null;
  aspectRatio?: string | null;
  /** Verified catalog metadata only — never raw signed URLs. */
  approvedAssetSummary?: string | null;
  sourceImageCategory?: string | null;
  sourceImageLabel?: string | null;
};

export type VideoDirectorCreativeDirection = {
  openingHook: string;
  shotSequence: string[];
  sceneDescriptions: string[];
  motionCameraGuidance: string;
  durationGuidance: string;
  onScreenText: string;
  voiceoverOrCaptionGuidance: string;
  closingCallToAction: string;
  finalVideoGenerationPrompt: string;
};

const VIDEO_DIRECTION_KEYS = [
  "openingHook",
  "shotSequence",
  "sceneDescriptions",
  "motionCameraGuidance",
  "durationGuidance",
  "onScreenText",
  "voiceoverOrCaptionGuidance",
  "closingCallToAction",
  "finalVideoGenerationPrompt",
] as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function buildVideoDirectorAgentRequestPayload(
  input: VideoDirectorAgentInput,
): { system: string; user: string } {
  const motionPreset = normalizeMotionPresetValue(input.motionPreset);
  const cameraPreset = normalizeCameraPresetValue(input.cameraPreset);
  const durationSeconds =
    typeof input.durationSeconds === "number" && input.durationSeconds > 0
      ? Math.min(Math.round(input.durationSeconds), 30)
      : 5;

  const system = `You are the Video Director Agent for Jumping Jax social posts.
Return ONLY valid JSON matching the requested schema. No markdown fences. No unknown keys.

Hard rules:
- Plan a short family-friendly promotional video.
- Do NOT invent Jumping Jax prices, promotions, dates, inventory, availability, or customer claims.
- Children should appear ages 3–7 with child-sized bodies when included.
- Prefer no baked-in on-screen text; put caption/voiceover guidance in dedicated fields.
- finalVideoGenerationPrompt must be a complete video-generation prompt.
- Respect supplied motion/camera presets and duration guidance.
- Never request unsafe stunts, impossible physics, or adult-sized children.
- Do not echo raw asset URLs; use only the verified asset summary fields.`;

  const user = JSON.stringify({
    request: {
      originalPrompt:
        input.originalPrompt?.slice(0, AGENT_INPUT_LIMITS.prompt) ?? "",
      campaignId: input.campaignId,
      goal: input.goal,
      businessFocus: input.businessFocus,
      approvedAssetSummary: input.approvedAssetSummary ?? null,
      sourceImageCategory: input.sourceImageCategory ?? null,
      sourceImageLabel: input.sourceImageLabel ?? null,
      motionPreset,
      cameraPreset,
      platforms: input.platforms ?? null,
      postPlacement: input.postPlacement ?? null,
      durationSeconds,
      aspectRatio: input.aspectRatio ?? null,
    },
    outputSchema: {
      openingHook: "string",
      shotSequence: "array of strings",
      sceneDescriptions: "array of strings",
      motionCameraGuidance: "string",
      durationGuidance: "string",
      onScreenText: "string",
      voiceoverOrCaptionGuidance: "string",
      closingCallToAction: "string",
      finalVideoGenerationPrompt: "string",
    },
  });

  return { system, user };
}

export type VideoDirectorValidationResult =
  | { ok: true; direction: VideoDirectorCreativeDirection }
  | { ok: false; reason: string };

export function validateVideoDirectorCreativeDirectionDetailed(
  raw: unknown,
): VideoDirectorValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "Model response failed schema validation." };
  }
  const value = raw as Record<string, unknown>;

  try {
    rejectUnknownKeys(value, VIDEO_DIRECTION_KEYS, "Video director direction");
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Unknown keys rejected.",
    };
  }

  for (const key of [
    "openingHook",
    "motionCameraGuidance",
    "durationGuidance",
    "onScreenText",
    "voiceoverOrCaptionGuidance",
    "closingCallToAction",
    "finalVideoGenerationPrompt",
  ] as const) {
    if (!isNonEmptyString(value[key])) {
      return { ok: false, reason: `${key} is required.` };
    }
  }

  const openingHook = value.openingHook as string;
  const motionCameraGuidance = value.motionCameraGuidance as string;
  const durationGuidance = value.durationGuidance as string;
  const onScreenText = value.onScreenText as string;
  const voiceoverOrCaptionGuidance = value.voiceoverOrCaptionGuidance as string;
  const closingCallToAction = value.closingCallToAction as string;
  const finalVideoGenerationPromptRaw =
    value.finalVideoGenerationPrompt as string;

  let shotSequence: string[];
  let sceneDescriptions: string[];
  try {
    shotSequence = requireExactStringArray(value.shotSequence, "shotSequence", {
      min: 1,
      max: 8,
      itemMax: AGENT_INPUT_LIMITS.stringArrayItem,
    });
    sceneDescriptions = requireExactStringArray(
      value.sceneDescriptions,
      "sceneDescriptions",
      {
        min: 1,
        max: 8,
        itemMax: AGENT_INPUT_LIMITS.stringArrayItem,
      },
    );
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Array field invalid.",
    };
  }

  const finalVideoGenerationPrompt = finalVideoGenerationPromptRaw
    .trim()
    .slice(0, AGENT_INPUT_LIMITS.prompt);

  const claimHits = scanProhibitedBusinessClaims(
    [
      openingHook,
      onScreenText,
      voiceoverOrCaptionGuidance,
      closingCallToAction,
      finalVideoGenerationPrompt,
    ].join("\n"),
  );
  if (claimHits.length > 0) {
    return {
      ok: false,
      reason: `Model response failed schema validation: prohibited business claims (${claimHits[0]}).`,
    };
  }

  return {
    ok: true,
    direction: {
      openingHook: openingHook.trim().slice(0, 400),
      shotSequence,
      sceneDescriptions,
      motionCameraGuidance: motionCameraGuidance.trim().slice(0, 800),
      durationGuidance: durationGuidance.trim().slice(0, 240),
      onScreenText: onScreenText.trim().slice(0, 400),
      voiceoverOrCaptionGuidance: voiceoverOrCaptionGuidance
        .trim()
        .slice(0, 800),
      closingCallToAction: closingCallToAction.trim().slice(0, 400),
      finalVideoGenerationPrompt,
    },
  };
}

export function validateVideoDirectorCreativeDirection(
  raw: unknown,
): VideoDirectorCreativeDirection | null {
  const result = validateVideoDirectorCreativeDirectionDetailed(raw);
  return result.ok ? result.direction : null;
}

export function buildDeterministicVideoDirectorDirection(
  input: VideoDirectorAgentInput,
): VideoDirectorCreativeDirection {
  const motionPreset = normalizeMotionPresetValue(
    input.motionPreset,
  ) as MotionPreset;
  const cameraPreset = normalizeCameraPresetValue(
    input.cameraPreset,
  ) as CameraPreset;
  const { improvedPrompt } = createVideoDirectorPrompt({
    ...input,
    originalPrompt: input.originalPrompt?.slice(0, AGENT_INPUT_LIMITS.prompt),
  });
  const durationSeconds =
    typeof input.durationSeconds === "number" && input.durationSeconds > 0
      ? Math.min(Math.round(input.durationSeconds), 30)
      : 5;

  return {
    openingHook:
      "Open on the inflatable hero product with immediate family-fun energy.",
    shotSequence: [
      "Establish the inflatable in a clean backyard or party setting",
      "Show safe child play matching the scene type",
      "Close on a warm family reaction and brand-safe CTA moment",
    ],
    sceneDescriptions: [
      "Bright daytime family-friendly scene with supervised kids ages 3–7",
      "Exact inflatable from the selected source image preserved in color and shape",
    ],
    motionCameraGuidance: `Motion preset: ${motionPreset}. Camera preset: ${cameraPreset}. Keep movement natural and safe.`,
    durationGuidance: `${durationSeconds}-second vertical social ad pacing.`,
    onScreenText: "No baked-in on-screen text.",
    voiceoverOrCaptionGuidance:
      "Keep caption/voiceover upbeat and local. Do not invent prices, promotions, dates, or availability.",
    closingCallToAction:
      "Invite families to message Jumping Jax for party or rental details (owner confirms facts).",
    finalVideoGenerationPrompt: improvedPrompt.slice(0, AGENT_INPUT_LIMITS.prompt),
  };
}

function diagnosticsFrom(
  partial: Omit<AgentDiagnostics, "agentId">,
): AgentDiagnostics {
  return { agentId: "video-director", ...partial };
}

export async function runVideoDirectorAgent(
  input: VideoDirectorAgentInput,
  options?: { client?: LlmJsonClient },
): Promise<AgentResult<VideoDirectorCreativeDirection>> {
  const client = options?.client ?? getDefaultLlmJsonClient();
  const requestId = createRequestId("video_director");
  const fallback = buildDeterministicVideoDirectorDirection(input);
  const { system, user } = buildVideoDirectorAgentRequestPayload(input);

  if (!client.isConfigured()) {
    return {
      ok: true,
      output: fallback,
      diagnostics: diagnosticsFrom({
        source: "deterministic-fallback",
        provider: "none",
        model: null,
        requestId,
        fallbackReason: "Language model provider is not configured.",
        timedOut: false,
        truncatedInput: false,
        failureKind: "not_configured",
      }),
    };
  }

  const llm = await client.completeJson({
    system,
    user,
    requestId,
    temperature: 0.4,
    maxOutputTokens: 1_200,
  });

  if (!llm.ok) {
    return {
      ok: true,
      output: fallback,
      diagnostics: diagnosticsFrom({
        source: "deterministic-fallback",
        provider: llm.provider,
        model: llm.model,
        requestId: llm.requestId,
        fallbackReason: llm.error,
        timedOut: llm.timedOut,
        truncatedInput: llm.truncatedInput,
        failureKind: classifyAgentFailureKind(llm.error),
      }),
    };
  }

  const validated = validateVideoDirectorCreativeDirectionDetailed(llm.parsed);
  if (!validated.ok) {
    return {
      ok: true,
      output: fallback,
      diagnostics: diagnosticsFrom({
        source: "deterministic-fallback",
        provider: "openai",
        model: llm.model,
        requestId: llm.requestId,
        fallbackReason: validated.reason,
        timedOut: false,
        truncatedInput: llm.truncatedInput,
        failureKind: "schema_failure",
      }),
    };
  }

  return {
    ok: true,
    output: validated.direction,
    diagnostics: diagnosticsFrom({
      source: "model",
      provider: "openai",
      model: llm.model,
      requestId: llm.requestId,
      fallbackReason: null,
      timedOut: false,
      truncatedInput: llm.truncatedInput,
      failureKind: null,
    }),
  };
}
