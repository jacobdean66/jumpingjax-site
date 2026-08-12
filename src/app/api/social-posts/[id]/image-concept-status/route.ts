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
import type { ImageConceptId } from "@/lib/social-posts/image-director";
import { getImageGenerationStatus } from "@/lib/social-posts/image-engine";
import {
  findSocialPostAssetByPrediction,
  updateSocialPostAsset,
} from "@/lib/social-posts/social-post-assets";
import {
  isSupabaseSocialMediaPublicUrl,
  persistSocialMediaFromRemoteUrl,
} from "@/lib/social-posts/social-media-storage";
import { updateSocialPostImageConceptStatus } from "@/lib/social-posts/social-post-data";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function normalizeProviderStatus(status: string): string {
  if (status === "starting" || status === "processing") return "processing";
  if (status === "succeeded") return "succeeded";
  if (status === "failed" || status === "canceled") return "failed";
  return "processing";
}

function parseConceptId(value: string | null): ImageConceptId | null {
  if (value === "A" || value === "B" || value === "C" || value === "D") {
    return value;
  }
  return null;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const route = "/api/social-posts/[id]/image-concept-status";

  try {
    const token = req.nextUrl.searchParams.get("token");
    const predictionId = req.nextUrl.searchParams.get("predictionId");
    const conceptId = parseConceptId(req.nextUrl.searchParams.get("conceptId"));
    const auth = await verifyAdminAccess(token);

    if (!auth.ok) {
      return socialPostGetAuthErrorResponse(route);
    }

    const schemaGuard = await socialPostAdminSchemaGuardResponse();
    if (schemaGuard) {
      return schemaGuard;
    }

    const limited = await socialPostAdminRateLimitResponse(req, {
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

    if (!conceptId) {
      return socialPostGetClientErrorResponse(
        "conceptId is required.",
        route,
        "missing_concept_id",
      );
    }

    const { id } = await context.params;
    const statusResult = await getImageGenerationStatus(predictionId.trim());
    const normalizedStatus = normalizeProviderStatus(statusResult.status);

    let generatedImageUrl = statusResult.generatedImageUrl;
    let generatedImageSourceUrl: string | null = null;
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
      generatedImageUrl = persisted.permanentUrl;
      generatedImageSourceUrl = persisted.sourceUrl;
      storagePath = persisted.storagePath;
    }

    const asset = await findSocialPostAssetByPrediction({
      socialPostId: id,
      predictionId: predictionId.trim(),
      assetType: "image",
    });
    if (!asset) {
      throw new Error("Image concept asset not found.");
    }
    await updateSocialPostAsset({
      socialPostId: id,
      assetId: asset.id,
      url: generatedImageUrl ?? null,
      sourceUrl: generatedImageSourceUrl ?? undefined,
      storagePath: storagePath ?? undefined,
      provider: statusResult.provider ?? undefined,
      generationEngine: statusResult.provider ?? undefined,
      model: statusResult.model ?? undefined,
      generationStatus: normalizedStatus,
      notes: statusResult.error ?? undefined,
    });

    const updatedPost = await updateSocialPostImageConceptStatus(id, conceptId, {
      status: normalizedStatus,
      imageUrl: generatedImageUrl,
      error: statusResult.error,
    });
    revalidatePath("/admin/social-posts");

    return NextResponse.json({
      ok: true,
      status: normalizedStatus,
      generatedImageUrl,
      provider: statusResult.provider,
      model: statusResult.model,
      predictionId: statusResult.predictionId,
      error: statusResult.error,
      imageConcepts: updatedPost.image_concepts,
      post: updatedPost,
    });
  } catch (error) {
    return socialPostGetErrorResponse(error, route, 500, "image_concept_status_failed");
  }
}
