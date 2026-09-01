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
import {
  getDefaultLlmJsonClient,
  type LlmJsonClient,
} from "./llm-json-client";
import type {
  CampaignStrategistOutput,
  CreativeDirectorOutput,
} from "./orchestration-types";

const VALID_PLATFORMS = ["facebook", "instagram"] as const;

const CREATIVE_KEYS = [
  "title",
  "caption",
  "generationPrompt",
  "mediaType",
  "platforms",
  "businessFocus",
  "campaignId",
  "goal",
  "assetUsageGuidance",
  "visualDirection",
  "platformSpecificConstraints",
  "sourceImageKeywords",
  "ownerInputRequired",
  "revisionOfPrior",
] as const;

export type CreativeDirectorAgentInput = {
  strategist: CampaignStrategistOutput;
  workflowContextSummary?: string | null;
  themeContext?: {
    sourceText: string;
    themeLabel: string;
    styleFamily: string;
    palette: Readonly<Record<string, string>>;
  } | null;
  revisionInstructions?: string[] | null;
  complianceFindings?: string[] | null;
  priorCreative?: CreativeDirectorOutput | null;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function bound(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export function buildCreativeDirectorRequestPayload(
  input: CreativeDirectorAgentInput,
): { system: string; user: string } {
  const revising = Boolean(input.priorCreative && input.revisionInstructions?.length);

  const system = `You are the Creative Director for Jumping Jax (Greenwood, SC).
Return ONLY valid JSON matching the schema. No markdown.

You consume Campaign Strategist output and produce the owner-facing creative draft.
You do NOT approve, publish, schedule, advertise, or start paid image/video generation.

Hard rules:
- Do not invent prices, promotions, discounts, dates, inventory, availability, or customer stories.
- generationPrompt must describe promotional ${input.strategist.mediaType} with no baked-in on-screen text.
- Preserve verified asset identity from strategist.selectedAssetContext when present.
- Treat workflowContextSummary as bounded read-only planning context when it is supplied.
- When themeContext is supplied, make the theme unmistakable without claiming official endorsement or licensing.
- Write a polished human title and caption; never echo raw instructions such as "Promote...", "Objective:", "aligned with:", or "owner confirms facts".
- Voice: upbeat, clean, local, family-friendly, safe.
- revisionOfPrior must be ${revising ? "true" : "false"}.
- Put missing owner facts in ownerInputRequired instead of guessing.`;

  const user = JSON.stringify({
    campaignStrategistOutput: input.strategist,
    revisionMode: revising,
    priorCreativeDirectorOutput: input.priorCreative ?? null,
    revisionInstructions: input.revisionInstructions ?? [],
    complianceFindingsSafeToExpose: input.complianceFindings ?? [],
    workflowContextSummary: input.workflowContextSummary ?? null,
    themeContext: input.themeContext ?? null,
    schemaKeys: CREATIVE_KEYS,
  });

  return { system, user };
}

export function validateCreativeDirectorOutputDetailed(
  value: unknown,
): { ok: true; output: CreativeDirectorOutput } | { ok: false; reason: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, reason: "Creative Director output must be an object." };
  }
  const raw = value as Record<string, unknown>;
  try {
    rejectUnknownKeys(raw, CREATIVE_KEYS, "Creative Director output");
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Unknown keys rejected.",
    };
  }

  for (const key of ["title", "caption", "generationPrompt", "goal", "assetUsageGuidance", "visualDirection"] as const) {
    if (!isNonEmptyString(raw[key])) {
      return { ok: false, reason: `${key} must be a non-empty string.` };
    }
  }
  if (raw.mediaType !== "image" && raw.mediaType !== "video") {
    return { ok: false, reason: "mediaType must be image or video." };
  }
  if (
    raw.businessFocus !== "rentals" &&
    raw.businessFocus !== "facility-parties" &&
    raw.businessFocus !== "both"
  ) {
    return { ok: false, reason: "businessFocus is invalid." };
  }
  if (typeof raw.revisionOfPrior !== "boolean") {
    return { ok: false, reason: "revisionOfPrior must be a boolean." };
  }
  if (
    raw.campaignId !== null &&
    !(typeof raw.campaignId === "string" && raw.campaignId.trim())
  ) {
    return { ok: false, reason: "campaignId must be a string or null." };
  }

  let platforms: ("facebook" | "instagram")[];
  let platformSpecificConstraints: string[];
  let sourceImageKeywords: string[];
  let ownerInputRequired: string[];
  try {
    platforms = requireExactStringArray(raw.platforms, "platforms", {
      min: 1,
      max: 2,
      itemMax: 32,
      allowedValues: VALID_PLATFORMS,
    }) as ("facebook" | "instagram")[];
    platformSpecificConstraints = requireExactStringArray(
      raw.platformSpecificConstraints,
      "platformSpecificConstraints",
      { min: 1, max: 12, itemMax: 240 },
    );
    sourceImageKeywords = requireExactStringArray(
      raw.sourceImageKeywords,
      "sourceImageKeywords",
      {
        min: 3,
        max: AGENT_INPUT_LIMITS.keywordCount,
        itemMax: AGENT_INPUT_LIMITS.keyword,
      },
    ).map((keyword) => keyword.toLowerCase());
    ownerInputRequired = requireExactStringArray(
      raw.ownerInputRequired,
      "ownerInputRequired",
      { min: 0, max: 12, itemMax: 240 },
    );
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Invalid array fields.",
    };
  }

  const claimScan = `${raw.title}\n${raw.caption}\n${raw.generationPrompt}`;
  const claims = scanProhibitedBusinessClaims(claimScan);
  if (claims.length > 0) {
    return {
      ok: false,
      reason: `Prohibited business claims in creative output: ${claims.join("; ")}`,
    };
  }

  return {
    ok: true,
    output: {
      title: bound(String(raw.title), AGENT_INPUT_LIMITS.title),
      caption: bound(String(raw.caption), AGENT_INPUT_LIMITS.caption),
      generationPrompt: bound(String(raw.generationPrompt), AGENT_INPUT_LIMITS.prompt),
      mediaType: raw.mediaType,
      platforms,
      businessFocus: raw.businessFocus,
      campaignId:
        raw.campaignId === null ? null : bound(String(raw.campaignId), 80),
      goal: bound(String(raw.goal), AGENT_INPUT_LIMITS.goal),
      assetUsageGuidance: bound(String(raw.assetUsageGuidance), 800),
      visualDirection: bound(String(raw.visualDirection), 1200),
      platformSpecificConstraints,
      sourceImageKeywords,
      ownerInputRequired,
      revisionOfPrior: raw.revisionOfPrior,
    },
  };
}

export function buildDeterministicCreativeDirectorOutput(
  input: CreativeDirectorAgentInput,
): CreativeDirectorOutput {
  const s = input.strategist;
  const revising = Boolean(input.priorCreative && input.revisionInstructions?.length);
  const prior = input.priorCreative;
  const mediaType = s.mediaType;
  const themeLabel = input.themeContext?.themeLabel ?? null;
  const gamerTheme = input.themeContext?.styleFamily === "gamer";
  const facilityParty = s.businessFocus === "facility-parties";
  const title = bound(
    prior && revising
      ? prior.title.replace(/\s*\(revised\)\s*$/i, "")
      : gamerTheme
        ? "Level Up the Birthday Fun at Jumping Jax"
        : themeLabel
          ? `${themeLabel} Party Magic at Jumping Jax`
          : facilityParty
            ? "Big Birthday Energy—Indoors at Jumping Jax"
            : "Bring the Party to Life with Jumping Jax",
    AGENT_INPUT_LIMITS.title,
  );
  const caption = bound(
    prior && revising
      ? prior.caption
      : facilityParty
        ? `${gamerTheme ? "Planning an indoor birthday in Greenwood?" : `Planning a ${themeLabel ?? "birthday"} party in Greenwood?`} Bring your crew to Jumping Jax for active play and a ${gamerTheme ? "gamer-neon" : (themeLabel ?? "colorful").toLowerCase()} party atmosphere. Message us to ask about facility-party details.`
        : `${s.angleMessage} ${s.ctaIntent} Family-friendly fun with Jumping Jax in the Greenwood, SC area.`.slice(0, AGENT_INPUT_LIMITS.caption),
    AGENT_INPUT_LIMITS.caption,
  );
  const generationPrompt = bound(
    prior && revising
      ? `Create a polished ${mediaType} for a Jumping Jax indoor facility party in Greenwood, SC. Use a generic ${themeLabel ?? "colorful party"} aesthetic with bold blue and navy, yellow highlights, cyan accents, controller-inspired geometric motifs, speed lines, stars, and gems. Treat any owner-approved themed artwork as internal mood-board inspiration only: do not reproduce a branded character, logo, composition, or trade dress, and do not mention Sonic or any official licensing. Show a clean, believable family-party setting with no on-screen text or invented offers. Keep the composition concise and suitable for Facebook and Instagram.`.slice(0, AGENT_INPUT_LIMITS.prompt)
      : `Create a polished family-friendly promotional ${mediaType} for Jumping Jax. ${themeLabel ? `Use a ${themeLabel} party direction with ${input.themeContext?.palette.background ?? "the approved"} blue, ${input.themeContext?.palette.accent ?? "gold"}, and energetic graphic accents.` : ""} Show a believable indoor facility-party moment in Greenwood, SC. ${
          s.selectedAssetContext
            ? `Preserve the selected reference exactly: ${s.selectedAssetContext}.`
            : "Use approved Jumping Jax catalog product imagery only."
        } Use candid celebration energy, a clean uncluttered composition, natural expressions, and responsible adult supervision. No text on screen. Do not claim official theme endorsement or licensing. Tone: ${s.tone}.`.slice(
          0,
          AGENT_INPUT_LIMITS.prompt,
        ),
    AGENT_INPUT_LIMITS.prompt,
  );

  return {
    title,
    caption,
    generationPrompt,
    mediaType,
    platforms: s.platforms,
    businessFocus: s.businessFocus,
    campaignId: s.campaignId,
    goal: s.goal,
    assetUsageGuidance: bound(
      revising && themeLabel
        ? `Use ${themeLabel} library colors and generic motifs only. The approved theme artwork is an internal mood-board reference, not an instruction to copy branded characters, logos, composition, or trade dress.`
        : s.selectedAssetContext
        ? `Use the verified asset exactly: ${s.selectedAssetContext}`
        : "Use an approved Jumping Jax catalog asset; do not invent products.",
      800,
    ),
    visualDirection: bound(
      revising && themeLabel
        ? `Generic ${themeLabel} indoor party energy: blue/navy base, yellow and cyan accents, controller-inspired geometry, speed lines, stars, and gems. No branded character or logo reproduction.`
        : `${s.notesForCreativeDirector.join(" ")} Constraints: ${s.creativeConstraints.join(" ")}`,
      1200,
    ),
    platformSpecificConstraints: [
      s.platformGuidance,
      "No baked-in on-screen text",
      "Keep first-line hook clear for social feed scanning",
    ],
    sourceImageKeywords:
      s.sourceImageKeywords.length >= 3
        ? s.sourceImageKeywords
        : ["jumping", "jax", "inflatable", "family", "party"],
    ownerInputRequired: [
      ...s.ownerInputRequired,
      ...(input.complianceFindings ?? []).slice(0, 3),
    ].slice(0, 12),
    revisionOfPrior: revising,
  };
}

function diagnosticsFrom(
  partial: Omit<AgentDiagnostics, "agentId">,
): AgentDiagnostics {
  return { agentId: "creative-director", ...partial };
}

export async function runCreativeDirectorAgent(
  input: CreativeDirectorAgentInput,
  options?: { client?: LlmJsonClient; onModelCall?: () => void },
): Promise<AgentResult<CreativeDirectorOutput>> {
  const client = options?.client ?? getDefaultLlmJsonClient();
  const requestId = createRequestId("creative_director");
  const fallback = buildDeterministicCreativeDirectorOutput(input);
  const { system, user } = buildCreativeDirectorRequestPayload(input);

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

  options?.onModelCall?.();
  const llm = await client.completeJson({
    system,
    user,
    requestId,
    temperature: 0.45,
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

  const validated = validateCreativeDirectorOutputDetailed(llm.parsed);
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

  const revising = Boolean(
    input.priorCreative && input.revisionInstructions?.length,
  );
  return {
    ok: true,
    output: {
      ...validated.output,
      revisionOfPrior: revising,
      mediaType: input.strategist.mediaType,
      platforms: input.strategist.platforms,
      businessFocus: input.strategist.businessFocus,
      campaignId: input.strategist.campaignId,
      goal: input.strategist.goal,
    },
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

/** Map creative package into the legacy SocialAgentPlan-shaped fields used by persistence. */
export function creativeDirectorToPersistablePlan(
  creative: CreativeDirectorOutput,
): {
  title: string;
  caption: string;
  generationPrompt: string;
  mediaType: "image" | "video";
  platforms: ("facebook" | "instagram")[];
  businessFocus: "rentals" | "facility-parties" | "both";
  campaignId: string | null;
  goal: string;
  sourceImageKeywords: string[];
} {
  return {
    title: creative.title,
    caption: creative.caption,
    generationPrompt: creative.generationPrompt,
    mediaType: creative.mediaType,
    platforms: creative.platforms,
    businessFocus: creative.businessFocus,
    campaignId: creative.campaignId,
    goal: creative.goal,
    sourceImageKeywords: creative.sourceImageKeywords,
  };
}
