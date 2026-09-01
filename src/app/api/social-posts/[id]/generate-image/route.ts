import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/session";
import { socialPostAdminSchemaGuardResponse } from "@/lib/social-posts/social-post-admin-schema-guard";
import { socialPostAdminRateLimitResponse } from "@/lib/social-posts/social-post-admin-rate-limit";
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
  listSocialPosts,
  startSocialPostImageGeneration,
} from "@/lib/social-posts/social-post-data";
import { resolveApprovedAssetContext } from "@/lib/social-posts/agents/approved-asset-context";
import { evaluateEditedPromptCompliance } from "@/lib/social-posts/agents/agent-compliance-gate";
import {
  AGENT_INPUT_LIMITS,
  AgentInputValidationError,
  boundOptionalText,
} from "@/lib/social-posts/agents/agent-input-bounds";
import { durableAgentStoreErrorResponse } from "@/lib/social-posts/agents/agent-durable-store";
import {
  beginAgentIdempotentActionAsync,
  completeAgentIdempotentActionAsync,
  failAgentIdempotentActionAsync,
  normalizeIdempotencyKey,
} from "@/lib/social-posts/agents/agent-idempotency";
import { buildSocialPostAdminRateLimitClientKey } from "@/lib/social-posts/social-post-admin-rate-limit-core";
import {
  complianceAllowsPaidGeneration,
  paidGenerationDeniedResponse,
} from "@/lib/social-posts/agents/generation-gate";
import {
  paidGenerationProtectionBlock,
  protectionMetadata,
} from "@/lib/social-posts/agents/agent-protection-mode";
import { buildImageGenerationFingerprint } from "@/lib/social-posts/agents/preview-fingerprint";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type GenerateImageRequest = {
  token?: string;
  finalImagePrompt?: string;
  imageDirectionPreset?: string | null;
  sourceImageUrl?: string | null;
  mode?: "edit" | "generate" | null;
  idempotencyKey?: string;
};

function normalizeProviderStatus(status: string): string {
  if (status === "starting" || status === "processing") return "processing";
  if (status === "succeeded") return "succeeded";
  if (status === "failed" || status === "canceled") return "failed";
  return "processing";
}

export async function POST(req: NextRequest, context: RouteContext) {
  const route = "/api/social-posts/[id]/generate-image";
  let idemStoreKey: string | null = null;
  let fingerprint = "";

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

    const protectionBlock = await paidGenerationProtectionBlock();
    if (protectionBlock) {
      return NextResponse.json(protectionBlock, { status: 503 });
    }

    const { id } = await context.params;
    const post = await getSocialPostById(id);

    if (!post) {
      return NextResponse.json(
        { ok: false, error: "Social post not found" },
        { status: 404 },
      );
    }

    const limited = await socialPostAdminRateLimitResponse(req, {
      route,
      category: "generation",
      token: body.token,
    });
    if (limited) {
      return limited;
    }

    const preset = normalizeImageStudioPresetValue(body.imageDirectionPreset);
    const candidateUrl =
      (typeof body.sourceImageUrl === "string" && body.sourceImageUrl.trim()
        ? body.sourceImageUrl.trim()
        : null) ||
      post.source_image_url ||
      null;
    const assetResolved = resolveApprovedAssetContext(candidateUrl);
    if (!assetResolved.ok) {
      return NextResponse.json(
        { ok: false, error: assetResolved.error, code: "unapproved_asset" },
        { status: 400 },
      );
    }

    const resolvedSourceImageUrl = assetResolved.asset?.url ?? null;
    const category = assetResolved.asset?.category ?? null;
    const campaignName =
      getSocialCampaign(post.campaign_id)?.label ??
      (post.campaign_id ? post.campaign_id : null);

    const { prompt: builtPrompt } = buildImageDirectorPrompt({
      originalSourceImageUrl: resolvedSourceImageUrl,
      campaignName,
      postPrompt: (post.prompt ?? "").slice(0, AGENT_INPUT_LIMITS.prompt),
      sourceImageCategory: category,
      imageStudioPreset: preset,
      platforms: post.platforms,
      postPlacement: post.post_placement,
      formatVariantId: post.format_variant_id,
    });

    const editedPrompt = boundOptionalText(
      body.finalImagePrompt,
      "finalImagePrompt",
      AGENT_INPUT_LIMITS.prompt,
    );
    const generationPrompt = editedPrompt || builtPrompt;

    let compliance;
    try {
      const posts = await listSocialPosts();
      compliance = evaluateEditedPromptCompliance({
        prompt: generationPrompt,
        caption: post.caption,
        title: post.title,
        campaignId: post.campaign_id,
        posts,
      });
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Authoritative compliance specifications could not be loaded.",
          code: "compliance_specs_unavailable",
        },
        { status: 503 },
      );
    }

    // Models cannot override: quarantine and block both deny paid generation.
    if (!complianceAllowsPaidGeneration(compliance)) {
      return NextResponse.json(paidGenerationDeniedResponse(compliance), {
        status: 422,
      });
    }

    const mediaFormat = resolvePostMediaFormat({
      platforms: post.platforms,
      placement: post.post_placement,
      formatVariantId: post.format_variant_id,
    });
    const mode = resolveImageGenerationMode({
      mode: body.mode,
      sourceImageUrl: resolvedSourceImageUrl,
    });

    fingerprint = buildImageGenerationFingerprint({
      postId: id,
      prompt: generationPrompt,
      preset,
      mode,
      assetId: assetResolved.asset?.url ?? null,
      aspectRatio: mediaFormat.aspectRatio,
    });
    const idempotencyKey = normalizeIdempotencyKey(
      body.idempotencyKey ?? req.headers.get("idempotency-key"),
    );
    const clientKey = buildSocialPostAdminRateLimitClientKey(req, body.token);
    const idem = await beginAgentIdempotentActionAsync({
      clientKey,
      action: "generate-image",
      idempotencyKey,
      fingerprint,
    });
    if (idem.kind === "replay") {
      return NextResponse.json(idem.body, { status: idem.status });
    }
    if (idem.kind === "in_progress") {
      return NextResponse.json(
        {
          ok: false,
          error: "An identical image generation request is already in progress.",
          code: "duplicate_in_progress",
          retryAfterSeconds: idem.retryAfterSeconds,
          protection: protectionMetadata(),
        },
        {
          status: 409,
          headers: { "Retry-After": String(idem.retryAfterSeconds) },
        },
      );
    }
    idemStoreKey = idem.storeKey;

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

    const responseBody = {
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
      asset: assetResolved.asset,
      compliance,
      protection: protectionMetadata(),
      publication: {
        published: false,
        note: "Image generation started only after compliance allow. Nothing was published.",
      },
    };

    await completeAgentIdempotentActionAsync({
      storeKey: idemStoreKey,
      fingerprint,
      status: 200,
      body: responseBody,
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    if (idemStoreKey) {
      await failAgentIdempotentActionAsync(idemStoreKey);
    }
    const storeUnavailable = durableAgentStoreErrorResponse(error);
    if (storeUnavailable) return storeUnavailable;
    if (error instanceof AgentInputValidationError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 },
      );
    }
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
