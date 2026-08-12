import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { SocialAgentInput } from "@/lib/social-posts/social-agent";
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
import {
  DRAFT_COMPLIANCE_PERSISTENCE_POLICY,
  complianceBlocksPersistence,
} from "@/lib/social-posts/agents/generation-gate";
import {
  billableModelProtectionBlock,
  protectionMetadata,
} from "@/lib/social-posts/agents/agent-protection-mode";
import {
  buildOrchestrationWorkflowSummary,
  orchestrationPersistableFields,
  runSocialPostOrchestrator,
} from "@/lib/social-posts/agents/social-post-orchestrator";

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

    const orchestration = await runSocialPostOrchestrator({
      request: strategyInput,
    });

    const compliance =
      orchestration.finalCompliance ?? orchestration.compliance;
    const persistable = orchestrationPersistableFields(
      orchestration,
      assetResolved.asset?.url ?? null,
    );

    if (
      !orchestration.ok ||
      orchestration.outcome === "failed" ||
      orchestration.outcome === "compliance_blocked" ||
      !persistable ||
      !compliance
    ) {
      const blocked =
        compliance && complianceBlocksPersistence(compliance)
          ? true
          : orchestration.outcome === "compliance_blocked";
      const bodyOut = {
        ok: false,
        error:
          orchestration.error ??
          (blocked
            ? "Draft blocked by deterministic compliance validation."
            : "Agent workflow failed."),
        code: blocked ? "compliance_blocked" : "orchestration_failed",
        orchestration,
        strategist: orchestration.strategist,
        creative: orchestration.creative,
        reviewer: orchestration.reviewer,
        agent: orchestration.diagnostics[0] ?? null,
        agents: orchestration.diagnostics,
        compliance,
        draftPolicy: DRAFT_COMPLIANCE_PERSISTENCE_POLICY,
        protection: protectionMetadata(),
        workflow: buildOrchestrationWorkflowSummary(orchestration),
        publication: {
          published: false,
          note: "Nothing was persisted or published.",
        },
      };
      await completeAgentIdempotentActionAsync({
        storeKey: idemStoreKey,
        fingerprint,
        status: blocked ? 422 : 500,
        body: bodyOut,
      });
      return NextResponse.json(bodyOut, { status: blocked ? 422 : 500 });
    }

    const post = await createSocialPost({
      title: persistable.title,
      campaign_id: persistable.campaign_id,
      goal: input.goal ?? persistable.goal,
      prompt: persistable.prompt,
      caption: persistable.caption,
      media_type: persistable.media_type,
      business_focus: persistable.business_focus,
      source_image_url: persistable.source_image_url,
      platforms: persistable.platforms,
      creative_source: persistable.creative_source,
    });

    revalidatePath("/admin/social-posts");
    const quarantined = compliance.decision === "quarantine";
    const responseBody = {
      ok: true,
      post,
      plan: {
        title: persistable.title,
        caption: persistable.caption,
        generationPrompt: persistable.prompt,
        mediaType: persistable.media_type,
        platforms: persistable.platforms,
        businessFocus: persistable.business_focus,
        sourceImageUrl: persistable.source_image_url,
        campaignId: persistable.campaign_id,
      },
      strategist: orchestration.strategist,
      creative: orchestration.creative,
      reviewer: orchestration.reviewer,
      orchestration,
      agent:
        orchestration.diagnostics.find(
          (item) => item.agentId === "creative-director",
        ) ??
        orchestration.diagnostics[0] ??
        null,
      agents: orchestration.diagnostics,
      asset: assetResolved.asset,
      compliance,
      draftPolicy: DRAFT_COMPLIANCE_PERSISTENCE_POLICY,
      generationReady: false,
      generationReadyReason: quarantined
        ? "Quarantined working draft saved. Paid generation stays locked until compliance allow on the exact prompt."
        : "Draft saved after agent workflow. Paid generation still requires a fresh compliance allow on the exact generation prompt.",
      protection: protectionMetadata(),
      workflow: buildOrchestrationWorkflowSummary(orchestration),
      publication: {
        published: false,
        status: post.status,
        note: quarantined
          ? "QUARANTINE: non-approved working draft persisted for owner review. Not compliant, not publishable, not generation-ready."
          : "Owner-ready draft created only. Jacob approval remains required; nothing was published or scheduled.",
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
