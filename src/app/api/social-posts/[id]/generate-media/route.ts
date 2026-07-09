import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  getSocialPostById,
} from "@/lib/social-posts/social-post-data";
import { buildDirectorPreview } from "@/lib/social-posts/director-console";
import {
  createSocialPostAsset,
  findOrCreateSocialPostSourceAsset,
  findSocialPostAssetByPrediction,
  findSocialPostAssetByUrl,
  updateSocialPostAsset,
} from "@/lib/social-posts/social-post-assets";
import {
  normalizeVideoProviderStatus,
  startVideoGeneration,
  SOCIAL_VIDEO_PROVIDER,
} from "@/lib/social-posts/video-engine";
import {
  socialPostEffectiveSourceImageUrl,
} from "@/lib/social-posts/social-video-utils";
import { verifyAdminAccess } from "@/lib/admin/session";
import { socialPostAdminSchemaGuardResponse } from "@/lib/social-posts/social-post-admin-schema-guard";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type GenerateRequest = {
  token?: string;
  finalPrompt?: string;
  motionPreset?: string | null;
  cameraPreset?: string | null;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const body = (await req.json()) as GenerateRequest;
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

    const prompt = post.prompt?.trim();
    if (!prompt) {
      return NextResponse.json(
        { ok: false, error: "Social post prompt is required for media generation." },
        { status: 400 },
      );
    }

    if (post.media_type === "image") {
      return NextResponse.json(
        { ok: false, error: "Image generation is not implemented yet." },
        { status: 400 },
      );
    }

    const motionPreset = body.motionPreset ?? post.motion_preset;
    const cameraPreset = body.cameraPreset ?? post.camera_preset;

    const preview = buildDirectorPreview({
      originalPrompt: prompt,
      campaignId: post.campaign_id,
      goal: post.goal,
      businessFocus: post.business_focus,
      postSourceImageUrl: post.source_image_url,
      approvedImageUrl: post.approved_image_url,
      motionPreset,
      cameraPreset,
      creativeSource: post.creative_source,
    });

    const videoPrompt = body.finalPrompt?.trim() || preview.finalVideoPrompt;
    const effectiveSourceImageUrl = socialPostEffectiveSourceImageUrl(post);

    const started = await startVideoGeneration({
      prompt: videoPrompt,
      sourceImageUrl: effectiveSourceImageUrl,
    });

    if (!effectiveSourceImageUrl) {
      throw new Error("Video generation started without a source image.");
    }

    const parentAsset =
      (await findSocialPostAssetByUrl({
        socialPostId: id,
        url: effectiveSourceImageUrl,
        assetType: "image",
        assetStage: "approved",
      })) ??
      (await findSocialPostAssetByUrl({
        socialPostId: id,
        url: effectiveSourceImageUrl,
        assetType: "image",
        assetStage: "source",
      })) ??
      (await findOrCreateSocialPostSourceAsset({
        socialPostId: id,
        sourceUrl: effectiveSourceImageUrl,
        createdBy: "video_director",
      }));

    const normalizedStatus = normalizeVideoProviderStatus(started.status);
    const existingAsset = await findSocialPostAssetByPrediction({
      socialPostId: id,
      predictionId: started.jobId,
      assetType: "video",
    });

    const videoAsset = existingAsset
      ? await updateSocialPostAsset({
          socialPostId: id,
          assetId: existingAsset.id,
          generationStatus: normalizedStatus,
          generationPrompt: videoPrompt,
        })
      : await createSocialPostAsset({
          socialPostId: id,
          parentAssetId: parentAsset.id,
          assetType: "video",
          assetStage: "generated",
          provider: started.provider,
          generationEngine: SOCIAL_VIDEO_PROVIDER,
          predictionId: started.jobId,
          generationStatus: normalizedStatus,
          generationPrompt: videoPrompt,
          createdBy: "video_director",
          metadata: {
            motion_preset: preview.generationSettings.motionPreset,
            camera_preset: preview.generationSettings.cameraPreset,
            source_image_url: started.sourceImageUrl,
          },
        });

    revalidatePath("/admin/social-posts");

    return NextResponse.json({
      ok: true,
      predictionId: started.jobId,
      assetId: videoAsset.id,
      status: normalizedStatus,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Social post media generation failed.",
      },
      { status: 500 },
    );
  }
}
