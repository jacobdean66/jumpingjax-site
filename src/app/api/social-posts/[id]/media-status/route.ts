import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/session";
import { socialPostAdminSchemaGuardResponse } from "@/lib/social-posts/social-post-admin-schema-guard";
import { socialPostAdminRateLimitResponse } from "@/lib/social-posts/social-post-admin-rate-limit";
import {
  socialPostGetAuthErrorResponse,
  socialPostGetClientErrorResponse,
  socialPostGetErrorResponse,
} from "@/lib/social-posts/social-post-get-api-response";
import {
  findSocialPostAssetByPrediction,
  selectSocialPostAsset,
  updateSocialPostAsset,
} from "@/lib/social-posts/social-post-assets";
import { recordSocialPostDecision } from "@/lib/social-posts/social-post-decisions";
import {
  isSupabaseSocialMediaPublicUrl,
  persistSocialMediaFromRemoteUrl,
} from "@/lib/social-posts/social-media-storage";
import {
  getSocialPostById,
  updateSocialPostMediaUrl,
} from "@/lib/social-posts/social-post-data";
import {
  getVideoGenerationStatus,
  normalizeVideoProviderStatus,
} from "@/lib/social-posts/video-engine";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function recordSocialPostDecisionBestEffort(
  input: Parameters<typeof recordSocialPostDecision>[0],
) {
  try {
    await recordSocialPostDecision(input);
  } catch (error) {
    console.error("Failed to record social post decision", error);
  }
}

function metadataString(
  metadata: Record<string, unknown>,
  key: string,
): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const route = "/api/social-posts/[id]/media-status";

  try {
    const token = req.nextUrl.searchParams.get("token");
    const predictionId = req.nextUrl.searchParams.get("predictionId");
    const auth = await verifyAdminAccess(token);

    if (!auth.ok) {
      return socialPostGetAuthErrorResponse(route);
    }

    const schemaGuard = await socialPostAdminSchemaGuardResponse();
    if (schemaGuard) {
      return schemaGuard;
    }

    const limited = socialPostAdminRateLimitResponse(req, {
      route,
      category: "polling",
      token,
    });
    if (limited) {
      return limited;
    }

    if (!predictionId?.trim()) {
      return socialPostGetClientErrorResponse(
        "predictionId is required.",
        route,
        "missing_prediction_id",
      );
    }

    const { id } = await context.params;
    const post = await getSocialPostById(id);

    if (!post) {
      return socialPostGetClientErrorResponse(
        "Social post not found",
        route,
        "post_not_found",
        404,
      );
    }

    const asset = await findSocialPostAssetByPrediction({
      socialPostId: id,
      predictionId: predictionId.trim(),
      assetType: "video",
    });
    if (!asset) {
      return socialPostGetClientErrorResponse(
        "Generated video asset not found.",
        route,
        "video_asset_not_found",
        404,
      );
    }

    // Idempotent short-circuit: already finished and persisted to storage.
    if (
      asset.generation_status === "succeeded" &&
      asset.url &&
      isSupabaseSocialMediaPublicUrl(asset.url)
    ) {
      return NextResponse.json({
        ok: true,
        status: "succeeded",
        mediaUrl: asset.url,
        post,
      });
    }

    const statusResult = await getVideoGenerationStatus(predictionId.trim());
    const normalizedStatus = normalizeVideoProviderStatus(statusResult.status);

    if (normalizedStatus === "failed") {
      await updateSocialPostAsset({
        socialPostId: id,
        assetId: asset.id,
        generationStatus: "failed",
        notes: statusResult.error ?? "Video generation failed.",
      });
      revalidatePath("/admin/social-posts");
      return NextResponse.json({
        ok: false,
        status: "failed",
        error: statusResult.error ?? "Video generation failed.",
        post,
      });
    }

    if (normalizedStatus !== "succeeded" || !statusResult.videoUrl) {
      // Still running — keep the row in sync without creating duplicates.
      if (asset.generation_status !== "processing") {
        await updateSocialPostAsset({
          socialPostId: id,
          assetId: asset.id,
          generationStatus: "processing",
        });
      }
      return NextResponse.json({
        ok: true,
        status: "processing",
        mediaUrl: null,
        post,
      });
    }

    let mediaUrl = statusResult.videoUrl;
    let mediaSourceUrl: string | null = statusResult.videoUrl;
    let storagePath: string | null = null;

    if (!isSupabaseSocialMediaPublicUrl(mediaUrl)) {
      const persisted = await persistSocialMediaFromRemoteUrl({
        postId: id,
        remoteUrl: mediaUrl,
        kind: "video",
      });
      mediaUrl = persisted.permanentUrl;
      mediaSourceUrl = persisted.sourceUrl;
      storagePath = persisted.storagePath;
    }

    const updatedAsset = await updateSocialPostAsset({
      socialPostId: id,
      assetId: asset.id,
      url: mediaUrl,
      sourceUrl: mediaSourceUrl,
      storagePath: storagePath ?? undefined,
      provider: statusResult.provider,
      generationStatus: "succeeded",
    });
    await selectSocialPostAsset({ socialPostId: id, assetId: updatedAsset.id });

    const updatedPost = await updateSocialPostMediaUrl(id, mediaUrl, {
      motionPreset: metadataString(asset.metadata, "motion_preset"),
      cameraPreset: metadataString(asset.metadata, "camera_preset"),
      mediaSourceUrl,
    });
    await recordSocialPostDecisionBestEffort({
      socialPostId: id,
      assetId: updatedAsset.id,
      assetFamilyId: updatedAsset.asset_family_id,
      campaignId: post.campaign_id,
      decisionStage: "video_review",
      decisionType: "selected",
      decision: "Selected succeeded generated video as current social post media.",
      inputSnapshot: {
        prediction_id: predictionId.trim(),
        provider_status: statusResult.status,
        provider_video_url: statusResult.videoUrl,
        previous_media_url: post.media_url,
      },
      outputSnapshot: {
        media_url: updatedPost.media_url,
        media_source_url: updatedPost.media_source_url,
        storage_path: updatedAsset.storage_path,
        asset_id: updatedAsset.id,
        asset_family_id: updatedAsset.asset_family_id,
      },
      provider: statusResult.provider,
      createdBy: "video_director",
    });

    revalidatePath("/admin/social-posts");

    return NextResponse.json({
      ok: true,
      status: "succeeded",
      mediaUrl,
      post: updatedPost,
    });
  } catch (error) {
    return socialPostGetErrorResponse(error, route, 500, "media_status_failed");
  }
}
