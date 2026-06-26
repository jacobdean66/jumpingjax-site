import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/session";
import {
  findSocialPostAssetByPrediction,
  selectSocialPostAsset,
  updateSocialPostAsset,
} from "@/lib/social-posts/social-post-assets";
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

function metadataString(
  metadata: Record<string, unknown>,
  key: string,
): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    const predictionId = req.nextUrl.searchParams.get("predictionId");
    const auth = await verifyAdminAccess(token);

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: "Invalid admin login" },
        { status: 401 },
      );
    }

    if (!predictionId?.trim()) {
      return NextResponse.json(
        { ok: false, error: "predictionId is required." },
        { status: 400 },
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

    const asset = await findSocialPostAssetByPrediction({
      socialPostId: id,
      predictionId: predictionId.trim(),
      assetType: "video",
    });
    if (!asset) {
      return NextResponse.json(
        { ok: false, error: "Generated video asset not found." },
        { status: 404 },
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

    revalidatePath("/admin/social-posts");

    return NextResponse.json({
      ok: true,
      status: "succeeded",
      mediaUrl,
      post: updatedPost,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Video status check failed.",
      },
      { status: 500 },
    );
  }
}
