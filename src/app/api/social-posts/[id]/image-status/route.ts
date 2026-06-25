import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/session";
import { getImageGenerationStatus } from "@/lib/social-posts/image-engine";
import {
  getSocialPostById,
  updateSocialPostImageGenerationStatus,
} from "@/lib/social-posts/social-post-data";

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
      return NextResponse.json({
        ok: true,
        post,
        status: post.image_generation_status,
        generatedImageUrl: post.generated_image_url,
        provider: post.image_generation_provider,
        model: post.image_generation_model,
        predictionId: null,
      });
    }

    const statusResult = await getImageGenerationStatus(post.image_prediction_id);
    const normalizedStatus = normalizeProviderStatus(statusResult.status);

    let updatedPost = post;
    if (
      normalizedStatus !== post.image_generation_status ||
      statusResult.generatedImageUrl !== post.generated_image_url ||
      statusResult.error
    ) {
      updatedPost = await updateSocialPostImageGenerationStatus(id, {
        status: normalizedStatus,
        generatedImageUrl: statusResult.generatedImageUrl,
        errorMessage: statusResult.error,
      });
      revalidatePath("/admin/social-posts");
    }

    return NextResponse.json({
      ok: true,
      post: updatedPost,
      status: normalizedStatus,
      generatedImageUrl: statusResult.generatedImageUrl,
      provider: statusResult.provider,
      model: statusResult.model,
      predictionId: statusResult.predictionId,
      error: statusResult.error,
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
