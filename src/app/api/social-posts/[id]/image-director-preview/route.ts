import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/session";
import {
  buildImageDirectorPrompt,
  estimateImageDirectorCost,
  getImageDirectorSafetyWarnings,
  normalizeImageDirectionPresetValue,
} from "@/lib/social-posts/image-director";
import { getSocialCampaign } from "@/lib/social-posts/social-campaigns";
import { getSocialPostById } from "@/lib/social-posts/social-post-data";
import { socialVideoSourceImageUrl } from "@/lib/social-posts/social-video-utils";
import { sourceImageCategory } from "@/lib/social-posts/video-director";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ImageDirectorPreviewRequest = {
  token?: string;
  imageDirectionPreset?: string | null;
  sourceImageUrl?: string | null;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const body = (await req.json()) as ImageDirectorPreviewRequest;
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

    const preset = normalizeImageDirectionPresetValue(body.imageDirectionPreset);
    const resolvedSourceImageUrl = socialVideoSourceImageUrl(
      typeof body.sourceImageUrl === "string" && body.sourceImageUrl.trim()
        ? body.sourceImageUrl.trim()
        : post.source_image_url,
    );
    const category = sourceImageCategory(resolvedSourceImageUrl);
    const campaignName =
      getSocialCampaign(post.campaign_id)?.label ??
      (post.campaign_id ? post.campaign_id : null);

    const { prompt: finalImagePrompt } = buildImageDirectorPrompt({
      originalSourceImageUrl: resolvedSourceImageUrl,
      campaignName,
      postPrompt: post.prompt ?? "",
      sourceImageCategory: category,
      imageDirectionPreset: preset,
    });

    const warnings = getImageDirectorSafetyWarnings({
      prompt: finalImagePrompt,
      sourceImageCategory: category,
      originalSourceImageUrl: resolvedSourceImageUrl,
      imageDirectionPreset: preset,
    });
    const costEstimate = estimateImageDirectorCost();

    return NextResponse.json({
      ok: true,
      finalImagePrompt,
      warnings,
      costEstimate,
      preset,
      sourceImageCategory: category,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Image director preview failed.",
      },
      { status: 500 },
    );
  }
}
