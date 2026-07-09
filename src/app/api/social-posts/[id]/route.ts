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
import { recordSocialPostDecision } from "@/lib/social-posts/social-post-decisions";
import { socialPostAdminSchemaGuardResponse } from "@/lib/social-posts/social-post-admin-schema-guard";
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

  return approvedAsset;
}

async function recordSocialPostDecisionBestEffort(
  input: Parameters<typeof recordSocialPostDecision>[0],
) {
  try {
    await recordSocialPostDecision(input);
  } catch (error) {
    console.error("Failed to record social post decision", error);
  }
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

    const schemaGuard = await socialPostAdminSchemaGuardResponse();
    if (schemaGuard) {
      return schemaGuard;
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
        const approvedAsset = await recordApprovedImageAsset({
          post: existing,
          imageUrl: existing.generated_image_url,
          sourceUrl: existing.generated_image_source_url,
        });
        const post = await acceptSocialPostGeneratedImage(id);
        await recordSocialPostDecisionBestEffort({
          socialPostId: id,
          assetId: approvedAsset.id,
          assetFamilyId: approvedAsset.asset_family_id,
          campaignId: existing.campaign_id,
          decisionStage: "image_review",
          decisionType: "accepted",
          decision: "Accepted generated image for video source.",
          inputSnapshot: {
            generated_image_url: existing.generated_image_url,
            generated_image_source_url: existing.generated_image_source_url,
            image_prediction_id: existing.image_prediction_id,
          },
          outputSnapshot: {
            approved_image_url: post.approved_image_url,
            asset_id: approvedAsset.id,
            asset_family_id: approvedAsset.asset_family_id,
          },
          createdBy: "human",
        });
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
        await recordSocialPostDecisionBestEffort({
          socialPostId: id,
          assetId: generatedAsset.id,
          assetFamilyId: generatedAsset.asset_family_id,
          campaignId: existing.campaign_id,
          decisionStage: "image_review",
          decisionType: "rejected",
          decision: "Rejected generated image.",
          inputSnapshot: {
            generated_image_url: existing.generated_image_url,
            image_prediction_id: existing.image_prediction_id,
          },
          outputSnapshot: {
            asset_id: generatedAsset.id,
            asset_family_id: generatedAsset.asset_family_id,
            is_rejected: true,
            generated_image_url: post.generated_image_url,
            image_prediction_id: post.image_prediction_id,
          },
          provider: generatedAsset.provider,
          model: generatedAsset.model,
          createdBy: "human",
        });
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
        const existing = await getSocialPostById(id);
        const post = await discardImageStudioConcepts(id);
        await recordSocialPostDecisionBestEffort({
          socialPostId: id,
          campaignId: existing?.campaign_id ?? post.campaign_id,
          decisionStage: "image_review",
          decisionType: "discarded",
          decision: "Discarded image concepts and cleared generated image state.",
          inputSnapshot: {
            image_concepts_count: existing?.image_concepts.length ?? null,
            generated_image_url: existing?.generated_image_url ?? null,
            image_prediction_id: existing?.image_prediction_id ?? null,
          },
          outputSnapshot: {
            image_concepts_count: post.image_concepts.length,
            generated_image_url: post.generated_image_url,
            image_prediction_id: post.image_prediction_id,
          },
          createdBy: "human",
        });
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
          post_placement: stringValue(body.post_placement) || existing.post_placement,
          format_variant_id:
            stringValue(body.format_variant_id) || existing.format_variant_id,
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
        post_placement: stringValue(body.post_placement),
        format_variant_id: stringValue(body.format_variant_id) || null,
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

  const schemaGuard = await socialPostAdminSchemaGuardResponse();
  if (schemaGuard) {
    const payload = (await schemaGuard.json()) as { error?: string };
    return formRedirect(req, token, {
      error: payload.error ?? "Social posts database schema is not ready.",
    });
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

  const schemaGuard = await socialPostAdminSchemaGuardResponse();
  if (schemaGuard) {
    return schemaGuard;
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
