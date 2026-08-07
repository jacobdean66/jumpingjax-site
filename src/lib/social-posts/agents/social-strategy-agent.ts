import type { SocialAgentInput } from "../social-agent";
import { getSocialCampaign, SOCIAL_CAMPAIGNS } from "../social-campaigns";
import { SOCIAL_SOURCE_IMAGES } from "../social-source-images";
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
  createOpenAiJsonClient,
  getDefaultLlmJsonClient,
  type LlmJsonClient,
} from "./llm-json-client";

const VALID_MEDIA_TYPES = ["image", "video"] as const;
const VALID_PLATFORMS = ["facebook", "instagram"] as const;
const VALID_BUSINESS_FOCUS = ["rentals", "facility-parties", "both"] as const;

const STRATEGY_PLAN_KEYS = [
  "title",
  "caption",
  "generationPrompt",
  "mediaType",
  "platforms",
  "businessFocus",
  "goal",
  "campaignId",
  "sourceImageKeywords",
  "audience",
  "tone",
  "callToAction",
  "factualConstraints",
  "ownerInputRequired",
  "seasonalContextUsed",
  "assetContextUsed",
  "platformNotes",
] as const;

export type SocialStrategyAgentInput = SocialAgentInput & {
  audience?: string;
  tone?: string;
  callToAction?: string;
  /** Only included when the caller actually supplies seasonal context. */
  seasonalContext?: string | null;
  /** Only included when the caller actually supplies verified asset context. */
  assetContext?: string | null;
};

export type SocialStrategyPlan = {
  title: string;
  caption: string;
  generationPrompt: string;
  mediaType: "image" | "video";
  platforms: ("facebook" | "instagram")[];
  businessFocus: "rentals" | "facility-parties" | "both";
  goal: string;
  campaignId: string | null;
  sourceImageKeywords: string[];
  audience: string;
  tone: string;
  callToAction: string;
  factualConstraints: string[];
  ownerInputRequired: string[];
  seasonalContextUsed: string | null;
  assetContextUsed: string | null;
  platformNotes: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function boundFallbackText(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export function buildSocialStrategyRequestPayload(
  input: SocialStrategyAgentInput,
): {
  system: string;
  user: string;
} {
  const campaign = getSocialCampaign(input.campaignId);
  const seasonal =
    typeof input.seasonalContext === "string" && input.seasonalContext.trim()
      ? input.seasonalContext.trim().slice(0, AGENT_INPUT_LIMITS.seasonalContext)
      : null;
  const asset =
    typeof input.assetContext === "string" && input.assetContext.trim()
      ? input.assetContext.trim().slice(0, AGENT_INPUT_LIMITS.assetContext)
      : null;

  const system = `You are the Social Strategy / Copy Agent for Jumping Jax, a family-friendly inflatable rental and indoor party business in Greenwood, SC.
Return ONLY valid JSON matching the requested schema. No markdown fences or extra keys.

Hard rules:
- Do NOT invent Jumping Jax prices, promotions, discounts, dates, inventory counts, availability, customer information, or unverified business claims.
- If a fact is missing, put a clear owner-input request in ownerInputRequired instead of guessing.
- When verified selected-asset context is supplied, preserve that exact product identity, colors, and geometry in generationPrompt.
- Voice: upbeat, clean, local, family-friendly, and safe.
- generationPrompt must describe promotional media with no on-screen text baked into the media.
- mediaType should be "video" unless the request clearly needs a still image.
- platforms must be an array of "facebook" and/or "instagram" with no invalid members.
- campaignId must be one of the provided campaign ids, or null when no campaign fits.
- sourceImageKeywords must be 3-8 lowercase keywords that help match rental/product source imagery.
- seasonalContextUsed must be null unless seasonal context was actually supplied.
- assetContextUsed must be null unless asset context was actually supplied.
- factualConstraints must list claims the draft must avoid fabricating.`;

  const user = JSON.stringify({
    request: {
      goal: input.goal ?? null,
      campaignId: input.campaignId ?? null,
      platform: input.platform ?? "both",
      mediaType: input.mediaType ?? null,
      businessFocus: input.businessFocus ?? "both",
      audience: input.audience ?? null,
      tone: input.tone ?? null,
      callToAction: input.callToAction ?? null,
      seasonalContext: seasonal,
      assetContext: asset,
    },
    selectedCampaign: campaign
      ? {
          id: campaign.id,
          label: campaign.label,
          description: campaign.description,
          businessFocus: campaign.businessFocus,
          goalTemplates: campaign.goalTemplates,
        }
      : null,
    availableCampaigns: SOCIAL_CAMPAIGNS.map((entry) => ({
      id: entry.id,
      label: entry.label,
      description: entry.description,
      businessFocus: entry.businessFocus,
      goalTemplates: entry.goalTemplates,
    })),
    availableSourceImageMetadata: SOCIAL_SOURCE_IMAGES.map((image) => ({
      label: image.label,
      category: image.category,
      focus: image.focus,
    })),
    outputSchema: {
      title: "string",
      caption: "string",
      generationPrompt: "string",
      mediaType: "image | video",
      platforms: 'array of "facebook" and/or "instagram"',
      businessFocus: "rentals | facility-parties | both",
      goal: "string",
      campaignId: "string | null",
      sourceImageKeywords: "array of strings",
      audience: "string",
      tone: "string",
      callToAction: "string",
      factualConstraints: "array of strings",
      ownerInputRequired: "array of strings",
      seasonalContextUsed: "string | null",
      assetContextUsed: "string | null",
      platformNotes: "string",
    },
  });

  return { system, user };
}

export type SocialStrategyValidationResult =
  | { ok: true; plan: SocialStrategyPlan }
  | { ok: false; reason: string };

export function validateSocialStrategyPlanDetailed(
  raw: unknown,
): SocialStrategyValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "Model response failed schema validation." };
  }
  const plan = raw as Record<string, unknown>;

  try {
    rejectUnknownKeys(plan, STRATEGY_PLAN_KEYS, "Social strategy plan");
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Unknown keys rejected.",
    };
  }

  if (!isNonEmptyString(plan.title)) {
    return { ok: false, reason: "title is required." };
  }
  if (!isNonEmptyString(plan.caption)) {
    return { ok: false, reason: "caption is required." };
  }
  if (!isNonEmptyString(plan.generationPrompt)) {
    return { ok: false, reason: "generationPrompt is required." };
  }
  if (!isNonEmptyString(plan.goal)) {
    return { ok: false, reason: "goal is required." };
  }
  if (!isNonEmptyString(plan.audience)) {
    return { ok: false, reason: "audience is required." };
  }
  if (!isNonEmptyString(plan.tone)) {
    return { ok: false, reason: "tone is required." };
  }
  if (!isNonEmptyString(plan.callToAction)) {
    return { ok: false, reason: "callToAction is required." };
  }
  if (!isNonEmptyString(plan.platformNotes)) {
    return { ok: false, reason: "platformNotes is required." };
  }

  if (
    !VALID_MEDIA_TYPES.includes(
      plan.mediaType as (typeof VALID_MEDIA_TYPES)[number],
    )
  ) {
    return { ok: false, reason: "mediaType is invalid." };
  }

  if (
    !VALID_BUSINESS_FOCUS.includes(
      plan.businessFocus as (typeof VALID_BUSINESS_FOCUS)[number],
    )
  ) {
    return { ok: false, reason: "businessFocus is invalid." };
  }

  let platforms: ("facebook" | "instagram")[];
  try {
    platforms = requireExactStringArray(plan.platforms, "platforms", {
      min: 1,
      max: 2,
      itemMax: 32,
      allowedValues: VALID_PLATFORMS,
    }) as ("facebook" | "instagram")[];
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "platforms invalid.",
    };
  }

  let campaignId: string | null = null;
  if (plan.campaignId !== null && plan.campaignId !== undefined) {
    if (!isNonEmptyString(plan.campaignId)) {
      return { ok: false, reason: "campaignId must be string or null." };
    }
    if (!SOCIAL_CAMPAIGNS.some((campaign) => campaign.id === plan.campaignId)) {
      return { ok: false, reason: "campaignId is not an approved campaign." };
    }
    campaignId = plan.campaignId.trim();
  }

  let sourceImageKeywords: string[];
  let factualConstraints: string[];
  let ownerInputRequired: string[];
  try {
    sourceImageKeywords = requireExactStringArray(
      plan.sourceImageKeywords,
      "sourceImageKeywords",
      {
        min: 3,
        max: AGENT_INPUT_LIMITS.keywordCount,
        itemMax: AGENT_INPUT_LIMITS.keyword,
      },
    ).map((keyword) => keyword.toLowerCase());
    factualConstraints = requireExactStringArray(
      plan.factualConstraints,
      "factualConstraints",
      {
        min: 1,
        max: AGENT_INPUT_LIMITS.stringArrayCount,
        itemMax: AGENT_INPUT_LIMITS.stringArrayItem,
      },
    );
    ownerInputRequired = requireExactStringArray(
      plan.ownerInputRequired,
      "ownerInputRequired",
      {
        min: 0,
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

  const seasonalContextUsed =
    plan.seasonalContextUsed === null || plan.seasonalContextUsed === undefined
      ? null
      : isNonEmptyString(plan.seasonalContextUsed)
        ? plan.seasonalContextUsed.trim().slice(0, AGENT_INPUT_LIMITS.seasonalContext)
        : null;
  if (
    plan.seasonalContextUsed !== null &&
    plan.seasonalContextUsed !== undefined &&
    seasonalContextUsed === null
  ) {
    return { ok: false, reason: "seasonalContextUsed must be string or null." };
  }

  const assetContextUsed =
    plan.assetContextUsed === null || plan.assetContextUsed === undefined
      ? null
      : isNonEmptyString(plan.assetContextUsed)
        ? plan.assetContextUsed.trim().slice(0, AGENT_INPUT_LIMITS.assetContext)
        : null;
  if (
    plan.assetContextUsed !== null &&
    plan.assetContextUsed !== undefined &&
    assetContextUsed === null
  ) {
    return { ok: false, reason: "assetContextUsed must be string or null." };
  }

  const title = plan.title.trim().slice(0, AGENT_INPUT_LIMITS.title);
  const caption = plan.caption.trim().slice(0, AGENT_INPUT_LIMITS.caption);
  const generationPrompt = plan.generationPrompt
    .trim()
    .slice(0, AGENT_INPUT_LIMITS.prompt);

  const claimHits = scanProhibitedBusinessClaims(
    `${title}\n${caption}\n${generationPrompt}\n${plan.callToAction}`,
  );
  if (claimHits.length > 0) {
    return {
      ok: false,
      reason: `Model response failed schema validation: prohibited business claims (${claimHits[0]}).`,
    };
  }

  return {
    ok: true,
    plan: {
      title,
      caption,
      generationPrompt,
      mediaType: plan.mediaType as "image" | "video",
      platforms,
      businessFocus: plan.businessFocus as "rentals" | "facility-parties" | "both",
      goal: plan.goal.trim().slice(0, AGENT_INPUT_LIMITS.goal),
      campaignId,
      sourceImageKeywords,
      audience: plan.audience.trim().slice(0, AGENT_INPUT_LIMITS.audience),
      tone: plan.tone.trim().slice(0, AGENT_INPUT_LIMITS.tone),
      callToAction: plan.callToAction.trim().slice(0, AGENT_INPUT_LIMITS.callToAction),
      factualConstraints,
      ownerInputRequired,
      seasonalContextUsed,
      assetContextUsed,
      platformNotes: plan.platformNotes.trim().slice(0, AGENT_INPUT_LIMITS.platformNotes),
    },
  };
}

export function validateSocialStrategyPlan(
  raw: unknown,
): SocialStrategyPlan | null {
  const result = validateSocialStrategyPlanDetailed(raw);
  return result.ok ? result.plan : null;
}

export function buildDeterministicSocialStrategyPlan(
  input: SocialStrategyAgentInput,
): SocialStrategyPlan {
  const campaign = getSocialCampaign(input.campaignId);
  const mediaType = input.mediaType ?? campaign?.defaultMediaType ?? "video";
  const businessFocus =
    campaign?.businessFocus ??
    (input.businessFocus === "rentals" ||
    input.businessFocus === "facility-parties" ||
    input.businessFocus === "both"
      ? input.businessFocus
      : "both");
  const platforms =
    input.platform === "facebook"
      ? (["facebook"] as ("facebook" | "instagram")[])
      : input.platform === "instagram"
        ? (["instagram"] as ("facebook" | "instagram")[])
        : (["facebook", "instagram"] as ("facebook" | "instagram")[]);
  const goal = boundFallbackText(
    input.goal?.trim() ||
      campaign?.goalTemplates[0] ||
      "Promote clean and safe local family fun",
    AGENT_INPUT_LIMITS.goal,
  );
  const seasonal =
    typeof input.seasonalContext === "string" && input.seasonalContext.trim()
      ? boundFallbackText(input.seasonalContext, AGENT_INPUT_LIMITS.seasonalContext)
      : null;
  const asset =
    typeof input.assetContext === "string" && input.assetContext.trim()
      ? boundFallbackText(input.assetContext, AGENT_INPUT_LIMITS.assetContext)
      : null;

  const title = boundFallbackText(
    campaign?.label ?? "Family-Friendly Fun with Jumping Jax",
    AGENT_INPUT_LIMITS.title,
  );
  const caption = boundFallbackText(
    campaign
      ? `${campaign.captionAngles[0] ?? ""} ${campaign.description}`.trim()
      : businessFocus === "facility-parties"
        ? "Plan a birthday party that feels easy, fun, and exciting at Jumping Jax in the Greenwood SC area."
        : "Bring family-friendly inflatable fun to your next party with Jumping Jax in the Greenwood SC area.",
    AGENT_INPUT_LIMITS.caption,
  );

  const promptAngle =
    campaign?.promptAngles[0] ??
    "colorful inflatables, happy families, bright daytime lighting";
  const assetClause = asset
    ? ` Use the verified selected asset (${asset}). Preserve exact product identity, colors, and geometry.`
    : "";
  const generationPrompt = boundFallbackText(
    `Create a short family-friendly promotional ${mediaType} for Jumping Jax. Visual direction: ${promptAngle}. Keep it upbeat, clean, local, and safe. No text on screen. Focus: ${goal}.${assetClause}`,
    AGENT_INPUT_LIMITS.prompt,
  );

  return {
    title,
    caption,
    generationPrompt,
    mediaType,
    platforms,
    businessFocus,
    goal,
    campaignId: campaign?.id ?? null,
    sourceImageKeywords: (campaign?.preferredImageKeywords ?? [
      "bounce",
      "party",
      "family",
      "inflatable",
    ]).slice(0, AGENT_INPUT_LIMITS.keywordCount),
    audience: boundFallbackText(
      input.audience?.trim() ||
        "Local Greenwood SC families planning birthday parties and backyard rentals",
      AGENT_INPUT_LIMITS.audience,
    ),
    tone: boundFallbackText(
      input.tone?.trim() || "upbeat, clean, family-friendly",
      AGENT_INPUT_LIMITS.tone,
    ),
    callToAction: boundFallbackText(
      input.callToAction?.trim() ||
        "Message Jumping Jax to ask about party or rental options (owner to confirm details).",
      AGENT_INPUT_LIMITS.callToAction,
    ),
    factualConstraints: [
      "Do not invent prices, promotions, discounts, or limited-time offers.",
      "Do not invent inventory, availability, dates, or booking guarantees.",
      "Do not invent customer stories or reviews.",
    ],
    ownerInputRequired: [
      "Confirm any price, promotion, date, or availability claims before publishing.",
      ...(seasonal
        ? []
        : [
            "Optional: supply seasonal context if a holiday or local event should be referenced.",
          ]),
      ...(asset
        ? []
        : [
            "Optional: select an approved catalog asset if a specific rental must be featured.",
          ]),
    ],
    seasonalContextUsed: seasonal,
    assetContextUsed: asset,
    platformNotes: boundFallbackText(
      platforms.length === 2
        ? "Fit both Facebook and Instagram with a clear hook in the first line."
        : `Optimize primarily for ${platforms[0]}.`,
      AGENT_INPUT_LIMITS.platformNotes,
    ),
  };
}

function diagnosticsFrom(
  partial: Omit<AgentDiagnostics, "agentId">,
): AgentDiagnostics {
  return {
    agentId: "social-strategy-copy",
    ...partial,
  };
}

export async function runSocialStrategyAgent(
  input: SocialStrategyAgentInput,
  options?: { client?: LlmJsonClient },
): Promise<AgentResult<SocialStrategyPlan>> {
  const client = options?.client ?? getDefaultLlmJsonClient();
  const requestId = createRequestId("social_strategy");
  const { system, user } = buildSocialStrategyRequestPayload(input);
  const fallback = buildDeterministicSocialStrategyPlan(input);

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
    temperature: 0.5,
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

  const validated = validateSocialStrategyPlanDetailed(llm.parsed);
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

  const seasonalSupplied =
    typeof input.seasonalContext === "string" &&
    Boolean(input.seasonalContext.trim());
  const assetSupplied =
    typeof input.assetContext === "string" && Boolean(input.assetContext.trim());
  const sanitized: SocialStrategyPlan = {
    ...validated.plan,
    seasonalContextUsed: seasonalSupplied
      ? validated.plan.seasonalContextUsed
      : null,
    assetContextUsed: assetSupplied ? validated.plan.assetContextUsed : null,
  };

  return {
    ok: true,
    output: sanitized,
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

/** Back-compat helper used by older creative-director call sites. */
export async function planWithOpenAICreativeDirector(
  input: SocialAgentInput,
): Promise<SocialStrategyPlan | null> {
  const result = await runSocialStrategyAgent(input, {
    client: createOpenAiJsonClient(),
  });
  if (!result.ok || result.diagnostics.source !== "model") {
    return null;
  }
  return result.output;
}
