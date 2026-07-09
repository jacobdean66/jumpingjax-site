import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/session";
import { socialPostAdminSchemaGuardResponse } from "@/lib/social-posts/social-post-admin-schema-guard";
import { socialPostAdminRateLimitResponse } from "@/lib/social-posts/social-post-admin-rate-limit";
import {
  buildImageDirectorPrompt,
  estimateImageDirectorCost,
  getImageDirectorSafetyWarnings,
  getImageQualityWarnings,
  normalizeImageStudioPresetValue,
} from "@/lib/social-posts/image-director";
import { listImageProviderIds } from "@/lib/social-posts/image-provider";
import { getSocialCampaign } from "@/lib/social-posts/social-campaigns";
import { getSocialPostById } from "@/lib/social-posts/social-post-data";
import {
  formatVariantDimensionsLabel,
  resolvePostMediaFormat,
} from "@/lib/social-posts/social-media-format-variants";
import { socialVideoSourceImageUrl } from "@/lib/social-posts/social-video-utils";
import { sourceImageCategory } from "@/lib/social-posts/video-director";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ImageDirectorPreviewRequest = {
  token?: string;
  imageStudioPreset?: string | null;
  imageDirectionPreset?: string | null;
  sourceImageUrl?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  providerId?: string | null;
};

export async function POST(req: NextRequest, context: RouteContext) {
  const route = "/api/social-posts/[id]/image-director-preview";

  try {
    const body = (await req.json()) as ImageDirectorPreviewRequest;
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

    const limited = socialPostAdminRateLimitResponse(req, {
      route,
      category: "preview",
      token: body.token,
    });
    if (limited) {
      return limited;
    }

    const { id } = await context.params;
    const post = await getSocialPostById(id);

    if (!post) {
      return NextResponse.json(
        { ok: false, error: "Social post not found" },
        { status: 404 },
      );
    }

    const preset = normalizeImageStudioPresetValue(
      body.imageStudioPreset ?? body.imageDirectionPreset,
    );
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
      imageStudioPreset: preset,
      platforms: post.platforms,
      postPlacement: post.post_placement,
      formatVariantId: post.format_variant_id,
    });
    const mediaFormat = resolvePostMediaFormat({
      platforms: post.platforms,
      placement: post.post_placement,
      formatVariantId: post.format_variant_id,
    });

    const warnings = getImageDirectorSafetyWarnings({
      prompt: finalImagePrompt,
      sourceImageCategory: category,
      originalSourceImageUrl: resolvedSourceImageUrl,
      imageStudioPreset: preset,
    });
    const qualityWarnings = getImageQualityWarnings({
      prompt: finalImagePrompt,
      sourceImageCategory: category,
      imageStudioPreset: preset,
      imageWidth: body.imageWidth,
      imageHeight: body.imageHeight,
      platforms: post.platforms,
      postPlacement: post.post_placement,
      formatVariantId: post.format_variant_id,
    });
    const costEstimate = estimateImageDirectorCost(4, body.providerId ?? undefined);

    return NextResponse.json({
      ok: true,
      finalImagePrompt,
      warnings,
      qualityWarnings,
      costEstimate,
      preset,
      sourceImageCategory: category,
      availableProviders: listImageProviderIds(),
      mediaFormat: {
        placement: mediaFormat.placement,
        variantId: mediaFormat.variantId,
        variantLabel: mediaFormat.variant.label,
        aspectRatio: mediaFormat.aspectRatio,
        recommendedDimensions: formatVariantDimensionsLabel(mediaFormat.variant),
        replicateAspectRatio: mediaFormat.replicateAspectRatio,
        compositionGuidance: mediaFormat.compositionGuidance,
        variantOptions: mediaFormat.variantOptions.map((variant) => ({
          id: variant.id,
          label: variant.label,
          dimensions: formatVariantDimensionsLabel(variant),
          compositionGuidance: variant.compositionGuidance,
        })),
      },
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
