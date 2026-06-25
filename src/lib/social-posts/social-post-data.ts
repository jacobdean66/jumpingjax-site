import { createServiceRoleClient } from "@/lib/supabase/admin";

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
  "id, created_at, updated_at, title, campaign_id, goal, prompt, caption, media_type, business_focus, media_url, source_image_url, motion_preset, camera_preset, creative_source, platforms, status, scheduled_for, posted_at, error_message";

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

  return (data ?? []) as SocialPost[];
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

  return data;
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

  return data;
}

export async function updateSocialPostMediaUrl(
  id: string,
  mediaUrl: string,
  options?: {
    motionPreset?: string | null;
    cameraPreset?: string | null;
  },
): Promise<SocialPost> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("social_posts")
    .update({
      media_url: cleanText(mediaUrl),
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

  return data;
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

  return data;
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

  return data;
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

  return data;
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
