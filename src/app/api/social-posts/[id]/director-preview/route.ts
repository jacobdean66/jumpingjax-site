import { NextRequest, NextResponse } from "next/server";
import { buildDirectorPreviewWithAgent } from "@/lib/social-posts/director-console";
import {
  getSocialPostById,
  listSocialPosts,
} from "@/lib/social-posts/social-post-data";
import { verifyAdminAccess } from "@/lib/admin/session";
import { socialPostAdminSchemaGuardResponse } from "@/lib/social-posts/social-post-admin-schema-guard";
import { socialPostAdminRateLimitResponse } from "@/lib/social-posts/social-post-admin-rate-limit";
import { durableAgentStoreErrorResponse } from "@/lib/social-posts/agents/agent-durable-store";
import {
  beginAgentIdempotentActionAsync,
  completeAgentIdempotentActionAsync,
  failAgentIdempotentActionAsync,
  normalizeIdempotencyKey,
} from "@/lib/social-posts/agents/agent-idempotency";
import { buildSocialPostAdminRateLimitClientKey } from "@/lib/social-posts/social-post-admin-rate-limit-core";
import {
  AGENT_INPUT_LIMITS,
  AgentInputValidationError,
} from "@/lib/social-posts/agents/agent-input-bounds";
import { buildVideoDirectorPreviewFingerprint } from "@/lib/social-posts/agents/preview-fingerprint";
import { evaluateEditedPromptCompliance } from "@/lib/social-posts/agents/agent-compliance-gate";
import { previewGenerationReady } from "@/lib/social-posts/agents/generation-gate";
import {
  billableModelProtectionBlock,
  protectionMetadata,
} from "@/lib/social-posts/agents/agent-protection-mode";
import { resolveVideoSourceAssetContext } from "@/lib/social-posts/agents/approved-asset-context";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type PreviewRequest = {
  token?: string;
  motionPreset?: string | null;
  cameraPreset?: string | null;
  sourceImageUrl?: string | null;
  idempotencyKey?: string;
};

export async function POST(req: NextRequest, context: RouteContext) {
  const route = "/api/social-posts/[id]/director-preview";
  let idemStoreKey: string | null = null;
  let fingerprint = "";

  try {
    const body = (await req.json()) as PreviewRequest;
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

    // Video Director preview is a billable model-backed action: fail closed
    // before any lookup, quota use, or provider call when durable
    // protection is unavailable.
    const modelBlock = await billableModelProtectionBlock();
    if (modelBlock) {
      return NextResponse.json(modelBlock, { status: 503 });
    }

    const limited = await socialPostAdminRateLimitResponse(req, {
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

    const prompt = post.prompt?.trim();
    if (!prompt) {
      return NextResponse.json(
        { ok: false, error: "Social post prompt is required for director preview." },
        { status: 400 },
      );
    }
    if (prompt.length > AGENT_INPUT_LIMITS.prompt) {
      return NextResponse.json(
        {
          ok: false,
          error: `prompt exceeds the ${AGENT_INPUT_LIMITS.prompt}-character limit.`,
        },
        { status: 400 },
      );
    }

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

    const motionPreset = body.motionPreset ?? post.motion_preset ?? null;
    const cameraPreset = body.cameraPreset ?? post.camera_preset ?? null;

    fingerprint = buildVideoDirectorPreviewFingerprint({
      postId: id,
      prompt,
      goal: post.goal,
      motionPreset,
      cameraPreset,
      placement: post.post_placement,
      formatVariantId: post.format_variant_id,
      assetId: assetResolved.assetId,
      assetCategory: assetResolved.category,
    });
    const idempotencyKey = normalizeIdempotencyKey(
      body.idempotencyKey ?? req.headers.get("idempotency-key"),
    );
    const clientKey = buildSocialPostAdminRateLimitClientKey(req, body.token);
    const idem = await beginAgentIdempotentActionAsync({
      clientKey,
      action: "director-preview",
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
          error: "An identical video director preview is already in progress.",
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

    const preview = await buildDirectorPreviewWithAgent({
      originalPrompt: prompt,
      campaignId: post.campaign_id,
      goal: post.goal,
      businessFocus: post.business_focus,
      postSourceImageUrl: assetResolved.url,
      approvedImageUrl: post.approved_image_url,
      verifiedSourceImageUrl: assetResolved.url,
      postId: id,
      motionPreset,
      cameraPreset,
      creativeSource: post.creative_source,
      platforms: post.platforms,
      postPlacement: post.post_placement,
    });

    let compliance;
    try {
      const posts = await listSocialPosts();
      compliance = evaluateEditedPromptCompliance({
        prompt: preview.finalVideoPrompt,
        caption: post.caption,
        title: post.title,
        campaignId: post.campaign_id,
        posts,
      });
    } catch (error) {
      await failAgentIdempotentActionAsync(idemStoreKey);
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
      preview,
      asset: {
        url: assetResolved.url,
        kind: assetResolved.kind,
        label: assetResolved.label,
        category: assetResolved.category,
        metadataSummary: assetResolved.metadataSummary,
      },
      agent: preview.agentDiagnostics ?? null,
      compliance,
      fingerprint,
      generationReady: generationReady.generationReady,
      generationReadyReason: generationReady.reason,
      protection: protectionMetadata(),
      workflow: {
        independentReviewerImplemented: false,
        ownerApprovalRequired: true,
        note: "Video Director Agent preview only. No Independent Reviewer agent exists. Owner approval remains required. Quarantine/block are not generation-ready.",
      },
      publication: {
        published: false,
        note: "Video Director preview only. No video was generated or published.",
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
    const message =
      error instanceof Error ? error.message : "Director preview failed.";
    const status = /approved Jumping Jax catalog asset/i.test(message)
      ? 400
      : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
