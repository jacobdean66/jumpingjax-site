import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/session";
import { getImageGenerationStatus } from "@/lib/social-posts/image-engine";
import {
  findSocialPostAssetByPrediction,
  updateSocialPostAsset,
} from "@/lib/social-posts/social-post-assets";
import {
  isSupabaseSocialMediaPublicUrl,
  persistSocialMediaFromRemoteUrl,
} from "@/lib/social-posts/social-media-storage";
import {
  getSocialPostById,
  updateSocialPostImageGenerationStatus,
} from "@/lib/social-posts/social-post-data";
import { verifySocialMediaImageFromUrl } from "@/lib/social-posts/social-media-image-verification";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function normalizeProviderStatus(status: string): string {
  if (status === "starting" || status === "processing") return "processing";
  if (status === "succeeded") return "succeeded";
  if (status === "failed" || status === "canceled") return "failed";
  return "processing";
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    const auth = await verifyAdminAccess(token);

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

    if (!post.image_prediction_id) {
      const generatedImageUrl = post.generated_image_url;
      const status = post.image_generation_status;
      const verification =
        status === "succeeded" && generatedImageUrl
          ? await verifySocialMediaImageFromUrl({
              imageUrl: generatedImageUrl,
              placement: post.post_placement,
              formatVariantId: post.format_variant_id,
              platforms: post.platforms,
            })
          : null;

      return NextResponse.json({
        ok: true,
        post,
        status,
        generatedImageUrl,
        provider: post.image_generation_provider,
        model: post.image_generation_model,
        predictionId: null,
        verification,
      });
    }

    const statusResult = await getImageGenerationStatus(post.image_prediction_id);
    const normalizedStatus = normalizeProviderStatus(statusResult.status);

    let generatedImageUrl =
      statusResult.generatedImageUrl ?? post.generated_image_url;
    let generatedImageSourceUrl = post.generated_image_source_url;
    let storagePath: string | null = null;

    if (
      normalizedStatus === "succeeded" &&
      generatedImageUrl &&
      !isSupabaseSocialMediaPublicUrl(generatedImageUrl)
    ) {
      const persisted = await persistSocialMediaFromRemoteUrl({
        postId: id,
        remoteUrl: generatedImageUrl,
        kind: "image",
      });
      generatedImageSourceUrl = persisted.sourceUrl;
      generatedImageUrl = persisted.permanentUrl;
      storagePath = persisted.storagePath;
    }

    let updatedPost = post;
    if (
      normalizedStatus !== post.image_generation_status ||
      generatedImageUrl !== post.generated_image_url ||
      generatedImageSourceUrl !== post.generated_image_source_url ||
      statusResult.error
    ) {
      const asset = await findSocialPostAssetByPrediction({
        socialPostId: id,
        predictionId: post.image_prediction_id,
        assetType: "image",
      });
      if (!asset) {
        throw new Error("Generated image asset not found.");
      }
      await updateSocialPostAsset({
        socialPostId: id,
        assetId: asset.id,
        url: generatedImageUrl,
        sourceUrl: generatedImageSourceUrl,
        storagePath: storagePath ?? undefined,
        provider: statusResult.provider ?? undefined,
        generationEngine: statusResult.provider ?? undefined,
        model: statusResult.model ?? undefined,
        generationStatus: normalizedStatus,
        notes: statusResult.error ?? undefined,
      });
      updatedPost = await updateSocialPostImageGenerationStatus(id, {
        status: normalizedStatus,
        generatedImageUrl,
        generatedImageSourceUrl,
        errorMessage: statusResult.error,
      });
      revalidatePath("/admin/social-posts");
    }

    let verification = null;
    if (normalizedStatus === "succeeded" && generatedImageUrl) {
      verification = await verifySocialMediaImageFromUrl({
        imageUrl: generatedImageUrl,
        placement: updatedPost.post_placement,
        formatVariantId: updatedPost.format_variant_id,
        platforms: updatedPost.platforms,
      });
    }

    return NextResponse.json({
      ok: true,
      post: updatedPost,
      status: normalizedStatus,
      generatedImageUrl,
      provider: statusResult.provider,
      model: statusResult.model,
      predictionId: statusResult.predictionId,
      error: statusResult.error,
      verification,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Image status check failed.",
      },
      { status: 500 },
    );
  }
}
