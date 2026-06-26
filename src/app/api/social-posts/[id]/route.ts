import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  createSocialAgentPlan,
  type SocialAgentInput,
} from "@/lib/social-posts/social-agent";
import {
  acceptSocialPostGeneratedImage,
  deleteSocialPost,
  discardImageStudioConcepts,
  duplicateSocialPostDraft,
  getSocialPostById,
  rejectSocialPostGeneratedImage,
  removeImageStudioSourceImage,
  scheduleSocialPost,
  updateSocialPostDraft,
  updateSocialPostStatus,
  approveImageStudioSource,
  type SocialPost,
} from "@/lib/social-posts/social-post-data";
import {
  createSocialPostAsset,
  findSocialPostAssetByPrediction,
  findSocialPostAssetByUrl,
  selectSocialPostAsset,
  updateSocialPostAsset,
} from "@/lib/social-posts/social-post-assets";
import { verifyAdminAccess } from "@/lib/admin/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function formRedirect(req: NextRequest, token: string, params: Record<string, string>) {
  const search = new URLSearchParams({ token, ...params });
  return NextResponse.redirect(
    new URL(`/admin/social-posts?${search.toString()}`, req.url),
    { status: 303 },
  );
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function arrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function agentInputFromBody(body: Record<string, unknown>): SocialAgentInput {
  return {
    goal: stringValue(body.goal),
    campaignId: stringValue(body.campaign_id),
    platform: "both",
    mediaType: stringValue(body.media_type) === "image" ? "image" : "video",
    businessFocus:
      stringValue(body.business_focus) === "rentals" ||
      stringValue(body.business_focus) === "facility-parties"
        ? (stringValue(body.business_focus) as SocialAgentInput["businessFocus"])
        : "both",
  };
}

async function findCurrentGeneratedImageAsset(
  post: SocialPost,
) {
  if (post.image_prediction_id) {
    return findSocialPostAssetByPrediction({
      socialPostId: post.id,
      predictionId: post.image_prediction_id,
      assetType: "image",
    });
  }

  if (!post.generated_image_url) return null;
  return findSocialPostAssetByUrl({
    socialPostId: post.id,
    url: post.generated_image_url,
    assetType: "image",
  });
}

async function recordApprovedImageAsset(input: {
  post: SocialPost;
  imageUrl: string;
  sourceUrl?: string | null;
}) {
  const selectedAsset = await findSocialPostAssetByUrl({
    socialPostId: input.post.id,
    url: input.imageUrl,
    assetType: "image",
  });
  if (!selectedAsset) {
    throw new Error("Selected image asset not found.");
  }

  let approvedAsset = await findSocialPostAssetByUrl({
    socialPostId: input.post.id,
    url: input.imageUrl,
    assetType: "image",
    assetStage: "approved",
  });
  if (!approvedAsset) {
    approvedAsset = await createSocialPostAsset({
      socialPostId: input.post.id,
      parentAssetId: selectedAsset.id,
      assetType: "image",
      assetStage: "approved",
      url: input.imageUrl,
      sourceUrl: input.sourceUrl ?? null,
      createdBy: "human",
    });
  }

  await selectSocialPostAsset({
    socialPostId: input.post.id,
    assetId: approvedAsset.id,
  });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await req.json()) as Record<string, unknown> & {
      token?: string;
      status?: string;
      scheduled_for?: string;
      action?: string;
    };
    const auth = await verifyAdminAccess(body.token);

    if (!auth.ok) {
      return NextResponse.json({ error: "Invalid admin login" }, { status: 401 });
    }

    try {
      if (body.action === "duplicate") {
        const post = await duplicateSocialPostDraft(id);
        revalidatePath("/admin/social-posts");
        return NextResponse.json({ post });
      }

      if (body.action === "accept_image") {
        const existing = await getSocialPostById(id);
        if (!existing) {
          return NextResponse.json({ error: "Social post not found" }, { status: 404 });
        }
        if (!existing.generated_image_url) {
          return NextResponse.json(
            { error: "No generated image is available to accept." },
            { status: 400 },
          );
        }
        await recordApprovedImageAsset({
          post: existing,
          imageUrl: existing.generated_image_url,
          sourceUrl: existing.generated_image_source_url,
        });
        const post = await acceptSocialPostGeneratedImage(id);
        revalidatePath("/admin/social-posts");
        return NextResponse.json({ post });
      }

      if (body.action === "reject_image") {
        const existing = await getSocialPostById(id);
        if (!existing) {
          return NextResponse.json({ error: "Social post not found" }, { status: 404 });
        }
        const generatedAsset = await findCurrentGeneratedImageAsset(existing);
        if (!generatedAsset) {
          return NextResponse.json(
            { error: "Generated image asset not found." },
            { status: 400 },
          );
        }
        await updateSocialPostAsset({
          socialPostId: id,
          assetId: generatedAsset.id,
          isSelected: false,
          isRejected: true,
        });
        const post = await rejectSocialPostGeneratedImage(id);
        revalidatePath("/admin/social-posts");
        return NextResponse.json({ post });
      }

      if (body.action === "use_as_source_image") {
        const imageUrl = stringValue(body.image_url);
        const existing = await getSocialPostById(id);
        if (!existing) {
          return NextResponse.json({ error: "Social post not found" }, { status: 404 });
        }
        if (!imageUrl) {
          return NextResponse.json(
            { error: "Approved image URL is required." },
            { status: 400 },
          );
        }
        await recordApprovedImageAsset({ post: existing, imageUrl });
        const post = await approveImageStudioSource(id, imageUrl);
        revalidatePath("/admin/social-posts");
        return NextResponse.json({ post });
      }

      if (body.action === "remove_source_image") {
        const post = await removeImageStudioSourceImage(id);
        revalidatePath("/admin/social-posts");
        return NextResponse.json({ post });
      }

      if (body.action === "discard_image_concepts") {
        const post = await discardImageStudioConcepts(id);
        revalidatePath("/admin/social-posts");
        return NextResponse.json({ post });
      }

      if (
        body.action === "regenerate_caption" ||
        body.action === "regenerate_prompt" ||
        body.action === "regenerate_all"
      ) {
        const plan = await createSocialAgentPlan(agentInputFromBody(body));
        const existing = await getSocialPostById(id);
        if (!existing) {
          return NextResponse.json({ error: "Social post not found" }, { status: 404 });
        }

        const post = await updateSocialPostDraft(id, {
          title:
            body.action === "regenerate_all"
              ? plan.title
              : stringValue(body.title) || existing.title,
          campaign_id:
            body.action === "regenerate_all"
              ? plan.campaignId
              : stringValue(body.campaign_id) || existing.campaign_id,
          goal: stringValue(body.goal) || existing.goal,
          prompt:
            body.action === "regenerate_prompt" || body.action === "regenerate_all"
              ? plan.generationPrompt
              : stringValue(body.prompt) || existing.prompt,
          caption:
            body.action === "regenerate_caption" || body.action === "regenerate_all"
              ? plan.caption
              : stringValue(body.caption) || existing.caption,
          media_type:
            body.action === "regenerate_all"
              ? plan.mediaType
              : stringValue(body.media_type) || existing.media_type,
          business_focus:
            body.action === "regenerate_all"
              ? plan.businessFocus
              : stringValue(body.business_focus) || existing.business_focus,
          source_image_url:
            body.action === "regenerate_all"
              ? plan.sourceImageUrl
              : stringValue(body.source_image_url) || existing.source_image_url,
          platforms:
            body.action === "regenerate_all" ? plan.platforms : arrayValue(body.platforms),
          status: stringValue(body.status) || existing.status,
          scheduled_for: stringValue(body.scheduled_for) || null,
        });
        revalidatePath("/admin/social-posts");
        return NextResponse.json({ post });
      }

      if (body.scheduled_for && !body.title) {
        const post = await scheduleSocialPost(id, body.scheduled_for);
        revalidatePath("/admin/social-posts");
        return NextResponse.json({ post });
      }

      if (body.status && !body.title) {
        const post = await updateSocialPostStatus(id, body.status);
        revalidatePath("/admin/social-posts");
        return NextResponse.json({ post });
      }

      const post = await updateSocialPostDraft(id, {
        title: stringValue(body.title),
        campaign_id: stringValue(body.campaign_id),
        goal: stringValue(body.goal),
        prompt: stringValue(body.prompt),
        caption: stringValue(body.caption),
        media_type: stringValue(body.media_type),
        business_focus: stringValue(body.business_focus),
        source_image_url: stringValue(body.source_image_url),
        platforms: arrayValue(body.platforms),
        status: stringValue(body.status),
        scheduled_for: stringValue(body.scheduled_for) || null,
      });
      revalidatePath("/admin/social-posts");
      return NextResponse.json({ post });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Social post update failed" },
        { status: 400 },
      );
    }
  }

  const form = await req.formData();
  const token = clean(form.get("token"));
  const auth = await verifyAdminAccess(token);

  if (!auth.ok) {
    return formRedirect(req, token, { error: "Invalid admin login" });
  }

  try {
    const scheduledFor = clean(form.get("scheduled_for"));
    if (scheduledFor) {
      await scheduleSocialPost(id, scheduledFor);
    } else {
      await updateSocialPostStatus(id, clean(form.get("status")));
    }
    revalidatePath("/admin/social-posts");
    return formRedirect(req, token, { message: "Social post updated" });
  } catch (error) {
    return formRedirect(req, token, {
      error: error instanceof Error ? error.message : "Social post update failed",
    });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const token = req.nextUrl.searchParams.get("token");
  const auth = await verifyAdminAccess(token);

  if (!auth.ok) {
    return NextResponse.json({ error: "Invalid admin login" }, { status: 401 });
  }

  try {
    await deleteSocialPost(id);
    revalidatePath("/admin/social-posts");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Social post delete failed" },
      { status: 400 },
    );
  }
}
