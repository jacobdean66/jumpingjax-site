import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";

export const SOCIAL_POST_ASSET_TYPES = [
  "image",
  "video",
  "thumbnail",
  "audio",
  "caption",
  "document",
] as const;

export const SOCIAL_POST_ASSET_STAGES = [
  "source",
  "concept",
  "generated",
  "edited",
  "approved",
  "published",
  "archived",
] as const;

export type SocialPostAssetType = (typeof SOCIAL_POST_ASSET_TYPES)[number];
export type SocialPostAssetStage = (typeof SOCIAL_POST_ASSET_STAGES)[number];

export type SocialPostAsset = {
  id: string;
  social_post_id: string;
  parent_asset_id: string | null;
  asset_family_id: string;
  created_at: string;
  updated_at: string;
  asset_type: SocialPostAssetType;
  asset_stage: SocialPostAssetStage;
  url: string | null;
  source_url: string | null;
  storage_path: string | null;
  provider: string | null;
  generation_engine: string | null;
  model: string | null;
  prediction_id: string | null;
  generation_status: string | null;
  generation_prompt: string | null;
  concept_id: string | null;
  generation_cost: number | null;
  generation_duration_ms: number | null;
  created_by: string | null;
  is_selected: boolean;
  is_rejected: boolean;
  is_favorite: boolean;
  rating: number | null;
  notes: string | null;
  metadata: Record<string, unknown>;
};

export type CreateSocialPostAssetInput = {
  socialPostId: string;
  parentAssetId?: string | null;
  assetFamilyId?: string;
  assetType: SocialPostAssetType;
  assetStage: SocialPostAssetStage;
  url?: string | null;
  sourceUrl?: string | null;
  storagePath?: string | null;
  provider?: string | null;
  generationEngine?: string | null;
  model?: string | null;
  predictionId?: string | null;
  generationStatus?: string | null;
  generationPrompt?: string | null;
  conceptId?: string | null;
  generationCost?: number | null;
  generationDurationMs?: number | null;
  createdBy?: string | null;
  isSelected?: boolean;
  isRejected?: boolean;
  isFavorite?: boolean;
  rating?: number | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
};

const SOCIAL_POST_ASSET_SELECT =
  "id, social_post_id, parent_asset_id, asset_family_id, created_at, updated_at, asset_type, asset_stage, url, source_url, storage_path, provider, generation_engine, model, prediction_id, generation_status, generation_prompt, concept_id, generation_cost, generation_duration_ms, created_by, is_selected, is_rejected, is_favorite, rating, notes, metadata";

async function getAssetById(assetId: string): Promise<SocialPostAsset | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_post_assets")
    .select(SOCIAL_POST_ASSET_SELECT)
    .eq("id", assetId)
    .maybeSingle<SocialPostAsset>();

  if (error) throw new Error(error.message);
  return data;
}

export async function createSocialPostAsset(
  input: CreateSocialPostAssetInput,
): Promise<SocialPostAsset> {
  const parent = input.parentAssetId
    ? await getAssetById(input.parentAssetId)
    : null;

  if (input.parentAssetId && !parent) {
    throw new Error("Parent social post asset not found.");
  }
  if (parent && parent.social_post_id !== input.socialPostId) {
    throw new Error("Parent asset must belong to the same social post.");
  }

  const assetFamilyId = parent?.asset_family_id ?? input.assetFamilyId ?? crypto.randomUUID();
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_post_assets")
    .insert({
      social_post_id: input.socialPostId,
      parent_asset_id: parent?.id ?? null,
      asset_family_id: assetFamilyId,
      asset_type: input.assetType,
      asset_stage: input.assetStage,
      url: input.url ?? null,
      source_url: input.sourceUrl ?? null,
      storage_path: input.storagePath ?? null,
      provider: input.provider ?? null,
      generation_engine: input.generationEngine ?? null,
      model: input.model ?? null,
      prediction_id: input.predictionId ?? null,
      generation_status: input.generationStatus ?? null,
      generation_prompt: input.generationPrompt ?? null,
      concept_id: input.conceptId ?? null,
      generation_cost: input.generationCost ?? null,
      generation_duration_ms: input.generationDurationMs ?? null,
      created_by: input.createdBy ?? null,
      is_selected: input.isSelected ?? false,
      is_rejected: input.isRejected ?? false,
      is_favorite: input.isFavorite ?? false,
      rating: input.rating ?? null,
      notes: input.notes ?? null,
      metadata: input.metadata ?? {},
    })
    .select(SOCIAL_POST_ASSET_SELECT)
    .single<SocialPostAsset>();

  if (error) throw new Error(error.message);
  return data;
}

export async function findSocialPostAssetByPrediction(input: {
  socialPostId: string;
  predictionId: string;
  assetType?: SocialPostAssetType;
}): Promise<SocialPostAsset | null> {
  const supabase = createServiceRoleClient();
  let query = supabase
    .from("social_post_assets")
    .select(SOCIAL_POST_ASSET_SELECT)
    .eq("social_post_id", input.socialPostId)
    .eq("prediction_id", input.predictionId);

  if (input.assetType) {
    query = query.eq("asset_type", input.assetType);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<SocialPostAsset>();

  if (error) throw new Error(error.message);
  return data;
}

export async function selectSocialPostAsset(input: {
  socialPostId: string;
  assetId: string;
}): Promise<SocialPostAsset> {
  const asset = await getAssetById(input.assetId);
  if (!asset || asset.social_post_id !== input.socialPostId) {
    throw new Error("Social post asset not found.");
  }

  const supabase = createServiceRoleClient();
  const { error: clearError } = await supabase
    .from("social_post_assets")
    .update({ is_selected: false })
    .eq("social_post_id", input.socialPostId)
    .eq("asset_type", asset.asset_type)
    .eq("is_selected", true);

  if (clearError) throw new Error(clearError.message);

  const { data, error } = await supabase
    .from("social_post_assets")
    .update({ is_selected: true, is_rejected: false })
    .eq("id", input.assetId)
    .eq("social_post_id", input.socialPostId)
    .select(SOCIAL_POST_ASSET_SELECT)
    .single<SocialPostAsset>();

  if (error) throw new Error(error.message);
  return data;
}
