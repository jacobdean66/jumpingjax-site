import {
  buildImageDirectorPrompt,
  normalizeImageStudioPresetValue,
  type ImageDirectorInput,
  type ImageStudioPreset,
} from "../image-director";
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

export type ImageDirectorAgentInput = ImageDirectorInput & {
  goal?: string | null;
  platformsLabel?: string | null;
  tone?: string | null;
  /** Verified catalog metadata only — never raw signed URLs. */
  approvedAssetSummary?: string | null;
};

export type ImageDirectorCreativeDirection = {
  visualConcept: string;
  composition: string;
  subject: string;
  backgroundEnvironment: string;
  textOverlayRecommendation: string;
  aspectRatioOrFraming: string;
  brandConstraints: string[];
  prohibitedOrRiskyElements: string[];
  finalImageGenerationPrompt: string;
};

const IMAGE_DIRECTION_KEYS = [
  "visualConcept",
  "composition",
  "subject",
  "backgroundEnvironment",
  "textOverlayRecommendation",
  "aspectRatioOrFraming",
  "brandConstraints",
  "prohibitedOrRiskyElements",
  "finalImageGenerationPrompt",
] as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function buildImageDirectorAgentRequestPayload(
  input: ImageDirectorAgentInput,
): { system: string; user: string } {
  const preset = normalizeImageStudioPresetValue(
    input.imageStudioPreset ?? input.imageDirectionPreset,
  );

  const system = `You are the Image Director Agent for Jumping Jax social posts.
Return ONLY valid JSON matching the requested schema. No markdown fences. No unknown keys.

Hard rules:
- Plan a SINGLE photorealistic still image. No video/motion/camera-move language.
- Preserve the exact inflatable product from the verified source asset when provided.
- Do NOT invent Jumping Jax prices, promotions, dates, inventory, availability, or customer claims.
- Prefer no on-image text. If text overlay is discussed, recommend avoiding baked-in text.
- Keep children ages 3–7 with child-sized proportions when people are included.
- finalImageGenerationPrompt must be a complete image-generation prompt ready for the image provider.
- Do not echo raw asset URLs; use only the verified asset summary fields.`;

  const user = JSON.stringify({
    request: {
      campaignName: input.campaignName?.slice(0, 160) ?? null,
      postPrompt: input.postPrompt?.slice(0, AGENT_INPUT_LIMITS.prompt) ?? "",
      sourceImageCategory: input.sourceImageCategory ?? null,
      approvedAssetSummary: input.approvedAssetSummary ?? null,
      imageStudioPreset: preset,
      platforms: input.platforms ?? null,
      postPlacement: input.postPlacement ?? null,
      formatVariantId: input.formatVariantId ?? null,
      goal: input.goal ?? null,
      tone: input.tone ?? null,
    },
    outputSchema: {
      visualConcept: "string",
      composition: "string",
      subject: "string",
      backgroundEnvironment: "string",
      textOverlayRecommendation: "string",
      aspectRatioOrFraming: "string",
      brandConstraints: "array of strings",
      prohibitedOrRiskyElements: "array of strings",
      finalImageGenerationPrompt: "string",
    },
  });

  return { system, user };
}

export type ImageDirectorValidationResult =
  | { ok: true; direction: ImageDirectorCreativeDirection }
  | { ok: false; reason: string };

export function validateImageDirectorCreativeDirectionDetailed(
  raw: unknown,
): ImageDirectorValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "Model response failed schema validation." };
  }
  const value = raw as Record<string, unknown>;

  try {
    rejectUnknownKeys(value, IMAGE_DIRECTION_KEYS, "Image director direction");
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Unknown keys rejected.",
    };
  }

  for (const key of [
    "visualConcept",
    "composition",
    "subject",
    "backgroundEnvironment",
    "textOverlayRecommendation",
    "aspectRatioOrFraming",
    "finalImageGenerationPrompt",
  ] as const) {
    if (!isNonEmptyString(value[key])) {
      return { ok: false, reason: `${key} is required.` };
    }
  }

  const visualConcept = value.visualConcept as string;
  const composition = value.composition as string;
  const subject = value.subject as string;
  const backgroundEnvironment = value.backgroundEnvironment as string;
  const textOverlayRecommendation = value.textOverlayRecommendation as string;
  const aspectRatioOrFraming = value.aspectRatioOrFraming as string;
  const finalImageGenerationPromptRaw =
    value.finalImageGenerationPrompt as string;

  let brandConstraints: string[];
  let prohibitedOrRiskyElements: string[];
  try {
    brandConstraints = requireExactStringArray(
      value.brandConstraints,
      "brandConstraints",
      {
        min: 1,
        max: AGENT_INPUT_LIMITS.stringArrayCount,
        itemMax: AGENT_INPUT_LIMITS.stringArrayItem,
      },
    );
    prohibitedOrRiskyElements = requireExactStringArray(
      value.prohibitedOrRiskyElements,
      "prohibitedOrRiskyElements",
      {
        min: 1,
        max: AGENT_INPUT_LIMITS.stringArrayCount,
        itemMax: AGENT_INPUT_LIMITS.stringArrayItem,
      },
    );
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Array field invalid.",
    };
  }

  const finalImageGenerationPrompt = finalImageGenerationPromptRaw
    .trim()
    .slice(0, AGENT_INPUT_LIMITS.prompt);
  if (
    /\b(video|animate|camera move|tracking shot|slow motion)\b/i.test(
      finalImageGenerationPrompt,
    )
  ) {
    return {
      ok: false,
      reason: "finalImageGenerationPrompt must describe a still image only.",
    };
  }

  const claimHits = scanProhibitedBusinessClaims(
    [
      visualConcept,
      subject,
      textOverlayRecommendation,
      finalImageGenerationPrompt,
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
      visualConcept: visualConcept.trim().slice(0, 600),
      composition: composition.trim().slice(0, 600),
      subject: subject.trim().slice(0, 600),
      backgroundEnvironment: backgroundEnvironment.trim().slice(0, 600),
      textOverlayRecommendation: textOverlayRecommendation.trim().slice(0, 400),
      aspectRatioOrFraming: aspectRatioOrFraming.trim().slice(0, 240),
      brandConstraints,
      prohibitedOrRiskyElements,
      finalImageGenerationPrompt,
    },
  };
}

export function validateImageDirectorCreativeDirection(
  raw: unknown,
): ImageDirectorCreativeDirection | null {
  const result = validateImageDirectorCreativeDirectionDetailed(raw);
  return result.ok ? result.direction : null;
}

export function buildDeterministicImageDirectorDirection(
  input: ImageDirectorAgentInput,
): ImageDirectorCreativeDirection {
  const preset = normalizeImageStudioPresetValue(
    input.imageStudioPreset ?? input.imageDirectionPreset,
  ) as ImageStudioPreset;
  const { prompt } = buildImageDirectorPrompt({
    ...input,
    postPrompt: input.postPrompt?.slice(0, AGENT_INPUT_LIMITS.prompt),
    originalSourceImageUrl: input.originalSourceImageUrl,
  });

  return {
    visualConcept: `Preset-driven still for ${preset.replace(/-/g, " ")}`.slice(
      0,
      600,
    ),
    composition:
      "Balanced product-forward framing with the inflatable clearly visible and readable on mobile.",
    subject: (
      input.sourceImageCategory?.trim() ||
      "Jumping Jax inflatable rental product from the selected source image"
    ).slice(0, 600),
    backgroundEnvironment:
      "Clean family-friendly backyard or party environment matching the campaign tone",
    textOverlayRecommendation:
      "Do not bake text, logos, watermarks, or captions into the image.",
    aspectRatioOrFraming: (
      input.formatVariantId?.trim() ||
      input.postPlacement?.trim() ||
      "Platform-native social framing"
    ).slice(0, 240),
    brandConstraints: [
      "Family-friendly, clean, local Jumping Jax tone",
      "Preserve exact inflatable product appearance from the source image when provided",
      "No invented prices, promotions, or business claims in the image",
    ],
    prohibitedOrRiskyElements: [
      "On-image text, logos, or watermarks",
      "Unsafe play, distorted bodies, or adult-sized children",
      "Video/motion language in a still-image prompt",
    ],
    finalImageGenerationPrompt: prompt.slice(0, AGENT_INPUT_LIMITS.prompt),
  };
}

function diagnosticsFrom(
  partial: Omit<AgentDiagnostics, "agentId">,
): AgentDiagnostics {
  return { agentId: "image-director", ...partial };
}

export async function runImageDirectorAgent(
  input: ImageDirectorAgentInput,
  options?: { client?: LlmJsonClient },
): Promise<AgentResult<ImageDirectorCreativeDirection>> {
  const client = options?.client ?? getDefaultLlmJsonClient();
  const requestId = createRequestId("image_director");
  const fallback = buildDeterministicImageDirectorDirection(input);
  const { system, user } = buildImageDirectorAgentRequestPayload(input);

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
    temperature: 0.35,
    maxOutputTokens: 1_000,
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

  const validated = validateImageDirectorCreativeDirectionDetailed(llm.parsed);
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
