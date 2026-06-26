import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  type ImageConceptId,
} from "@/lib/social-posts/image-director";

const CONCEPT_LABELS: Record<ImageConceptId, string> = {
  A: "Concept A",
  B: "Concept B",
  C: "Concept C",
  D: "Concept D",
};

export type SocialPostImageConcept = {
  id: ImageConceptId;
  label: string;
  status: string;
  predictionId: string | null;
  prompt: string;
  provider: string | null;
  model: string | null;
  imageUrl: string | null;
  error: string | null;
  favorite: boolean;
  rejected: boolean;
  createdAt: string;
};

export const SOCIAL_POST_MEDIA_TYPES = ["image", "video"] as const;
export const SOCIAL_POST_STATUSES = [
  "draft",
  "approved",
  "scheduled",
  "posted",
  "rejected",
  "failed",
] as const;
export const SOCIAL_POST_PLATFORMS = ["facebook", "instagram"] as const;
export const SOCIAL_POST_BUSINESS_FOCUS = ["rentals", "facility-parties", "both"] as const;

export type SocialPostMediaType = (typeof SOCIAL_POST_MEDIA_TYPES)[number];
export type SocialPostStatus = (typeof SOCIAL_POST_STATUSES)[number];
export type SocialPostPlatform = (typeof SOCIAL_POST_PLATFORMS)[number];
export type SocialPostBusinessFocus = (typeof SOCIAL_POST_BUSINESS_FOCUS)[number];

export type SocialPost = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string | null;
  campaign_id: string | null;
  goal: string | null;
  prompt: string | null;
  caption: string | null;
  media_type: SocialPostMediaType;
  business_focus: SocialPostBusinessFocus;
  media_url: string | null;
  source_image_url: string | null;
  original_image_url: string | null;
  approved_image_url: string | null;
  generated_image_url: string | null;
  generated_image_source_url: string | null;
  media_source_url: string | null;
  image_generation_provider: string | null;
  image_generation_model: string | null;
  image_prediction_id: string | null;
  image_generation_created_at: string | null;
  image_generation_prompt: string | null;
  image_generation_status: string | null;
  image_concepts: SocialPostImageConcept[];
  motion_preset: string | null;
  camera_preset: string | null;
  creative_source: string | null;
  platforms: SocialPostPlatform[];
  status: SocialPostStatus;
  scheduled_for: string | null;
  posted_at: string | null;
  error_message: string | null;
};

export type CreateSocialPostInput = {
  title?: string | null;
  campaign_id?: string | null;
  goal?: string | null;
  prompt?: string | null;
  caption?: string | null;
  media_type?: string | null;
  business_focus?: string | null;
  media_url?: string | null;
  source_image_url?: string | null;
  motion_preset?: string | null;
  camera_preset?: string | null;
  creative_source?: string | null;
  platforms?: string[] | null;
};

export type UpdateSocialPostDraftInput = {
  title?: string | null;
  campaign_id?: string | null;
  goal?: string | null;
  prompt?: string | null;
  caption?: string | null;
  media_type?: string | null;
  business_focus?: string | null;
  source_image_url?: string | null;
  motion_preset?: string | null;
  camera_preset?: string | null;
  creative_source?: string | null;
  platforms?: string[] | null;
  status?: string | null;
  scheduled_for?: string | null;
};

const SOCIAL_POST_SELECT =
  "id, created_at, updated_at, title, campaign_id, goal, prompt, caption, media_type, business_focus, media_url, media_source_url, source_image_url, original_image_url, approved_image_url, generated_image_url, generated_image_source_url, image_generation_provider, image_generation_model, image_prediction_id, image_generation_created_at, image_generation_prompt, image_generation_status, image_concepts, motion_preset, camera_preset, creative_source, platforms, status, scheduled_for, posted_at, error_message";

function isImageConceptId(value: unknown): value is ImageConceptId {
  return value === "A" || value === "B" || value === "C" || value === "D";
}

function normalizeSocialPostImageConcept(value: unknown): SocialPostImageConcept | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (!isImageConceptId(record.id)) return null;

  const id = record.id;
  return {
    id,
    label:
      typeof record.label === "string" && record.label.trim()
        ? record.label.trim()
        : CONCEPT_LABELS[id],
    status: typeof record.status === "string" ? record.status : "idle",
    predictionId:
      typeof record.predictionId === "string" && record.predictionId.trim()
        ? record.predictionId.trim()
        : null,
    prompt: typeof record.prompt === "string" ? record.prompt : "",
    provider:
      typeof record.provider === "string" && record.provider.trim()
        ? record.provider.trim()
        : null,
    model:
      typeof record.model === "string" && record.model.trim()
        ? record.model.trim()
        : null,
    imageUrl:
      typeof record.imageUrl === "string" && record.imageUrl.trim()
        ? record.imageUrl.trim()
        : null,
    error:
      typeof record.error === "string" && record.error.trim()
        ? record.error.trim()
        : null,
    favorite: record.favorite === true,
    rejected: record.rejected === true,
    createdAt:
      typeof record.createdAt === "string" && record.createdAt.trim()
        ? record.createdAt.trim()
        : new Date().toISOString(),
  };
}

export function normalizeSocialPostImageConcepts(
  value: unknown,
): SocialPostImageConcept[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeSocialPostImageConcept(item))
    .filter((item): item is SocialPostImageConcept => item !== null);
}

function mapSocialPostRow(
  data: SocialPost & { image_concepts?: unknown },
): SocialPost {
  return {
    ...data,
    image_concepts: normalizeSocialPostImageConcepts(data.image_concepts),
  };
}

function cleanText(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function normalizeMediaType(value: string | null | undefined): SocialPostMediaType {
  return value === "video" ? "video" : "image";
}

function normalizeBusinessFocus(
  value: string | null | undefined,
): SocialPostBusinessFocus {
  return SOCIAL_POST_BUSINESS_FOCUS.includes(value as SocialPostBusinessFocus)
    ? (value as SocialPostBusinessFocus)
    : "both";
}

function normalizePlatforms(
  value: string[] | null | undefined,
): SocialPostPlatform[] {
  const platforms = (value ?? []).filter(
    (item): item is SocialPostPlatform =>
      SOCIAL_POST_PLATFORMS.includes(item as SocialPostPlatform),
  );
  return platforms.length > 0 ? platforms : ["facebook", "instagram"];
}

function assertSocialPostStatus(status: string): asserts status is SocialPostStatus {
  if (!SOCIAL_POST_STATUSES.includes(status as SocialPostStatus)) {
    throw new Error("Invalid social post status.");
  }
}

function assertRequiredDraftFields(input: {
  title?: string | null;
  caption?: string | null;
  prompt?: string | null;
  media_type?: string | null;
}) {
  if (!cleanText(input.title)) throw new Error("Title is required.");
  if (!cleanText(input.caption)) throw new Error("Caption is required.");
  if (!cleanText(input.prompt)) throw new Error("AI Prompt is required.");
  if (!input.media_type) throw new Error("Media type is required.");
}

function normalizeScheduledFor(value: string): string {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw new Error("A valid schedule date and time is required.");
  }
  return date.toISOString();
}

export async function listSocialPosts(): Promise<SocialPost[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_posts")
    .select(SOCIAL_POST_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapSocialPostRow(row as SocialPost));
}

export async function getSocialPostById(id: string): Promise<SocialPost | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_posts")
    .select(SOCIAL_POST_SELECT)
    .eq("id", id)
    .maybeSingle<SocialPost>();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapSocialPostRow(data) : null;
}

export async function createSocialPost(
  input: CreateSocialPostInput,
): Promise<SocialPost> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_posts")
    .insert({
      title: cleanText(input.title),
      campaign_id: cleanText(input.campaign_id),
      goal: cleanText(input.goal),
      prompt: cleanText(input.prompt),
      caption: cleanText(input.caption),
      media_type: normalizeMediaType(input.media_type),
      business_focus: normalizeBusinessFocus(input.business_focus),
      media_url: cleanText(input.media_url),
      source_image_url: cleanText(input.source_image_url),
      motion_preset: cleanText(input.motion_preset),
      camera_preset: cleanText(input.camera_preset),
      creative_source: cleanText(input.creative_source),
      platforms: normalizePlatforms(input.platforms),
      status: "draft",
    })
    .select(SOCIAL_POST_SELECT)
    .single<SocialPost>();

  if (error) {
    throw new Error(error.message);
  }

  return mapSocialPostRow(data);
}

export async function updateSocialPostMediaUrl(
  id: string,
  mediaUrl: string,
  options?: {
    motionPreset?: string | null;
    cameraPreset?: string | null;
    mediaSourceUrl?: string | null;
  },
): Promise<SocialPost> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_posts")
    .update({
      media_url: cleanText(mediaUrl),
      media_source_url: cleanText(options?.mediaSourceUrl),
      motion_preset: cleanText(options?.motionPreset),
      camera_preset: cleanText(options?.cameraPreset),
      updated_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", id)
    .select(SOCIAL_POST_SELECT)
    .single<SocialPost>();

  if (error) {
    throw new Error(error.message);
  }

  return mapSocialPostRow(data);
}

export type StartSocialPostImageGenerationInput = {
  originalImageUrl: string | null;
  generationPrompt: string;
  provider: string;
  model: string;
  predictionId: string;
  status: string;
  generatedImageUrl?: string | null;
};

export async function startSocialPostImageGeneration(
  id: string,
  input: StartSocialPostImageGenerationInput,
): Promise<SocialPost> {
  const existing = await getSocialPostById(id);
  if (!existing) throw new Error("Social post not found.");

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_posts")
    .update({
      original_image_url:
        cleanText(existing.original_image_url) ?? cleanText(input.originalImageUrl),
      image_generation_prompt: cleanText(input.generationPrompt),
      image_generation_provider: cleanText(input.provider),
      image_generation_model: cleanText(input.model),
      image_prediction_id: cleanText(input.predictionId),
      image_generation_created_at: new Date().toISOString(),
      image_generation_status: cleanText(input.status),
      generated_image_url: cleanText(input.generatedImageUrl),
      updated_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", id)
    .select(SOCIAL_POST_SELECT)
    .single<SocialPost>();

  if (error) {
    throw new Error(error.message);
  }

  return mapSocialPostRow(data);
}

export async function updateSocialPostImageGenerationStatus(
  id: string,
  input: {
    status: string;
    generatedImageUrl?: string | null;
    generatedImageSourceUrl?: string | null;
    errorMessage?: string | null;
  },
): Promise<SocialPost> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_posts")
    .update({
      image_generation_status: cleanText(input.status),
      generated_image_url: cleanText(input.generatedImageUrl),
      generated_image_source_url: cleanText(input.generatedImageSourceUrl),
      error_message: cleanText(input.errorMessage),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(SOCIAL_POST_SELECT)
    .single<SocialPost>();

  if (error) {
    throw new Error(error.message);
  }

  return mapSocialPostRow(data);
}

export async function acceptSocialPostGeneratedImage(id: string): Promise<SocialPost> {
  const post = await getSocialPostById(id);
  if (!post) throw new Error("Social post not found.");
  if (!post.generated_image_url?.trim()) {
    throw new Error("No generated image is available to accept.");
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_posts")
    .update({
      approved_image_url: cleanText(post.generated_image_url),
      updated_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", id)
    .select(SOCIAL_POST_SELECT)
    .single<SocialPost>();

  if (error) {
    throw new Error(error.message);
  }

  return mapSocialPostRow(data);
}

export async function rejectSocialPostGeneratedImage(id: string): Promise<SocialPost> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_posts")
    .update({
      generated_image_url: null,
      image_prediction_id: null,
      image_generation_status: null,
      updated_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", id)
    .select(SOCIAL_POST_SELECT)
    .single<SocialPost>();

  if (error) {
    throw new Error(error.message);
  }

  return mapSocialPostRow(data);
}

export async function approveImageStudioSource(
  id: string,
  imageUrl: string,
): Promise<SocialPost> {
  const cleanedUrl = cleanText(imageUrl);
  if (!cleanedUrl) {
    throw new Error("Approved image URL is required.");
  }

  const post = await getSocialPostById(id);
  if (!post) throw new Error("Social post not found.");

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_posts")
    .update({
      source_image_url: cleanedUrl,
      approved_image_url: cleanedUrl,
      original_image_url:
        cleanText(post.original_image_url) ?? cleanText(post.source_image_url),
      generated_image_url: cleanedUrl,
      image_generation_status: "succeeded",
      updated_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", id)
    .select(SOCIAL_POST_SELECT)
    .single<SocialPost>();

  if (error) {
    throw new Error(error.message);
  }

  return mapSocialPostRow(data);
}

export async function removeImageStudioSourceImage(id: string): Promise<SocialPost> {
  const post = await getSocialPostById(id);
  if (!post) throw new Error("Social post not found.");

  const fallback =
    cleanText(post.original_image_url) ?? cleanText(post.source_image_url);

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_posts")
    .update({
      source_image_url: fallback,
      approved_image_url: null,
      updated_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", id)
    .select(SOCIAL_POST_SELECT)
    .single<SocialPost>();

  if (error) {
    throw new Error(error.message);
  }

  return mapSocialPostRow(data);
}

export function buildSocialPostImageConcept(input: {
  id: ImageConceptId;
  status: string;
  predictionId: string;
  prompt: string;
  provider: string;
  model: string;
  imageUrl?: string | null;
  error?: string | null;
  favorite?: boolean;
  rejected?: boolean;
  createdAt?: string;
}): SocialPostImageConcept {
  return {
    id: input.id,
    label: CONCEPT_LABELS[input.id],
    status: input.status,
    predictionId: input.predictionId,
    prompt: input.prompt,
    provider: input.provider,
    model: input.model,
    imageUrl: input.imageUrl ?? null,
    error: input.error ?? null,
    favorite: input.favorite ?? false,
    rejected: input.rejected ?? false,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export async function saveSocialPostImageConcepts(
  id: string,
  concepts: SocialPostImageConcept[],
): Promise<SocialPost> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_posts")
    .update({
      image_concepts: concepts,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(SOCIAL_POST_SELECT)
    .single<SocialPost>();

  if (error) {
    throw new Error(error.message);
  }

  return mapSocialPostRow(data);
}

export async function upsertSocialPostImageConcept(
  id: string,
  concept: SocialPostImageConcept,
): Promise<SocialPost> {
  const post = await getSocialPostById(id);
  if (!post) throw new Error("Social post not found.");

  const concepts = [...post.image_concepts];
  const index = concepts.findIndex((item) => item.id === concept.id);
  if (index >= 0) {
    concepts[index] = { ...concepts[index], ...concept };
  } else {
    concepts.push(concept);
  }

  return saveSocialPostImageConcepts(id, concepts);
}

export async function updateSocialPostImageConceptStatus(
  id: string,
  conceptId: ImageConceptId,
  patch: {
    status: string;
    imageUrl?: string | null;
    error?: string | null;
  },
): Promise<SocialPost> {
  const post = await getSocialPostById(id);
  if (!post) throw new Error("Social post not found.");

  const concepts = post.image_concepts.map((concept) =>
    concept.id === conceptId
      ? {
          ...concept,
          status: patch.status,
          imageUrl:
            patch.imageUrl !== undefined ? patch.imageUrl : concept.imageUrl,
          error: patch.error !== undefined ? patch.error : concept.error,
        }
      : concept,
  );

  return saveSocialPostImageConcepts(id, concepts);
}

export async function clearSocialPostImageConcepts(id: string): Promise<SocialPost> {
  return saveSocialPostImageConcepts(id, []);
}

export async function discardImageStudioConcepts(id: string): Promise<SocialPost> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_posts")
    .update({
      image_concepts: [],
      generated_image_url: null,
      generated_image_source_url: null,
      image_prediction_id: null,
      image_generation_status: null,
      image_generation_prompt: null,
      image_generation_provider: null,
      image_generation_model: null,
      image_generation_created_at: null,
      updated_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", id)
    .select(SOCIAL_POST_SELECT)
    .single<SocialPost>();

  if (error) {
    throw new Error(error.message);
  }

  return mapSocialPostRow(data);
}

export async function updateSocialPostStatus(
  id: string,
  status: string,
): Promise<SocialPost> {
  assertSocialPostStatus(status);

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_posts")
    .update({
      status,
      updated_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", id)
    .select(SOCIAL_POST_SELECT)
    .single<SocialPost>();

  if (error) {
    throw new Error(error.message);
  }

  return mapSocialPostRow(data);
}

export async function scheduleSocialPost(
  id: string,
  scheduled_for: string,
): Promise<SocialPost> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_posts")
    .update({
      status: "scheduled",
      scheduled_for: normalizeScheduledFor(scheduled_for),
      updated_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", id)
    .select(SOCIAL_POST_SELECT)
    .single<SocialPost>();

  if (error) {
    throw new Error(error.message);
  }

  return mapSocialPostRow(data);
}

export async function updateSocialPostDraft(
  id: string,
  input: UpdateSocialPostDraftInput,
): Promise<SocialPost> {
  assertRequiredDraftFields(input);
  if (input.status) assertSocialPostStatus(input.status);

  const existing = await getSocialPostById(id);
  if (!existing) throw new Error("Social post not found.");

  const nextScheduledFor = input.scheduled_for
    ? normalizeScheduledFor(input.scheduled_for)
    : null;
  const nextValues: Partial<SocialPost> = {
    title: cleanText(input.title),
    campaign_id: cleanText(input.campaign_id),
    goal: cleanText(input.goal),
    prompt: cleanText(input.prompt),
    caption: cleanText(input.caption),
    media_type: normalizeMediaType(input.media_type),
    business_focus: normalizeBusinessFocus(input.business_focus),
    source_image_url: cleanText(input.source_image_url),
    motion_preset: cleanText(input.motion_preset),
    camera_preset: cleanText(input.camera_preset),
    creative_source: cleanText(input.creative_source),
    platforms: normalizePlatforms(input.platforms),
    status: (input.status ?? "draft") as SocialPostStatus,
    scheduled_for: nextScheduledFor,
  };

  const update: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(nextValues)) {
    const existingValue = existing[key as keyof SocialPost];
    const changed = Array.isArray(value)
      ? JSON.stringify(value) !== JSON.stringify(existingValue)
      : value !== existingValue;
    if (changed) update[key] = value;
  }

  if (Object.keys(update).length === 0) {
    return existing;
  }

  update.updated_at = new Date().toISOString();
  update.error_message = null;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_posts")
    .update(update)
    .eq("id", id)
    .select(SOCIAL_POST_SELECT)
    .single<SocialPost>();

  if (error) {
    throw new Error(error.message);
  }

  return mapSocialPostRow(data);
}

export async function duplicateSocialPostDraft(id: string): Promise<SocialPost> {
  const post = await getSocialPostById(id);
  if (!post) throw new Error("Social post not found.");

  return createSocialPost({
    title: post.title,
    campaign_id: post.campaign_id,
    goal: post.goal,
    prompt: post.prompt,
    caption: post.caption,
    media_type: post.media_type,
    business_focus: post.business_focus,
    source_image_url: post.source_image_url,
    motion_preset: post.motion_preset,
    camera_preset: post.camera_preset,
    creative_source: post.creative_source,
    platforms: post.platforms,
  });
}

export async function deleteSocialPost(id: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("social_posts").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
