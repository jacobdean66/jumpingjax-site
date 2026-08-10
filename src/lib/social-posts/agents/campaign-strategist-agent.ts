import type { SocialAgentInput } from "../social-agent";
import { getSocialCampaign } from "../social-campaigns";
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
import type { CampaignStrategistOutput } from "./orchestration-types";

const VALID_PLATFORMS = ["facebook", "instagram"] as const;

const STRATEGIST_KEYS = [
  "campaignObjective",
  "audience",
  "angleMessage",
  "ctaIntent",
  "platformGuidance",
  "selectedAssetContext",
  "creativeConstraints",
  "notesForCreativeDirector",
  "goal",
  "campaignId",
  "mediaType",
  "platforms",
  "businessFocus",
  "tone",
  "factualConstraints",
  "ownerInputRequired",
  "sourceImageKeywords",
  "seasonalContextUsed",
] as const;

export type CampaignStrategistInput = SocialAgentInput & {
  audience?: string;
  tone?: string;
  callToAction?: string;
  seasonalContext?: string | null;
  assetContext?: string | null;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function bound(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export function buildCampaignStrategistRequestPayload(
  input: CampaignStrategistInput,
): { system: string; user: string } {
  const campaign = getSocialCampaign(input.campaignId);
  const seasonal =
    typeof input.seasonalContext === "string" && input.seasonalContext.trim()
      ? input.seasonalContext.trim().slice(0, AGENT_INPUT_LIMITS.seasonalContext)
      : null;
  const asset =
    typeof input.assetContext === "string" && input.assetContext.trim()
      ? input.assetContext.trim().slice(0, AGENT_INPUT_LIMITS.assetContext)
      : null;

  const system = `You are the Campaign Strategist for Jumping Jax (Greenwood, SC inflatable rentals and indoor parties).
Return ONLY valid JSON matching the schema. No markdown.

You plan the campaign — you do NOT write final captions, image prompts, video prompts, approve, publish, schedule, advertise, or spend money.

Hard rules:
- Do not invent prices, promotions, discounts, dates, inventory, availability, or customer stories.
- Put missing facts in ownerInputRequired.
- Preserve verified selected-asset identity in selectedAssetContext and notesForCreativeDirector.
- mediaType should be "video" unless a still is clearly required.
- platforms must be ["facebook"] and/or ["instagram"].
- seasonalContextUsed / selectedAssetContext must be null unless that context was supplied.`;

  const user = JSON.stringify({
    request: {
      goal: input.goal ?? null,
      campaignId: input.campaignId ?? null,
      platform: input.platform ?? "both",
      mediaType: input.mediaType ?? "video",
      businessFocus: input.businessFocus ?? "both",
      audience: input.audience ?? null,
      tone: input.tone ?? null,
      callToAction: input.callToAction ?? null,
      seasonalContext: seasonal,
      assetContext: asset,
    },
    campaignCatalog: campaign
      ? { id: campaign.id, label: campaign.label }
      : null,
    schemaKeys: STRATEGIST_KEYS,
  });

  return { system, user };
}

export function validateCampaignStrategistOutputDetailed(
  value: unknown,
): { ok: true; output: CampaignStrategistOutput } | { ok: false; reason: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, reason: "Campaign Strategist output must be an object." };
  }
  const raw = value as Record<string, unknown>;
  try {
    rejectUnknownKeys(raw, STRATEGIST_KEYS, "Campaign Strategist output");
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Unknown keys rejected.",
    };
  }

  const requiredStrings = [
    "campaignObjective",
    "audience",
    "angleMessage",
    "ctaIntent",
    "platformGuidance",
    "goal",
    "tone",
  ] as const;
  for (const key of requiredStrings) {
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

  let platforms: ("facebook" | "instagram")[];
  let creativeConstraints: string[];
  let notesForCreativeDirector: string[];
  let factualConstraints: string[];
  let ownerInputRequired: string[];
  let sourceImageKeywords: string[];
  try {
    platforms = requireExactStringArray(raw.platforms, "platforms", {
      min: 1,
      max: 2,
      itemMax: 32,
      allowedValues: VALID_PLATFORMS,
    }) as ("facebook" | "instagram")[];
    creativeConstraints = requireExactStringArray(
      raw.creativeConstraints,
      "creativeConstraints",
      { min: 1, max: 12, itemMax: 240 },
    );
    notesForCreativeDirector = requireExactStringArray(
      raw.notesForCreativeDirector,
      "notesForCreativeDirector",
      { min: 1, max: 12, itemMax: 400 },
    );
    factualConstraints = requireExactStringArray(
      raw.factualConstraints,
      "factualConstraints",
      { min: 1, max: 12, itemMax: 240 },
    );
    ownerInputRequired = requireExactStringArray(
      raw.ownerInputRequired,
      "ownerInputRequired",
      { min: 0, max: 12, itemMax: 240 },
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
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Invalid array fields.",
    };
  }

  if (
    raw.campaignId !== null &&
    !(typeof raw.campaignId === "string" && raw.campaignId.trim())
  ) {
    return { ok: false, reason: "campaignId must be a string or null." };
  }
  if (
    raw.selectedAssetContext !== null &&
    typeof raw.selectedAssetContext !== "string"
  ) {
    return { ok: false, reason: "selectedAssetContext must be a string or null." };
  }
  if (
    raw.seasonalContextUsed !== null &&
    typeof raw.seasonalContextUsed !== "string"
  ) {
    return { ok: false, reason: "seasonalContextUsed must be a string or null." };
  }

  const claimScan = [
    String(raw.campaignObjective),
    String(raw.angleMessage),
    String(raw.ctaIntent),
    ...(raw.notesForCreativeDirector as string[]),
  ].join("\n");
  const claims = scanProhibitedBusinessClaims(claimScan);
  if (claims.length > 0) {
    return {
      ok: false,
      reason: `Prohibited business claims in strategist output: ${claims.join("; ")}`,
    };
  }

  return {
    ok: true,
    output: {
      campaignObjective: bound(String(raw.campaignObjective), 400),
      audience: bound(String(raw.audience), AGENT_INPUT_LIMITS.audience),
      angleMessage: bound(String(raw.angleMessage), 600),
      ctaIntent: bound(String(raw.ctaIntent), AGENT_INPUT_LIMITS.callToAction),
      platformGuidance: bound(String(raw.platformGuidance), 600),
      selectedAssetContext:
        raw.selectedAssetContext === null
          ? null
          : bound(String(raw.selectedAssetContext), AGENT_INPUT_LIMITS.assetContext),
      creativeConstraints: creativeConstraints.map((item) => bound(item, 240)),
      notesForCreativeDirector: notesForCreativeDirector.map((item) =>
        bound(item, 400),
      ),
      goal: bound(String(raw.goal), AGENT_INPUT_LIMITS.goal),
      campaignId:
        raw.campaignId === null ? null : bound(String(raw.campaignId), 80),
      mediaType: raw.mediaType,
      platforms,
      businessFocus: raw.businessFocus,
      tone: bound(String(raw.tone), AGENT_INPUT_LIMITS.tone),
      factualConstraints: factualConstraints.map((item) => bound(item, 240)),
      ownerInputRequired: ownerInputRequired.map((item) => bound(item, 240)),
      sourceImageKeywords,
      seasonalContextUsed:
        raw.seasonalContextUsed === null
          ? null
          : bound(
              String(raw.seasonalContextUsed),
              AGENT_INPUT_LIMITS.seasonalContext,
            ),
    },
  };
}

export function buildDeterministicCampaignStrategistPlan(
  input: CampaignStrategistInput,
): CampaignStrategistOutput {
  const campaign = getSocialCampaign(input.campaignId);
  const goal = bound(
    input.goal?.trim() ||
      campaign?.label ||
      "Promote Jumping Jax family-friendly inflatable fun",
    AGENT_INPUT_LIMITS.goal,
  );
  const mediaType =
    input.mediaType === "image" || input.mediaType === "video"
      ? input.mediaType
      : "video";
  const businessFocus =
    input.businessFocus === "rentals" ||
    input.businessFocus === "facility-parties" ||
    input.businessFocus === "both"
      ? input.businessFocus
      : "both";
  const platforms: ("facebook" | "instagram")[] =
    input.platform === "facebook"
      ? ["facebook"]
      : input.platform === "instagram"
        ? ["instagram"]
        : ["facebook", "instagram"];
  const seasonal =
    typeof input.seasonalContext === "string" && input.seasonalContext.trim()
      ? bound(input.seasonalContext, AGENT_INPUT_LIMITS.seasonalContext)
      : null;
  const asset =
    typeof input.assetContext === "string" && input.assetContext.trim()
      ? bound(input.assetContext, AGENT_INPUT_LIMITS.assetContext)
      : null;

  return {
    campaignObjective: bound(
      `Drive awareness and inquiries for ${goal}.`,
      400,
    ),
    audience: bound(
      input.audience?.trim() ||
        "Local Greenwood SC families planning birthday parties and backyard rentals",
      AGENT_INPUT_LIMITS.audience,
    ),
    angleMessage: bound(
      `Highlight clean, exciting, family-friendly Jumping Jax experiences aligned with: ${goal}.`,
      600,
    ),
    ctaIntent: bound(
      input.callToAction?.trim() ||
        "Invite families to message Jumping Jax for party or rental details (owner confirms facts).",
      AGENT_INPUT_LIMITS.callToAction,
    ),
    platformGuidance: bound(
      platforms.length === 2
        ? "Fit both Facebook and Instagram with a clear first-line hook."
        : `Optimize primarily for ${platforms[0]}.`,
      600,
    ),
    selectedAssetContext: asset,
    creativeConstraints: [
      "No invented prices, promotions, dates, or availability.",
      "No on-screen text baked into generated media.",
      "Preserve approved catalog asset identity when an asset is selected.",
      "Family-friendly, safe, local Greenwood SC tone.",
    ],
    notesForCreativeDirector: [
      `Goal: ${goal}`,
      asset
        ? `Use verified asset context exactly: ${asset}`
        : "No verified asset selected; keep product visuals generic/approved catalog only.",
      seasonal
        ? `Seasonal context provided: ${seasonal}`
        : "No seasonal context supplied.",
      "Do not approve, publish, schedule, advertise, or start paid generation.",
    ],
    goal,
    campaignId: campaign?.id ?? (input.campaignId?.trim() || null),
    mediaType,
    platforms,
    businessFocus,
    tone: bound(
      input.tone?.trim() || "upbeat, clean, family-friendly",
      AGENT_INPUT_LIMITS.tone,
    ),
    factualConstraints: [
      "Do not invent prices, promotions, discounts, or limited-time offers.",
      "Do not invent inventory, availability, dates, or booking guarantees.",
      "Do not invent customer stories or reviews.",
    ],
    ownerInputRequired: [
      "Confirm any price, promotion, date, or availability claims before publishing.",
    ],
    sourceImageKeywords: ["jumping", "jax", "inflatable", "family", "party"],
    seasonalContextUsed: seasonal,
  };
}

function diagnosticsFrom(
  partial: Omit<AgentDiagnostics, "agentId">,
): AgentDiagnostics {
  return { agentId: "campaign-strategist", ...partial };
}

export async function runCampaignStrategistAgent(
  input: CampaignStrategistInput,
  options?: { client?: LlmJsonClient; onModelCall?: () => void },
): Promise<AgentResult<CampaignStrategistOutput>> {
  const client = options?.client ?? getDefaultLlmJsonClient();
  const requestId = createRequestId("campaign_strategist");
  const fallback = buildDeterministicCampaignStrategistPlan(input);
  const { system, user } = buildCampaignStrategistRequestPayload(input);

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
    maxOutputTokens: 1_100,
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

  const validated = validateCampaignStrategistOutputDetailed(llm.parsed);
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
  const sanitized: CampaignStrategistOutput = {
    ...validated.output,
    seasonalContextUsed: seasonalSupplied
      ? validated.output.seasonalContextUsed
      : null,
    selectedAssetContext: assetSupplied
      ? validated.output.selectedAssetContext ??
        bound(String(input.assetContext), AGENT_INPUT_LIMITS.assetContext)
      : null,
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
