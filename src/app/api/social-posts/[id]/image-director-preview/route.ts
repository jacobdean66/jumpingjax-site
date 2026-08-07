import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/session";
import { socialPostAdminSchemaGuardResponse } from "@/lib/social-posts/social-post-admin-schema-guard";
import { socialPostAdminRateLimitResponse } from "@/lib/social-posts/social-post-admin-rate-limit";
import {
  estimateImageDirectorCost,
  getImageDirectorSafetyWarnings,
  getImageQualityWarnings,
  normalizeImageStudioPresetValue,
  buildImageDirectorPrompt,
} from "@/lib/social-posts/image-director";
import { runImageDirectorAgent } from "@/lib/social-posts/agents/image-director-agent";
import { resolveApprovedAssetContext } from "@/lib/social-posts/agents/approved-asset-context";
import { listImageProviderIds } from "@/lib/social-posts/image-provider";
import { getSocialCampaign } from "@/lib/social-posts/social-campaigns";
import {
  getSocialPostById,
  listSocialPosts,
} from "@/lib/social-posts/social-post-data";
import {
  formatVariantDimensionsLabel,
  resolvePostMediaFormat,
} from "@/lib/social-posts/social-media-format-variants";
import {
  beginAgentIdempotentAction,
  completeAgentIdempotentAction,
  failAgentIdempotentAction,
  normalizeIdempotencyKey,
} from "@/lib/social-posts/agents/agent-idempotency";
import { buildSocialPostAdminRateLimitClientKey } from "@/lib/social-posts/social-post-admin-rate-limit-core";
import { AGENT_INPUT_LIMITS, AgentInputValidationError } from "@/lib/social-posts/agents/agent-input-bounds";
import { buildImageDirectorPreviewFingerprint } from "@/lib/social-posts/agents/preview-fingerprint";
import { evaluateEditedPromptCompliance } from "@/lib/social-posts/agents/agent-compliance-gate";
import { previewGenerationReady } from "@/lib/social-posts/agents/generation-gate";
import {
  billableModelProtectionBlock,
  protectionMetadata,
} from "@/lib/social-posts/agents/agent-protection-mode";

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
  idempotencyKey?: string;
};

export async function POST(req: NextRequest, context: RouteContext) {
  const route = "/api/social-posts/[id]/image-director-preview";
  let idemStoreKey: string | null = null;
  let fingerprint = "";

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

    // Image Director preview is a billable model-backed action: fail closed
    // before any lookup, quota use, or provider call when durable
    // protection is unavailable.
    const modelBlock = billableModelProtectionBlock();
    if (modelBlock) {
      return NextResponse.json(modelBlock, { status: 503 });
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

    const preset = normalizeImageStudioPresetValue(
      body.imageStudioPreset ?? body.imageDirectionPreset,
    );
    const resolvedSourceImageUrl = assetResolved.asset?.url ?? null;
    const category = assetResolved.asset?.category ?? null;
    const campaignName =
      getSocialCampaign(post.campaign_id)?.label ??
      (post.campaign_id ? post.campaign_id : null);

    fingerprint = buildImageDirectorPreviewFingerprint({
      postId: id,
      prompt: post.prompt,
      goal: post.goal,
      preset,
      placement: post.post_placement,
      formatVariantId: post.format_variant_id,
      assetId: resolvedSourceImageUrl,
      assetCategory: category,
    });
    const idempotencyKey = normalizeIdempotencyKey(
      body.idempotencyKey ?? req.headers.get("idempotency-key"),
    );
    const clientKey = buildSocialPostAdminRateLimitClientKey(req, body.token);
    const idem = beginAgentIdempotentAction({
      clientKey,
      action: "image-director-preview",
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
          error: "An identical image director preview is already in progress.",
          code: "duplicate_in_progress",
          retryAfterSeconds: idem.retryAfterSeconds,
        },
        {
          status: 409,
          headers: { "Retry-After": String(idem.retryAfterSeconds) },
        },
      );
    }
    idemStoreKey = idem.storeKey;

    const agentResult = await runImageDirectorAgent({
      originalSourceImageUrl: resolvedSourceImageUrl,
      approvedAssetSummary: assetResolved.asset?.metadataSummary ?? null,
      campaignName,
      postPrompt: (post.prompt ?? "").slice(0, AGENT_INPUT_LIMITS.prompt),
      sourceImageCategory: category,
      imageStudioPreset: preset,
      platforms: post.platforms,
      postPlacement: post.post_placement,
      formatVariantId: post.format_variant_id,
      goal: post.goal,
    });

    const direction = agentResult.ok ? agentResult.output : null;
    const finalImagePrompt =
      direction?.finalImageGenerationPrompt ??
      buildImageDirectorPrompt({
        originalSourceImageUrl: resolvedSourceImageUrl,
        campaignName,
        postPrompt: post.prompt ?? "",
        sourceImageCategory: category,
        imageStudioPreset: preset,
        platforms: post.platforms,
        postPlacement: post.post_placement,
        formatVariantId: post.format_variant_id,
      }).prompt;

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
    if (agentResult.diagnostics.source === "model") {
      costEstimate.previewUsd = 0.01;
      costEstimate.totalUsd =
        costEstimate.previewUsd + costEstimate.imageGenerationUsd;
      costEstimate.notes = [
        "Image Director used one model-backed planning call (no image generated).",
        ...costEstimate.notes,
      ];
    } else {
      costEstimate.notes = [
        `Image Director used deterministic fallback: ${agentResult.diagnostics.fallbackReason ?? "unknown"}.`,
        ...costEstimate.notes,
      ];
    }

    let compliance;
    try {
      const posts = await listSocialPosts();
      compliance = evaluateEditedPromptCompliance({
        prompt: finalImagePrompt,
        caption: post.caption,
        title: post.title,
        campaignId: post.campaign_id,
        posts,
      });
    } catch (error) {
      failAgentIdempotentAction(idemStoreKey);
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

    const generationReady = previewGenerationReady(compliance);

    const responseBody = {
      ok: true,
      finalImagePrompt,
      direction,
      warnings,
      qualityWarnings,
      costEstimate,
      preset,
      sourceImageCategory: category,
      asset: assetResolved.asset,
      availableProviders: listImageProviderIds(),
      agent: agentResult.diagnostics,
      compliance,
      fingerprint,
      generationReady: generationReady.generationReady,
      generationReadyReason: generationReady.reason,
      protection: protectionMetadata(),
      workflow: {
        independentReviewerImplemented: false,
        ownerApprovalRequired: true,
        note: "Image Director Agent preview only. No Independent Reviewer agent exists. Owner approval remains required. Quarantine/block are not generation-ready.",
      },
      publication: {
        published: false,
        note: "Image Director preview only. No image was generated or published.",
      },
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
    };

    completeAgentIdempotentAction({
      storeKey: idemStoreKey,
      fingerprint,
      status: 200,
      body: responseBody,
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    if (idemStoreKey) {
      failAgentIdempotentAction(idemStoreKey);
    }
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
          error instanceof Error
            ? error.message
            : "Image director preview failed.",
      },
      { status: 500 },
    );
  }
}
