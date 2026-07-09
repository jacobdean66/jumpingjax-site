import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/session";
import { socialPostAdminSchemaGuardResponse } from "@/lib/social-posts/social-post-admin-schema-guard";
import {
  buildImageDirectorPrompt,
  normalizeImageStudioPresetValue,
} from "@/lib/social-posts/image-director";
import { resolveImageGenerationMode, startImageGeneration } from "@/lib/social-posts/image-engine";
import { resolvePostMediaFormat } from "@/lib/social-posts/social-media-format-variants";
import {
  createSocialPostAsset,
  findOrCreateSocialPostSourceAsset,
  findSocialPostAssetByPrediction,
  updateSocialPostAsset,
} from "@/lib/social-posts/social-post-assets";
import { getSocialCampaign } from "@/lib/social-posts/social-campaigns";
import {
  getSocialPostById,
  startSocialPostImageGeneration,
} from "@/lib/social-posts/social-post-data";
import { socialVideoSourceImageUrl } from "@/lib/social-posts/social-video-utils";
import { sourceImageCategory } from "@/lib/social-posts/video-director";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type GenerateImageRequest = {
  token?: string;
  finalImagePrompt?: string;
  imageDirectionPreset?: string | null;
  sourceImageUrl?: string | null;
  mode?: "edit" | "generate" | null;
};

function normalizeProviderStatus(status: string): string {
  if (status === "starting" || status === "processing") return "processing";
  if (status === "succeeded") return "succeeded";
  if (status === "failed" || status === "canceled") return "failed";
  return "processing";
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const body = (await req.json()) as GenerateImageRequest;
    const auth = await verifyAdminAccess(body.token);

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: "Invalid admin login" },
        { status: 401 },
      );
    }

    const schemaGuard = await socialPostAdminSchemaGuardResponse();
    if (schemaGuard) {
      return schemaGuard;
    }

    const { id } = await context.params;
    const post = await getSocialPostById(id);

    if (!post) {
      return NextResponse.json(
        { ok: false, error: "Social post not found" },
        { status: 404 },
      );
    }

    if (post.media_type !== "video") {
      return NextResponse.json(
        { ok: false, error: "Image generation is only available for video drafts." },
        { status: 400 },
      );
    }

    const preset = normalizeImageStudioPresetValue(body.imageDirectionPreset);
    const resolvedSourceImageUrl = socialVideoSourceImageUrl(
      typeof body.sourceImageUrl === "string" && body.sourceImageUrl.trim()
        ? body.sourceImageUrl.trim()
        : post.source_image_url,
    );
    const category = sourceImageCategory(resolvedSourceImageUrl);
    const campaignName =
      getSocialCampaign(post.campaign_id)?.label ??
      (post.campaign_id ? post.campaign_id : null);

    const { prompt: builtPrompt } = buildImageDirectorPrompt({
      originalSourceImageUrl: resolvedSourceImageUrl,
      campaignName,
      postPrompt: post.prompt ?? "",
      sourceImageCategory: category,
      imageStudioPreset: preset,
      platforms: post.platforms,
      postPlacement: post.post_placement,
      formatVariantId: post.format_variant_id,
    });

    const generationPrompt = body.finalImagePrompt?.trim() || builtPrompt;
    const mediaFormat = resolvePostMediaFormat({
      platforms: post.platforms,
      placement: post.post_placement,
      formatVariantId: post.format_variant_id,
    });
    const mode = resolveImageGenerationMode({
      mode: body.mode,
      sourceImageUrl: resolvedSourceImageUrl,
    });

    const result = await startImageGeneration({
      prompt: generationPrompt,
      sourceImageUrl: resolvedSourceImageUrl,
      mode,
      aspectRatio: mediaFormat.replicateAspectRatio,
    });

    const sourceAsset = resolvedSourceImageUrl
      ? await findOrCreateSocialPostSourceAsset({
          socialPostId: id,
          sourceUrl: resolvedSourceImageUrl,
          createdBy: "image_director",
        })
      : null;
    const existingAsset = await findSocialPostAssetByPrediction({
      socialPostId: id,
      predictionId: result.predictionId,
      assetType: "image",
    });

    if (existingAsset) {
      await updateSocialPostAsset({
        socialPostId: id,
        assetId: existingAsset.id,
        url: result.generatedImageUrl ?? null,
        generationStatus: normalizeProviderStatus(result.status),
      });
    } else {
      await createSocialPostAsset({
        socialPostId: id,
        parentAssetId: sourceAsset?.id,
        assetType: "image",
        assetStage: "generated",
        url: result.generatedImageUrl ?? null,
        provider: result.provider,
        generationEngine: result.provider,
        model: result.model,
        predictionId: result.predictionId,
        generationStatus: normalizeProviderStatus(result.status),
        generationPrompt,
        createdBy: "image_director",
        metadata: {
          mode,
          source_image_url: resolvedSourceImageUrl,
          post_placement: post.post_placement,
          format_variant_id: mediaFormat.variantId,
          aspect_ratio: mediaFormat.aspectRatio,
          recommended_width: mediaFormat.recommendedWidth,
          recommended_height: mediaFormat.recommendedHeight,
        },
      });
    }

    const updatedPost = await startSocialPostImageGeneration(id, {
      originalImageUrl: resolvedSourceImageUrl,
      generationPrompt,
      provider: result.provider,
      model: result.model,
      predictionId: result.predictionId,
      status: normalizeProviderStatus(result.status),
      generatedImageUrl: result.generatedImageUrl,
    });

    revalidatePath("/admin/social-posts");

    return NextResponse.json({
      ok: true,
      post: updatedPost,
      predictionId: result.predictionId,
      status: normalizeProviderStatus(result.status),
      generatedImageUrl: result.generatedImageUrl,
      provider: result.provider,
      model: result.model,
      mode,
      aspectRatio: mediaFormat.aspectRatio,
      formatVariantId: mediaFormat.variantId,
      recommendedDimensions: `${mediaFormat.recommendedWidth}x${mediaFormat.recommendedHeight}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Image generation failed.",
      },
      { status: 500 },
    );
  }
}
