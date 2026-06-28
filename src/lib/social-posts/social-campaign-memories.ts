import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";

export const SOCIAL_CAMPAIGN_MEMORY_TYPES = [
  "creative_pattern",
  "image_pattern",
  "video_pattern",
  "audience_pattern",
  "publishing_pattern",
  "analytics_pattern",
  "general_pattern",
] as const;

export const SOCIAL_CAMPAIGN_MEMORY_STATUSES = [
  "active",
  "superseded",
  "retracted",
] as const;

export const SOCIAL_CAMPAIGN_MEMORY_EVIDENCE_ROLES = [
  "supporting",
  "contradicting",
  "neutral",
] as const;

export const SOCIAL_CAMPAIGN_MEMORY_CREATORS = [
  "human",
  "creative_director",
  "image_director",
  "video_director",
  "publisher",
  "analytics",
  "learning_agent",
  "system",
] as const;

export type SocialCampaignMemoryType =
  (typeof SOCIAL_CAMPAIGN_MEMORY_TYPES)[number];
export type SocialCampaignMemoryStatus =
  (typeof SOCIAL_CAMPAIGN_MEMORY_STATUSES)[number];
export type SocialCampaignMemoryEvidenceRole =
  (typeof SOCIAL_CAMPAIGN_MEMORY_EVIDENCE_ROLES)[number];
export type SocialCampaignMemoryCreator =
  (typeof SOCIAL_CAMPAIGN_MEMORY_CREATORS)[number];

export type SocialCampaignMemory = {
  id: string;
  campaign_id: string | null;
  memory_key: string;
  memory_type: SocialCampaignMemoryType;
  memory_text: string;
  recommendation: string | null;
  confidence_score: number;
  support_count: number;
  contradiction_count: number;
  status: SocialCampaignMemoryStatus;
  version: number;
  supersedes_memory_id: string | null;
  algorithm_version: string;
  input_summary: Record<string, unknown>;
  output_summary: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  promoted_at: string | null;
  created_by: SocialCampaignMemoryCreator;
};

export type SocialCampaignMemoryEvidence = {
  id: string;
  memory_id: string;
  decision_id: string;
  social_post_id: string;
  asset_id: string | null;
  asset_family_id: string | null;
  campaign_id: string | null;
  evidence_role: SocialCampaignMemoryEvidenceRole;
  weight: number;
  created_at: string;
};

export type CreateSocialCampaignMemoryVersionInput = {
  campaignId?: string | null;
  memoryKey: string;
  memoryType: SocialCampaignMemoryType;
  memoryText: string;
  recommendation?: string | null;
  confidenceScore?: number;
  supportCount?: number;
  contradictionCount?: number;
  status?: SocialCampaignMemoryStatus;
  version: number;
  supersedesMemoryId?: string | null;
  algorithmVersion: string;
  inputSummary?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>;
  promotedAt?: string | null;
  createdBy?: SocialCampaignMemoryCreator;
};

export type AttachSocialCampaignMemoryEvidenceItem = {
  decisionId: string;
  socialPostId: string;
  assetId?: string | null;
  assetFamilyId?: string | null;
  campaignId?: string | null;
  evidenceRole?: SocialCampaignMemoryEvidenceRole;
  weight?: number;
};

export type AttachSocialCampaignMemoryEvidenceInput = {
  memoryId: string;
  evidence: AttachSocialCampaignMemoryEvidenceItem[];
};

export type ListSocialCampaignMemoriesInput = {
  campaignId?: string | null;
  status?: SocialCampaignMemoryStatus;
  memoryKey?: string;
};

const SOCIAL_CAMPAIGN_MEMORY_SELECT =
  "id, campaign_id, memory_key, memory_type, memory_text, recommendation, confidence_score, support_count, contradiction_count, status, version, supersedes_memory_id, algorithm_version, input_summary, output_summary, created_at, updated_at, promoted_at, created_by";

const SOCIAL_CAMPAIGN_MEMORY_EVIDENCE_SELECT =
  "id, memory_id, decision_id, social_post_id, asset_id, asset_family_id, campaign_id, evidence_role, weight, created_at";

function cleanText(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function requiredText(value: string, field: string): string {
  const cleaned = cleanText(value);
  if (!cleaned) throw new Error(`${field} is required.`);
  return cleaned;
}

function cleanNumber(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function createSocialCampaignMemoryVersion(
  input: CreateSocialCampaignMemoryVersionInput,
): Promise<SocialCampaignMemory> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_campaign_memories")
    .insert({
      campaign_id: cleanText(input.campaignId),
      memory_key: requiredText(input.memoryKey, "memoryKey"),
      memory_type: input.memoryType,
      memory_text: requiredText(input.memoryText, "memoryText"),
      recommendation: cleanText(input.recommendation),
      confidence_score: cleanNumber(input.confidenceScore, 0),
      support_count: Math.trunc(cleanNumber(input.supportCount, 0)),
      contradiction_count: Math.trunc(
        cleanNumber(input.contradictionCount, 0),
      ),
      status: input.status ?? "active",
      version: input.version,
      supersedes_memory_id: input.supersedesMemoryId ?? null,
      algorithm_version: requiredText(
        input.algorithmVersion,
        "algorithmVersion",
      ),
      input_summary: input.inputSummary ?? {},
      output_summary: input.outputSummary ?? {},
      promoted_at: cleanText(input.promotedAt),
      created_by: input.createdBy ?? "system",
    })
    .select(SOCIAL_CAMPAIGN_MEMORY_SELECT)
    .single<SocialCampaignMemory>();

  if (error) throw new Error(error.message);
  return data;
}

export async function attachSocialCampaignMemoryEvidence(
  input: AttachSocialCampaignMemoryEvidenceInput,
): Promise<SocialCampaignMemoryEvidence[]> {
  if (input.evidence.length === 0) return [];

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_campaign_memory_evidence")
    .insert(
      input.evidence.map((item) => ({
        memory_id: input.memoryId,
        decision_id: item.decisionId,
        social_post_id: item.socialPostId,
        asset_id: item.assetId ?? null,
        asset_family_id: item.assetFamilyId ?? null,
        campaign_id: cleanText(item.campaignId),
        evidence_role: item.evidenceRole ?? "supporting",
        weight: cleanNumber(item.weight, 1),
      })),
    )
    .select(SOCIAL_CAMPAIGN_MEMORY_EVIDENCE_SELECT);

  if (error) throw new Error(error.message);
  return (data ?? []) as SocialCampaignMemoryEvidence[];
}

export async function listSocialCampaignMemories(
  input: ListSocialCampaignMemoriesInput = {},
): Promise<SocialCampaignMemory[]> {
  const supabase = createServiceRoleClient();
  let query = supabase
    .from("social_campaign_memories")
    .select(SOCIAL_CAMPAIGN_MEMORY_SELECT);

  if (input.campaignId === null) {
    query = query.is("campaign_id", null);
  } else if (input.campaignId !== undefined) {
    query = query.eq("campaign_id", input.campaignId);
  }

  if (input.status) {
    query = query.eq("status", input.status);
  }
  if (input.memoryKey) {
    query = query.eq("memory_key", input.memoryKey);
  }

  const { data, error } = await query.order("promoted_at", {
    ascending: false,
    nullsFirst: false,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as SocialCampaignMemory[];
}

export async function listSocialCampaignMemoryEvidence(
  memoryId: string,
): Promise<SocialCampaignMemoryEvidence[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_campaign_memory_evidence")
    .select(SOCIAL_CAMPAIGN_MEMORY_EVIDENCE_SELECT)
    .eq("memory_id", memoryId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as SocialCampaignMemoryEvidence[];
}
