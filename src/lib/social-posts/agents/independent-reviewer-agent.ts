import {
  rejectUnknownKeys,
  requireExactStringArray,
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
  IndependentReviewerOutput,
} from "./orchestration-types";

const REVIEWER_KEYS = [
  "verdict",
  "reasoning",
  "revisionInstructions",
  "flags",
  "grantsOwnerApproval",
] as const;

export type IndependentReviewerAgentInput = {
  strategist: CampaignStrategistOutput;
  creative: CreativeDirectorOutput;
  workflowContextSummary?: string | null;
  complianceSummary?: string | null;
  complianceDecision?: "allow" | "quarantine" | "block" | null;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function bound(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export function buildIndependentReviewerRequestPayload(
  input: IndependentReviewerAgentInput,
): { system: string; user: string } {
  const system = `You are the Independent Reviewer for Jumping Jax Social Posts.
Return ONLY valid JSON matching the schema. No markdown.

You review Campaign Strategist + Creative Director outputs for creative quality and policy risk.
You do NOT grant final owner approval. grantsOwnerApproval must always be false.
You do NOT publish, schedule, advertise, or start paid generation.
You do NOT override deterministic compliance — your verdict is advisory for creative quality only.

Verdict rules:
- "approve": creative is coherent, on-brand, and ready for Jacob's owner review (still not owner-approved).
- "revise": concrete revisionInstructions required (max one revision will be attempted).

Never invent prices, promotions, dates, or availability as fixes.`;

  const user = JSON.stringify({
    campaignStrategistOutput: input.strategist,
    creativeDirectorOutput: input.creative,
    workflowContextSummary: input.workflowContextSummary ?? null,
    deterministicComplianceContext: {
      decision: input.complianceDecision ?? null,
      summary: input.complianceSummary ?? null,
      note: "Deterministic compliance remains authoritative and separate from your verdict.",
    },
    schemaKeys: REVIEWER_KEYS,
  });

  return { system, user };
}

export function validateIndependentReviewerOutputDetailed(
  value: unknown,
):
  | { ok: true; output: IndependentReviewerOutput }
  | { ok: false; reason: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, reason: "Independent Reviewer output must be an object." };
  }
  const raw = value as Record<string, unknown>;
  try {
    rejectUnknownKeys(raw, REVIEWER_KEYS, "Independent Reviewer output");
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Unknown keys rejected.",
    };
  }

  if (raw.verdict !== "approve" && raw.verdict !== "revise") {
    return { ok: false, reason: "verdict must be approve or revise." };
  }
  if (!isNonEmptyString(raw.reasoning)) {
    return { ok: false, reason: "reasoning must be a non-empty string." };
  }
  if (raw.grantsOwnerApproval !== false) {
    return {
      ok: false,
      reason: "grantsOwnerApproval must be false (Jacob remains final approver).",
    };
  }

  let revisionInstructions: string[];
  let flags: string[];
  try {
    revisionInstructions = requireExactStringArray(
      raw.revisionInstructions,
      "revisionInstructions",
      { min: 0, max: 12, itemMax: 400 },
    );
    flags = requireExactStringArray(raw.flags, "flags", {
      min: 0,
      max: 12,
      itemMax: 240,
    });
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Invalid array fields.",
    };
  }

  if (raw.verdict === "revise" && revisionInstructions.length === 0) {
    return {
      ok: false,
      reason: "revise verdict requires at least one revisionInstruction.",
    };
  }

  return {
    ok: true,
    output: {
      verdict: raw.verdict,
      reasoning: bound(String(raw.reasoning), 1200),
      revisionInstructions,
      flags,
      grantsOwnerApproval: false,
    },
  };
}

export function buildDeterministicIndependentReviewerOutput(
  input: IndependentReviewerAgentInput,
): IndependentReviewerOutput {
  const claimsLike = /\$\s*\d|%\s*off|available now|limited spots/i.test(
    `${input.creative.caption}\n${input.creative.generationPrompt}`,
  );
  if (claimsLike || input.complianceDecision === "block") {
    return {
      verdict: "revise",
      reasoning:
        "Deterministic fallback reviewer found claim risk or blocked compliance context; request a safer creative revision.",
      revisionInstructions: [
        "Remove any price, promotion, availability, or urgency claims.",
        "Keep CTA as a soft invite to message Jumping Jax without inventing facts.",
        "Preserve family-friendly, local Greenwood SC tone.",
      ],
      flags: ["claim_risk_or_compliance_context"],
      grantsOwnerApproval: false,
    };
  }

  if (
    input.creative.caption.length < 40 ||
    input.creative.generationPrompt.length < 80
  ) {
    return {
      verdict: "revise",
      reasoning: "Creative package is too thin for owner-facing review.",
      revisionInstructions: [
        "Expand caption with a clear hook and soft CTA without inventing facts.",
        "Strengthen generationPrompt with concrete visual direction and no on-screen text.",
      ],
      flags: ["thin_creative"],
      grantsOwnerApproval: false,
    };
  }

  return {
    verdict: "approve",
    reasoning:
      "Creative package is coherent with strategist guidance and safe for Jacob owner review. This is not owner approval.",
    revisionInstructions: [],
    flags: [],
    grantsOwnerApproval: false,
  };
}

function diagnosticsFrom(
  partial: Omit<AgentDiagnostics, "agentId">,
): AgentDiagnostics {
  return { agentId: "independent-reviewer", ...partial };
}

export async function runIndependentReviewerAgent(
  input: IndependentReviewerAgentInput,
  options?: { client?: LlmJsonClient; onModelCall?: () => void },
): Promise<AgentResult<IndependentReviewerOutput>> {
  const client = options?.client ?? getDefaultLlmJsonClient();
  const requestId = createRequestId("independent_reviewer");
  const fallback = buildDeterministicIndependentReviewerOutput(input);
  const { system, user } = buildIndependentReviewerRequestPayload(input);

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
    temperature: 0.2,
    maxOutputTokens: 900,
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

  const validated = validateIndependentReviewerOutputDetailed(llm.parsed);
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
    output: {
      ...validated.output,
      grantsOwnerApproval: false,
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
