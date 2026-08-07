import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  getSocialPostById,
  listSocialPosts,
} from "@/lib/social-posts/social-post-data";
import { buildDirectorPreview } from "@/lib/social-posts/director-console";
import {
  createSocialPostAsset,
  findOrCreateSocialPostSourceAsset,
  findSocialPostAssetByPrediction,
  findSocialPostAssetByUrl,
  updateSocialPostAsset,
} from "@/lib/social-posts/social-post-assets";
import {
  normalizeVideoProviderStatus,
  startVideoGeneration,
  SOCIAL_VIDEO_PROVIDER,
} from "@/lib/social-posts/video-engine";
import { verifyAdminAccess } from "@/lib/admin/session";
import { socialPostAdminSchemaGuardResponse } from "@/lib/social-posts/social-post-admin-schema-guard";
import { socialPostAdminRateLimitResponse } from "@/lib/social-posts/social-post-admin-rate-limit";
import { resolveVideoSourceAssetContext } from "@/lib/social-posts/agents/approved-asset-context";
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
import { buildVideoGenerationFingerprint } from "@/lib/social-posts/agents/preview-fingerprint";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type GenerateRequest = {
  token?: string;
  finalPrompt?: string;
  motionPreset?: string | null;
  cameraPreset?: string | null;
  sourceImageUrl?: string | null;
  idempotencyKey?: string;
};

export async function POST(req: NextRequest, context: RouteContext) {
  const route = "/api/social-posts/[id]/generate-media";
  let idemStoreKey: string | null = null;
  let fingerprint = "";

  try {
    const body = (await req.json()) as GenerateRequest;
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

    const limited = await socialPostAdminRateLimitResponse(req, {
      route,
      category: "generation",
      token: body.token,
    });
    if (limited) {
      return limited;
    }

    const motionPreset = body.motionPreset ?? post.motion_preset;
    const cameraPreset = body.cameraPreset ?? post.camera_preset;

    const candidateUrl =
      (typeof body.sourceImageUrl === "string" && body.sourceImageUrl.trim()
        ? body.sourceImageUrl.trim()
        : null) ||
      post.approved_image_url ||
      post.source_image_url ||
      null;

    const assetResolved = resolveVideoSourceAssetContext({
      candidateUrl,
      postApprovedImageUrl: post.approved_image_url,
      postId: id,
    });
    if (!assetResolved.ok) {
      return NextResponse.json(
        { ok: false, error: assetResolved.error, code: "unapproved_asset" },
        { status: 400 },
      );
    }
    if (!assetResolved.url) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "An approved catalog asset or this post's owner-approved generated still is required before paid video generation.",
          code: "approved_asset_required",
        },
        { status: 400 },
      );
    }

    const effectiveSourceImageUrl = assetResolved.url;

    const preview = buildDirectorPreview({
      originalPrompt: prompt.slice(0, AGENT_INPUT_LIMITS.prompt),
      campaignId: post.campaign_id,
      goal: post.goal,
      businessFocus: post.business_focus,
      postSourceImageUrl: effectiveSourceImageUrl,
      approvedImageUrl: effectiveSourceImageUrl,
      motionPreset,
      cameraPreset,
      creativeSource: post.creative_source,
    });

    const editedPrompt = boundOptionalText(
      body.finalPrompt,
      "finalPrompt",
      AGENT_INPUT_LIMITS.prompt,
    );
    const videoPrompt = editedPrompt || preview.finalVideoPrompt;

    let compliance;
    try {
      const posts = await listSocialPosts();
      compliance = evaluateEditedPromptCompliance({
        prompt: videoPrompt,
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

    if (!complianceAllowsPaidGeneration(compliance)) {
      return NextResponse.json(paidGenerationDeniedResponse(compliance), {
        status: 422,
      });
    }

    fingerprint = buildVideoGenerationFingerprint({
      postId: id,
      prompt: videoPrompt,
      motionPreset: motionPreset ?? null,
      cameraPreset: cameraPreset ?? null,
      assetId: assetResolved.assetId,
    });
    const idempotencyKey = normalizeIdempotencyKey(
      body.idempotencyKey ?? req.headers.get("idempotency-key"),
    );
    const clientKey = buildSocialPostAdminRateLimitClientKey(req, body.token);
    const idem = await beginAgentIdempotentActionAsync({
      clientKey,
      action: "generate-media",
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
          error: "An identical video generation request is already in progress.",
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

    const started = await startVideoGeneration({
      prompt: videoPrompt,
      sourceImageUrl: effectiveSourceImageUrl,
    });

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

    const normalizedStatus = normalizeVideoProviderStatus(started.status);
    const existingAsset = await findSocialPostAssetByPrediction({
      socialPostId: id,
      predictionId: started.jobId,
      assetType: "video",
    });

    const videoAsset = existingAsset
      ? await updateSocialPostAsset({
          socialPostId: id,
          assetId: existingAsset.id,
          generationStatus: normalizedStatus,
          generationPrompt: videoPrompt,
        })
      : await createSocialPostAsset({
          socialPostId: id,
          parentAssetId: parentAsset.id,
          assetType: "video",
          assetStage: "generated",
          provider: started.provider,
          generationEngine: SOCIAL_VIDEO_PROVIDER,
          predictionId: started.jobId,
          generationStatus: normalizedStatus,
          generationPrompt: videoPrompt,
          createdBy: "video_director",
          metadata: {
            motion_preset: preview.generationSettings.motionPreset,
            camera_preset: preview.generationSettings.cameraPreset,
            source_image_url: started.sourceImageUrl,
            source_kind: assetResolved.kind,
          },
        });

    revalidatePath("/admin/social-posts");

    const responseBody = {
      ok: true,
      predictionId: started.jobId,
      assetId: videoAsset.id,
      status: normalizedStatus,
      sourceKind: assetResolved.kind,
      compliance,
      protection: protectionMetadata(),
      publication: {
        published: false,
        note: "Video generation started only after compliance allow. Nothing was published.",
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
          error instanceof Error ? error.message : "Social post media generation failed.",
      },
      { status: 500 },
    );
  }
}
