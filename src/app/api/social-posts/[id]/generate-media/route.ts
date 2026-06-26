import { NextRequest, NextResponse } from "next/server";
import {
  getSocialPostById,
  updateSocialPostMediaUrl,
} from "@/lib/social-posts/social-post-data";
import { buildDirectorPreview } from "@/lib/social-posts/director-console";
import {
  createSocialPostAsset,
  findOrCreateSocialPostSourceAsset,
  findSocialPostAssetByUrl,
  selectSocialPostAsset,
  updateSocialPostAsset,
} from "@/lib/social-posts/social-post-assets";
import {
  isSupabaseSocialMediaPublicUrl,
  persistSocialMediaFromRemoteUrl,
} from "@/lib/social-posts/social-media-storage";
import {
  aiVideoAppUrl,
  socialPostEffectiveSourceImageUrl,
  isPublicHttpUrl,
  socialVideoSourceImageUrl,
} from "@/lib/social-posts/social-video-utils";
import { verifyAdminAccess } from "@/lib/admin/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type GenerateRequest = {
  token?: string;
  finalPrompt?: string;
  motionPreset?: string | null;
  cameraPreset?: string | null;
};

type GenerateStartResponse = {
  jobId?: string;
  status?: string;
  error?: string;
};

type GenerateStatusResponse = {
  status?: string;
  video_url?: string | null;
  error?: string | null;
};

const POLL_ATTEMPTS = 36;
const POLL_INTERVAL_MS = 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateVideoFromExistingAiCreator(
  prompt: string,
  postSourceImageUrl: string | null,
): Promise<string> {
  const sourceImageUrl = socialVideoSourceImageUrl(postSourceImageUrl);

  if (!sourceImageUrl || !isPublicHttpUrl(sourceImageUrl)) {
    throw new Error(
      "Video generation needs a valid public source image URL. Add source_image_url to this social post, or configure SOCIAL_POST_VIDEO_SOURCE_IMAGE_URL or NEXT_PUBLIC_SITE_URL.",
    );
  }

  const baseUrl = aiVideoAppUrl();
  const startResponse = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt,
      imageUrl: sourceImageUrl,
      referenceSummary: "Social post draft generated from the Jumping Jax admin.",
      duration: 5,
      qualityMode: "draft",
    }),
  });
  const startData = (await startResponse.json()) as GenerateStartResponse;

  if (!startResponse.ok || !startData.jobId) {
    throw new Error(startData.error ?? "Failed to start video generation.");
  }

  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await sleep(POLL_INTERVAL_MS);

    const statusResponse = await fetch(
      `${baseUrl}/api/status?jobId=${encodeURIComponent(startData.jobId)}`,
      { cache: "no-store" },
    );
    const statusData = (await statusResponse.json()) as GenerateStatusResponse;

    if (!statusResponse.ok) {
      throw new Error(statusData.error ?? "Failed to check video status.");
    }

    if (statusData.status === "succeeded") {
      if (!statusData.video_url) {
        throw new Error("Video generation finished without a video URL.");
      }
      return statusData.video_url;
    }

    if (statusData.status === "failed" || statusData.status === "canceled") {
      throw new Error(statusData.error ?? "Video generation failed.");
    }
  }

  throw new Error("Video generation is still processing. Try again in a moment.");
}

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

    const remoteVideoUrl = await generateVideoFromExistingAiCreator(
      videoPrompt,
      effectiveSourceImageUrl,
    );

    if (!effectiveSourceImageUrl) {
      throw new Error("Video generation completed without a source image.");
    }

    let mediaUrl = remoteVideoUrl;
    let mediaSourceUrl: string | null = post.media_source_url;
    let storagePath: string | null = null;

    if (remoteVideoUrl && !isSupabaseSocialMediaPublicUrl(remoteVideoUrl)) {
      const persisted = await persistSocialMediaFromRemoteUrl({
        postId: id,
        remoteUrl: remoteVideoUrl,
        kind: "video",
      });
      mediaUrl = persisted.permanentUrl;
      mediaSourceUrl = persisted.sourceUrl;
      storagePath = persisted.storagePath;
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
    let videoAsset = await findSocialPostAssetByUrl({
      socialPostId: id,
      url: mediaUrl,
      assetType: "video",
      assetStage: "generated",
    });

    if (videoAsset) {
      videoAsset = await updateSocialPostAsset({
        socialPostId: id,
        assetId: videoAsset.id,
        sourceUrl: mediaSourceUrl,
        storagePath: storagePath ?? undefined,
        generationStatus: "succeeded",
        generationPrompt: videoPrompt,
      });
    } else {
      videoAsset = await createSocialPostAsset({
        socialPostId: id,
        parentAssetId: parentAsset.id,
        assetType: "video",
        assetStage: "generated",
        url: mediaUrl,
        sourceUrl: mediaSourceUrl,
        storagePath,
        generationEngine: "ai-video-app",
        generationStatus: "succeeded",
        generationPrompt: videoPrompt,
        createdBy: "video_director",
        metadata: {
          motion_preset: preview.generationSettings.motionPreset,
          camera_preset: preview.generationSettings.cameraPreset,
        },
      });
    }
    await selectSocialPostAsset({ socialPostId: id, assetId: videoAsset.id });

    const updatedPost = await updateSocialPostMediaUrl(id, mediaUrl, {
      motionPreset: preview.generationSettings.motionPreset,
      cameraPreset: preview.generationSettings.cameraPreset,
      mediaSourceUrl,
    });

    return NextResponse.json({ ok: true, post: updatedPost, mediaUrl });
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
