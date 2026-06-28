import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";

export const DECISION_STAGES = [
  "creative_director",
  "image_director",
  "image_review",
  "video_director",
  "video_review",
  "publisher",
  "analytics",
] as const;

export const DECISION_TYPES = [
  "generated",
  "previewed",
  "accepted",
  "rejected",
  "discarded",
  "selected",
  "published",
  "metric_observed",
  "memory_promoted",
] as const;

export type DecisionStage = (typeof DECISION_STAGES)[number];
export type DecisionType = (typeof DECISION_TYPES)[number];

export type SocialPostDecision = {
  id: string;
  social_post_id: string;
  asset_id: string | null;
  asset_family_id: string | null;
  campaign_id: string | null;
  created_at: string;
  decision_stage: DecisionStage;
  decision_type: DecisionType;
  decision: string;
  rationale: string | null;
  input_snapshot: Record<string, unknown>;
  output_snapshot: Record<string, unknown>;
  model: string | null;
  provider: string | null;
  created_by: string;
};

export type RecordSocialPostDecisionInput = {
  socialPostId: string;
  assetId?: string | null;
  assetFamilyId?: string | null;
  campaignId?: string | null;
  decisionStage: DecisionStage;
  decisionType: DecisionType;
  decision: string;
  rationale?: string | null;
  inputSnapshot?: Record<string, unknown>;
  outputSnapshot?: Record<string, unknown>;
  model?: string | null;
  provider?: string | null;
  createdBy: string;
};

const SOCIAL_POST_DECISION_SELECT =
  "id, social_post_id, asset_id, asset_family_id, campaign_id, created_at, decision_stage, decision_type, decision, rationale, input_snapshot, output_snapshot, model, provider, created_by";

function cleanText(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

export async function recordSocialPostDecision(
  input: RecordSocialPostDecisionInput,
): Promise<SocialPostDecision> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_post_decisions")
    .insert({
      social_post_id: input.socialPostId,
      asset_id: input.assetId ?? null,
      asset_family_id: input.assetFamilyId ?? null,
      campaign_id: cleanText(input.campaignId),
      decision_stage: input.decisionStage,
      decision_type: input.decisionType,
      decision: input.decision,
      rationale: cleanText(input.rationale),
      input_snapshot: input.inputSnapshot ?? {},
      output_snapshot: input.outputSnapshot ?? {},
      model: cleanText(input.model),
      provider: cleanText(input.provider),
      created_by: input.createdBy,
    })
    .select(SOCIAL_POST_DECISION_SELECT)
    .single<SocialPostDecision>();

  if (error) throw new Error(error.message);
  return data;
}

export async function listSocialPostDecisions(
  postId: string,
): Promise<SocialPostDecision[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_post_decisions")
    .select(SOCIAL_POST_DECISION_SELECT)
    .eq("social_post_id", postId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as SocialPostDecision[];
}
