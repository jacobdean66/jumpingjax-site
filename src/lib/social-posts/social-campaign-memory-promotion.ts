import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  attachSocialCampaignMemoryEvidence,
  createSocialCampaignMemoryVersion,
  listSocialCampaignMemories,
  type AttachSocialCampaignMemoryEvidenceInput,
  type AttachSocialCampaignMemoryEvidenceItem,
  type CreateSocialCampaignMemoryVersionInput,
  type ListSocialCampaignMemoriesInput,
  type SocialCampaignMemory,
  type SocialCampaignMemoryEvidence,
  type SocialCampaignMemoryType,
} from "./social-campaign-memories";
import {
  type DecisionStage,
  type DecisionType,
  type SocialPostDecision,
} from "./social-post-decisions";

const ELIGIBLE_DECISION_TYPES = ["accepted", "rejected", "selected"] as const;
const IMAGE_OUTCOMES = ["accepted", "rejected"] as const;
const CAMPAIGN_SUPPORT_THRESHOLD = 5;
const GLOBAL_SUPPORT_THRESHOLD = 8;
const MIN_DISTINCT_POSTS = 2;
const MIN_DISTINCT_ASSET_FAMILIES = 2;
const ALGORITHM_VERSION = "campaign-memory-promotion-v1";

type EligibleDecisionType = (typeof ELIGIBLE_DECISION_TYPES)[number];
type ImageOutcome = (typeof IMAGE_OUTCOMES)[number];
type ConfidenceLabel = "low" | "medium" | "high";
type EvidenceRole = "supporting" | "contradicting";

type UpdateMemoryStatusInput = {
  memoryId: string;
  status: "superseded" | "retracted";
  outputSummary: Record<string, unknown>;
};

type PromotionEngineDependencies = {
  listMemories: (
    input?: ListSocialCampaignMemoriesInput,
  ) => Promise<SocialCampaignMemory[]>;
  createMemoryVersion: (
    input: CreateSocialCampaignMemoryVersionInput,
  ) => Promise<SocialCampaignMemory>;
  attachMemoryEvidence: (
    input: AttachSocialCampaignMemoryEvidenceInput,
  ) => Promise<SocialCampaignMemoryEvidence[]>;
  updateMemoryStatus: (
    input: UpdateMemoryStatusInput,
  ) => Promise<SocialCampaignMemory>;
};

export type ListPromotionEligibleDecisionsInput = {
  campaignId?: string | null;
  includeGlobal?: boolean;
  createdAfter?: string;
  createdBefore?: string;
  limit?: number;
};

export type BuildCampaignMemoryCandidatesInput =
  ListPromotionEligibleDecisionsInput & {
    decisions?: SocialPostDecision[];
    global?: boolean;
  };

export type CampaignMemoryCandidateEvidence = {
  decision: SocialPostDecision;
  evidenceRole: EvidenceRole;
  weight: number;
};

export type CampaignMemoryCandidate = {
  campaignId: string | null;
  isGlobal: boolean;
  memoryKey: string;
  memoryType: Extract<
    SocialCampaignMemoryType,
    "image_pattern" | "video_pattern" | "creative_pattern"
  >;
  memoryText: string;
  recommendation: string;
  patternSlug: string;
  patternAttributes: Record<string, string | null>;
  decisionStage: DecisionStage;
  supportDecisionType: EligibleDecisionType;
  contradictionDecisionTypes: EligibleDecisionType[];
  supportCount: number;
  contradictionCount: number;
  distinctPostCount: number;
  distinctAssetFamilyCount: number;
  confidenceScore: number;
  confidenceLabel: ConfidenceLabel;
  isPromotable: boolean;
  blockedReasons: string[];
  supportDecisions: SocialPostDecision[];
  contradictionDecisions: SocialPostDecision[];
  algorithmVersion: string;
};

type Pattern = {
  memoryType: CampaignMemoryCandidate["memoryType"];
  patternSlug: string;
  patternLabel: string;
  attributes: Record<string, string | null>;
  assetBased: boolean;
};

const SOCIAL_CAMPAIGN_MEMORY_SELECT =
  "id, campaign_id, memory_key, memory_type, memory_text, recommendation, confidence_score, support_count, contradiction_count, status, version, supersedes_memory_id, algorithm_version, input_summary, output_summary, created_at, updated_at, promoted_at, created_by";

let promotionEngineDependencies: PromotionEngineDependencies = {
  listMemories: listSocialCampaignMemories,
  createMemoryVersion: createSocialCampaignMemoryVersion,
  attachMemoryEvidence: attachSocialCampaignMemoryEvidence,
  updateMemoryStatus,
};

export function configureCampaignMemoryPromotionTestDependencies(
  dependencies: Partial<PromotionEngineDependencies> | null,
): void {
  promotionEngineDependencies = {
    listMemories: dependencies?.listMemories ?? listSocialCampaignMemories,
    createMemoryVersion:
      dependencies?.createMemoryVersion ?? createSocialCampaignMemoryVersion,
    attachMemoryEvidence:
      dependencies?.attachMemoryEvidence ?? attachSocialCampaignMemoryEvidence,
    updateMemoryStatus: dependencies?.updateMemoryStatus ?? updateMemoryStatus,
  };
}

function cleanText(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function normalizeSlug(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "general";
}

function stringFromSnapshot(
  snapshots: Record<string, unknown>[],
  keys: string[],
): string | null {
  for (const snapshot of snapshots) {
    for (const key of keys) {
      const value = snapshot[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return null;
}

function hasEligibleDecisionType(
  decisionType: DecisionType,
): decisionType is EligibleDecisionType {
  return ELIGIBLE_DECISION_TYPES.some((type) => type === decisionType);
}

function hasImageOutcome(
  decisionType: EligibleDecisionType,
): decisionType is ImageOutcome {
  return IMAGE_OUTCOMES.some((type) => type === decisionType);
}

function oppositeDecisionTypes(
  decisionType: EligibleDecisionType,
): EligibleDecisionType[] {
  if (decisionType === "accepted") return ["rejected"];
  if (decisionType === "rejected") return ["accepted"];
  return [];
}

function confidenceLabel(score: number): ConfidenceLabel {
  if (score >= 0.85) return "high";
  if (score >= 0.7) return "medium";
  return "low";
}

function campaignToken(campaignId: string | null, isGlobal: boolean): string {
  return isGlobal ? "global" : normalizeSlug(campaignId ?? "uncategorized");
}

function memoryKey(input: {
  campaignId: string | null;
  isGlobal: boolean;
  stage: DecisionStage;
  memoryType: CampaignMemoryCandidate["memoryType"];
  patternSlug: string;
}): string {
  return [
    "campaign",
    campaignToken(input.campaignId, input.isGlobal),
    "stage",
    input.stage,
    "type",
    input.memoryType,
    "pattern",
    input.patternSlug,
  ].join(":");
}

function explainablePattern(decision: SocialPostDecision): Pattern | null {
  const snapshots = [decision.input_snapshot, decision.output_snapshot];

  if (decision.decision_stage === "image_review") {
    if (!hasImageOutcome(decision.decision_type as EligibleDecisionType)) {
      return null;
    }

    const generatedImageUrl = stringFromSnapshot(snapshots, [
      "generated_image_url",
      "approved_image_url",
    ]);
    if (!generatedImageUrl || !decision.asset_id || !decision.asset_family_id) {
      return null;
    }

    const provider = cleanText(decision.provider) ?? "unknown-provider";
    const model = cleanText(decision.model);
    return {
      memoryType: "image_pattern",
      patternSlug: normalizeSlug(`generated-image-${provider}`),
      patternLabel: `generated image (${provider})`,
      attributes: {
        provider,
        model,
        has_generated_image_url: "true",
      },
      assetBased: true,
    };
  }

  if (decision.decision_stage === "video_review") {
    if (decision.decision_type !== "selected") return null;

    const mediaUrl = stringFromSnapshot(snapshots, ["media_url"]);
    if (!mediaUrl || !decision.asset_id || !decision.asset_family_id) {
      return null;
    }

    const provider = cleanText(decision.provider) ?? "unknown-provider";
    return {
      memoryType: "video_pattern",
      patternSlug: normalizeSlug(`selected-video-${provider}`),
      patternLabel: `selected video (${provider})`,
      attributes: {
        provider,
        has_media_url: "true",
      },
      assetBased: true,
    };
  }

  return null;
}

function distinctCount(values: Array<string | null>): number {
  return new Set(values.filter((value): value is string => Boolean(value))).size;
}

function buildCandidate(input: {
  decisions: SocialPostDecision[];
  supportDecisionType: EligibleDecisionType;
  pattern: Pattern;
  campaignId: string | null;
  isGlobal: boolean;
  stage: DecisionStage;
}): CampaignMemoryCandidate {
  const supportDecisions = input.decisions.filter(
    (decision) => decision.decision_type === input.supportDecisionType,
  );
  const contradictionTypes = oppositeDecisionTypes(input.supportDecisionType);
  const contradictionDecisions = input.decisions.filter((decision) =>
    contradictionTypes.includes(decision.decision_type as EligibleDecisionType),
  );
  const supportCount = supportDecisions.length;
  const contradictionCount = contradictionDecisions.length;
  const distinctPostCount = distinctCount(
    supportDecisions.map((decision) => decision.social_post_id),
  );
  const distinctAssetFamilyCount = distinctCount(
    supportDecisions.map((decision) => decision.asset_family_id),
  );
  const confidenceScore =
    supportCount / (supportCount + contradictionCount + 2);
  const threshold = input.isGlobal
    ? GLOBAL_SUPPORT_THRESHOLD
    : CAMPAIGN_SUPPORT_THRESHOLD;
  const blockedReasons: string[] = [];

  if (supportCount < threshold) {
    blockedReasons.push(`requires at least ${threshold} supporting decisions`);
  }
  if (distinctPostCount < MIN_DISTINCT_POSTS) {
    blockedReasons.push("requires at least 2 distinct posts");
  }
  if (
    input.pattern.assetBased &&
    distinctAssetFamilyCount < MIN_DISTINCT_ASSET_FAMILIES
  ) {
    blockedReasons.push("requires at least 2 distinct asset families");
  }

  const key = memoryKey({
    campaignId: input.campaignId,
    isGlobal: input.isGlobal,
    stage: input.stage,
    memoryType: input.pattern.memoryType,
    patternSlug: input.pattern.patternSlug,
  });
  const campaignLabel = input.isGlobal
    ? "Global campaigns"
    : `Campaign ${input.campaignId ?? "uncategorized"}`;
  const outcome =
    input.supportDecisionType === "selected"
      ? "selected successfully"
      : `${input.supportDecisionType} repeatedly`;

  return {
    campaignId: input.isGlobal ? null : input.campaignId,
    isGlobal: input.isGlobal,
    memoryKey: key,
    memoryType: input.pattern.memoryType,
    memoryText: `${campaignLabel} has ${outcome} for ${input.pattern.patternLabel}.`,
    recommendation: `Prefer ${input.pattern.patternLabel} when similar campaign context appears, while checking current creative fit.`,
    patternSlug: input.pattern.patternSlug,
    patternAttributes: input.pattern.attributes,
    decisionStage: input.stage,
    supportDecisionType: input.supportDecisionType,
    contradictionDecisionTypes: contradictionTypes,
    supportCount,
    contradictionCount,
    distinctPostCount,
    distinctAssetFamilyCount,
    confidenceScore,
    confidenceLabel: confidenceLabel(confidenceScore),
    isPromotable: blockedReasons.length === 0,
    blockedReasons,
    supportDecisions,
    contradictionDecisions,
    algorithmVersion: ALGORITHM_VERSION,
  };
}

function candidateGroupKey(input: {
  campaignId: string | null;
  isGlobal: boolean;
  stage: DecisionStage;
  patternSlug: string;
  supportDecisionType: EligibleDecisionType;
}): string {
  return [
    campaignToken(input.campaignId, input.isGlobal),
    input.stage,
    input.patternSlug,
    input.supportDecisionType,
  ].join("|");
}

function evidenceFromDecision(
  decision: SocialPostDecision,
  evidenceRole: EvidenceRole,
): CampaignMemoryCandidateEvidence {
  return {
    decision,
    evidenceRole,
    weight: 1,
  };
}

function evidenceInputFromCandidate(
  candidate: CampaignMemoryCandidate,
): AttachSocialCampaignMemoryEvidenceItem[] {
  return listCampaignMemoryCandidateEvidence(candidate).map((item) => ({
    decisionId: item.decision.id,
    socialPostId: item.decision.social_post_id,
    assetId: item.decision.asset_id,
    assetFamilyId: item.decision.asset_family_id,
    campaignId: item.decision.campaign_id,
    evidenceRole: item.evidenceRole,
    weight: item.weight,
  }));
}

function candidateInputSummary(
  candidate: CampaignMemoryCandidate,
): Record<string, unknown> {
  return {
    campaign_id: candidate.campaignId,
    is_global: candidate.isGlobal,
    decision_stage: candidate.decisionStage,
    support_decision_type: candidate.supportDecisionType,
    contradiction_decision_types: candidate.contradictionDecisionTypes,
    pattern_slug: candidate.patternSlug,
    pattern_attributes: candidate.patternAttributes,
    support_count: candidate.supportCount,
    contradiction_count: candidate.contradictionCount,
    distinct_post_count: candidate.distinctPostCount,
    distinct_asset_family_count: candidate.distinctAssetFamilyCount,
    algorithm_version: candidate.algorithmVersion,
  };
}

function candidateOutputSummary(
  candidate: CampaignMemoryCandidate,
): Record<string, unknown> {
  return {
    memory_key: candidate.memoryKey,
    memory_type: candidate.memoryType,
    memory_text: candidate.memoryText,
    recommendation: candidate.recommendation,
    confidence_score: candidate.confidenceScore,
    confidence_label: candidate.confidenceLabel,
    supporting_decision_ids: candidate.supportDecisions.map(
      (decision) => decision.id,
    ),
    contradicting_decision_ids: candidate.contradictionDecisions.map(
      (decision) => decision.id,
    ),
    promotion_reason: "Manual deterministic promotion from decision history.",
  };
}

async function updateMemoryStatus(input: {
  memoryId: string;
  status: "superseded" | "retracted";
  outputSummary: Record<string, unknown>;
}): Promise<SocialCampaignMemory> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_campaign_memories")
    .update({
      status: input.status,
      updated_at: new Date().toISOString(),
      output_summary: input.outputSummary,
    })
    .eq("id", input.memoryId)
    .select(SOCIAL_CAMPAIGN_MEMORY_SELECT)
    .single<SocialCampaignMemory>();

  if (error) throw new Error(error.message);
  return data;
}

export async function listPromotionEligibleDecisions(
  input: ListPromotionEligibleDecisionsInput = {},
): Promise<SocialPostDecision[]> {
  const supabase = createServiceRoleClient();
  let query = supabase
    .from("social_post_decisions")
    .select(
      "id, social_post_id, asset_id, asset_family_id, campaign_id, created_at, decision_stage, decision_type, decision, rationale, input_snapshot, output_snapshot, model, provider, created_by",
    )
    .in("decision_type", [...ELIGIBLE_DECISION_TYPES])
    .order("created_at", { ascending: false });

  if (input.campaignId === null) {
    query = query.is("campaign_id", null);
  } else if (input.campaignId !== undefined) {
    query = query.eq("campaign_id", input.campaignId);
  } else if (!input.includeGlobal) {
    query = query.not("campaign_id", "is", null);
  }

  if (input.createdAfter) {
    query = query.gte("created_at", input.createdAfter);
  }
  if (input.createdBefore) {
    query = query.lte("created_at", input.createdBefore);
  }
  if (input.limit) {
    query = query.limit(input.limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as SocialPostDecision[]).filter((decision) => {
    if (!hasEligibleDecisionType(decision.decision_type)) return false;
    return explainablePattern(decision) !== null;
  });
}

export async function buildCampaignMemoryCandidates(
  input: BuildCampaignMemoryCandidatesInput = {},
): Promise<CampaignMemoryCandidate[]> {
  const decisions =
    input.decisions ?? (await listPromotionEligibleDecisions(input));
  const grouped = new Map<
    string,
    {
      campaignId: string | null;
      isGlobal: boolean;
      stage: DecisionStage;
      pattern: Pattern;
      supportDecisionType: EligibleDecisionType;
      decisions: SocialPostDecision[];
    }
  >();

  for (const decision of decisions) {
    if (!hasEligibleDecisionType(decision.decision_type)) continue;
    const pattern = explainablePattern(decision);
    if (!pattern) continue;

    const isGlobal = input.global === true;
    const campaignId = isGlobal ? null : decision.campaign_id;
    if (!isGlobal && !campaignId) continue;

    const relevantDecisionTypes = [
      decision.decision_type,
      ...oppositeDecisionTypes(decision.decision_type),
    ];

    for (const supportDecisionType of relevantDecisionTypes) {
      const key = candidateGroupKey({
        campaignId,
        isGlobal,
        stage: decision.decision_stage,
        patternSlug: pattern.patternSlug,
        supportDecisionType,
      });
      const existing = grouped.get(key);
      if (existing) {
        existing.decisions.push(decision);
      } else {
        grouped.set(key, {
          campaignId,
          isGlobal,
          stage: decision.decision_stage,
          pattern,
          supportDecisionType,
          decisions: [decision],
        });
      }
    }
  }

  return Array.from(grouped.values())
    .map((group) => buildCandidate(group))
    .sort((left, right) => {
      if (left.isPromotable !== right.isPromotable) {
        return left.isPromotable ? -1 : 1;
      }
      return right.confidenceScore - left.confidenceScore;
    });
}

export function listCampaignMemoryCandidateEvidence(
  candidate: CampaignMemoryCandidate,
): CampaignMemoryCandidateEvidence[] {
  return [
    ...candidate.supportDecisions.map((decision) =>
      evidenceFromDecision(decision, "supporting"),
    ),
    ...candidate.contradictionDecisions.map((decision) =>
      evidenceFromDecision(decision, "contradicting"),
    ),
  ];
}

export async function promoteCampaignMemoryCandidate(
  candidate: CampaignMemoryCandidate,
): Promise<{
  memory: SocialCampaignMemory;
  evidence: SocialCampaignMemoryEvidence[];
}> {
  if (!candidate.isPromotable) {
    throw new Error(
      `Candidate is not promotable: ${candidate.blockedReasons.join("; ")}`,
    );
  }

  const evidenceInput = evidenceInputFromCandidate(candidate);
  if (evidenceInput.length === 0) {
    throw new Error("Cannot promote a campaign memory without evidence.");
  }

  const existingMemories = await promotionEngineDependencies.listMemories({
    campaignId: candidate.campaignId,
    memoryKey: candidate.memoryKey,
  });
  const latestVersion = existingMemories.reduce(
    (version, memory) => Math.max(version, memory.version),
    0,
  );
  const latestActiveMemory =
    existingMemories.find((memory) => memory.status === "active") ?? null;

  const memory = await promotionEngineDependencies.createMemoryVersion({
    campaignId: candidate.campaignId,
    memoryKey: candidate.memoryKey,
    memoryType: candidate.memoryType,
    memoryText: candidate.memoryText,
    recommendation: candidate.recommendation,
    confidenceScore: candidate.confidenceScore,
    supportCount: candidate.supportCount,
    contradictionCount: candidate.contradictionCount,
    version: latestVersion + 1,
    supersedesMemoryId: latestActiveMemory?.id ?? null,
    algorithmVersion: candidate.algorithmVersion,
    inputSummary: candidateInputSummary(candidate),
    outputSummary: candidateOutputSummary(candidate),
    promotedAt: new Date().toISOString(),
    createdBy: "learning_agent",
  });

  try {
    const evidence = await promotionEngineDependencies.attachMemoryEvidence({
      memoryId: memory.id,
      evidence: evidenceInput,
    });

    if (evidence.length !== evidenceInput.length) {
      throw new Error("Campaign memory evidence attachment was incomplete.");
    }

    if (latestActiveMemory) {
      await promotionEngineDependencies.updateMemoryStatus({
        memoryId: latestActiveMemory.id,
        status: "superseded",
        outputSummary: {
          ...latestActiveMemory.output_summary,
          superseded_by_memory_id: memory.id,
          superseded_at: new Date().toISOString(),
        },
      });
    }

    return { memory, evidence };
  } catch (error) {
    await retractSocialCampaignMemory(
      memory.id,
      error instanceof Error
        ? `Promotion evidence attachment failed: ${error.message}`
        : "Promotion evidence attachment failed.",
    );
    throw error;
  }
}

export async function retractSocialCampaignMemory(
  memoryId: string,
  reason: string,
): Promise<SocialCampaignMemory> {
  const existingMemories = await promotionEngineDependencies.listMemories({});
  const memory = existingMemories.find((item) => item.id === memoryId);
  if (!memory) throw new Error("Campaign memory not found.");

  return promotionEngineDependencies.updateMemoryStatus({
    memoryId,
    status: "retracted",
    outputSummary: {
      ...memory.output_summary,
      retraction: {
        reason: cleanText(reason) ?? "No reason provided.",
        retracted_at: new Date().toISOString(),
      },
    },
  });
}
