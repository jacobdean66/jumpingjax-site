import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  createSocialAgentPlanWithMeta,
  type SocialAgentInput,
} from "@/lib/social-posts/social-agent";
import { createSocialPost } from "@/lib/social-posts/social-post-data";
import { verifyAdminAccess } from "@/lib/admin/session";
import { socialPostAdminSchemaGuardResponse } from "@/lib/social-posts/social-post-admin-schema-guard";
import { socialPostAdminRateLimitResponse } from "@/lib/social-posts/social-post-admin-rate-limit";
import { buildSocialPostAdminRateLimitClientKey } from "@/lib/social-posts/social-post-admin-rate-limit-core";
import { resolveApprovedAssetContext } from "@/lib/social-posts/agents/approved-asset-context";
import {
  AGENT_INPUT_LIMITS,
  AgentInputValidationError,
  boundNullableText,
  boundOptionalText,
} from "@/lib/social-posts/agents/agent-input-bounds";
import { durableAgentStoreErrorResponse } from "@/lib/social-posts/agents/agent-durable-store";
import {
  beginAgentIdempotentActionAsync,
  buildAgentActionFingerprint,
  completeAgentIdempotentActionAsync,
  failAgentIdempotentActionAsync,
  normalizeIdempotencyKey,
} from "@/lib/social-posts/agents/agent-idempotency";
import { evaluateAgentComplianceGateWithPosts } from "@/lib/social-posts/agents/agent-compliance-gate";
import {
  DRAFT_COMPLIANCE_PERSISTENCE_POLICY,
  complianceBlocksPersistence,
} from "@/lib/social-posts/agents/generation-gate";
import {
  billableModelProtectionBlock,
  protectionMetadata,
} from "@/lib/social-posts/agents/agent-protection-mode";

const VALID_PLATFORMS = ["facebook", "instagram", "both"] as const;
const VALID_MEDIA_TYPES = ["image", "video"] as const;
const VALID_BUSINESS_FOCUS = ["rentals", "facility-parties", "both"] as const;

type AgentDraftRequest = SocialAgentInput & {
  token?: string;
  campaign_id?: string;
  source_image_url?: string;
  audience?: string;
  tone?: string;
  callToAction?: string;
  seasonalContext?: string | null;
  assetContext?: string | null;
  idempotencyKey?: string;
};

function isValidOptionalValue<T extends readonly string[]>(
  value: unknown,
  validValues: T,
): value is T[number] | undefined {
  return value === undefined || validValues.includes(value as T[number]);
}

function validateInput(body: AgentDraftRequest): SocialAgentInput {
  if (!isValidOptionalValue(body.platform, VALID_PLATFORMS)) {
    throw new AgentInputValidationError(
      "platform must be facebook, instagram, or both.",
    );
  }
  if (!isValidOptionalValue(body.mediaType, VALID_MEDIA_TYPES)) {
    throw new AgentInputValidationError("mediaType must be image or video.");
  }
  if (!isValidOptionalValue(body.businessFocus, VALID_BUSINESS_FOCUS)) {
    throw new AgentInputValidationError(
      "businessFocus must be rentals, facility-parties, or both.",
    );
  }

  return {
    goal: boundOptionalText(body.goal, "goal", AGENT_INPUT_LIMITS.goal),
    campaignId: boundOptionalText(
      body.campaignId ?? body.campaign_id,
      "campaignId",
      80,
    ),
    platform: body.platform,
    mediaType: body.mediaType,
    businessFocus: body.businessFocus,
    audience: boundOptionalText(
      body.audience,
      "audience",
      AGENT_INPUT_LIMITS.audience,
    ),
    tone: boundOptionalText(body.tone, "tone", AGENT_INPUT_LIMITS.tone),
    callToAction: boundOptionalText(
      body.callToAction,
      "callToAction",
      AGENT_INPUT_LIMITS.callToAction,
    ),
    seasonalContext: boundNullableText(
      body.seasonalContext,
      "seasonalContext",
      AGENT_INPUT_LIMITS.seasonalContext,
    ),
    // Caller-supplied free-text assetContext is ignored; verified catalog asset wins.
    assetContext: null,
  };
}

export async function POST(req: Request) {
  let idemStoreKey: string | null = null;
  let fingerprint = "";

  try {
    const body = (await req.json()) as AgentDraftRequest;
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

    // Agent drafting is a billable model-backed action: fail closed before
    // any quota use or provider call when durable protection is unavailable.
    const modelBlock = await billableModelProtectionBlock();
    if (modelBlock) {
      return NextResponse.json(modelBlock, { status: 503 });
    }

    const limited = await socialPostAdminRateLimitResponse(req, {
      route: "/api/social-posts/agent-draft",
      category: "draft",
      token: body.token,
    });
    if (limited) {
      return limited;
    }

    const input = validateInput(body);
    const idempotencyKey = normalizeIdempotencyKey(
      body.idempotencyKey ?? req.headers.get("idempotency-key"),
    );

    const assetResolved = resolveApprovedAssetContext(body.source_image_url);
    if (!assetResolved.ok) {
      return NextResponse.json(
        { ok: false, error: assetResolved.error },
        { status: 400 },
      );
    }

    const verifiedAssetContext = assetResolved.asset?.metadataSummary ?? null;
    const strategyInput: SocialAgentInput = {
      ...input,
      assetContext: verifiedAssetContext,
    };

    fingerprint = buildAgentActionFingerprint({
      action: "agent-draft",
      goal: strategyInput.goal ?? null,
      campaignId: strategyInput.campaignId ?? null,
      platform: strategyInput.platform ?? "both",
      mediaType: strategyInput.mediaType ?? null,
      businessFocus: strategyInput.businessFocus ?? "both",
      audience: strategyInput.audience ?? null,
      tone: strategyInput.tone ?? null,
      callToAction: strategyInput.callToAction ?? null,
      seasonalContext: strategyInput.seasonalContext ?? null,
      assetUrl: assetResolved.asset?.url ?? null,
    });

    const clientKey = buildSocialPostAdminRateLimitClientKey(req, body.token);
    const idem = await beginAgentIdempotentActionAsync({
      clientKey,
      action: "agent-draft",
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
          error: "An identical draft request is already in progress.",
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

    const { plan, strategy, diagnostics } =
      await createSocialAgentPlanWithMeta(strategyInput);

    // Prefer verified catalog asset over model-chosen URL.
    const sourceImageUrl = assetResolved.asset?.url ?? plan.sourceImageUrl;
    const creativeSource =
      diagnostics.source === "model" ? "openai" : "rule-fallback";

    let compliance;
    try {
      compliance = await evaluateAgentComplianceGateWithPosts({
        title: plan.title,
        caption: plan.caption,
        generationPrompt: plan.generationPrompt,
        campaignId: plan.campaignId,
        platforms: plan.platforms,
        mediaType: plan.mediaType,
        candidateId: "explicit:agent-draft-live-candidate",
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

    // Policy: blocked drafts must not persist via agent-draft.
    if (complianceBlocksPersistence(compliance)) {
      const bodyOut = {
        ok: false,
        error: "Draft blocked by deterministic compliance validation.",
        code: "compliance_blocked",
        plan,
        strategy,
        agent: diagnostics,
        compliance,
        draftPolicy: DRAFT_COMPLIANCE_PERSISTENCE_POLICY,
        protection: protectionMetadata(),
        publication: {
          published: false,
          note: "Nothing was persisted or published.",
        },
      };
      await completeAgentIdempotentActionAsync({
        storeKey: idemStoreKey,
        fingerprint,
        status: 422,
        body: bodyOut,
      });
      return NextResponse.json(bodyOut, { status: 422 });
    }

    // Quarantine may persist only as a labeled non-approved working draft.
    // It is not compliant, not generation-ready, and does not unlock paid media.
    const post = await createSocialPost({
      title: plan.title,
      campaign_id: plan.campaignId,
      goal: input.goal,
      prompt: plan.generationPrompt,
      caption: plan.caption,
      media_type: plan.mediaType,
      business_focus: plan.businessFocus,
      source_image_url: sourceImageUrl,
      platforms: plan.platforms,
      creative_source: creativeSource,
    });

    revalidatePath("/admin/social-posts");
    const quarantined = compliance.decision === "quarantine";
    const responseBody = {
      ok: true,
      post,
      plan,
      strategy,
      agent: diagnostics,
      asset: assetResolved.asset,
      compliance,
      draftPolicy: DRAFT_COMPLIANCE_PERSISTENCE_POLICY,
      generationReady: false,
      generationReadyReason: quarantined
        ? "Quarantined working draft saved. Paid generation stays locked until compliance allow on the exact prompt."
        : "Draft saved. Paid generation still requires a fresh compliance allow on the exact generation prompt.",
      protection: protectionMetadata(),
      workflow: {
        independentReviewerImplemented: false,
        ownerApprovalRequired: true,
        note: "Social Strategy / Copy Agent draft only. Owner approval remains mandatory. No Independent Reviewer agent exists yet.",
      },
      publication: {
        published: false,
        status: post.status,
        note: quarantined
          ? "QUARANTINE: non-approved working draft persisted for owner review. Not compliant, not publishable, not generation-ready."
          : "Draft created only. Save/Approve/Schedule/Posted restrictions are unchanged; nothing was published.",
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

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body." },
        { status: 400 },
      );
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
        error: error instanceof Error ? error.message : "Agent draft failed.",
      },
      { status: 500 },
    );
  }
}
