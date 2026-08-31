import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  beginSocialAgentStage,
  finishSocialAgentStage,
  type SocialAgentStage,
} from "@/lib/agent-manager/social-run";
import { verifyAdminAccess } from "@/lib/admin/session";
import { createSocialPost } from "@/lib/social-posts/social-post-data";
import { chooseSourceImageUrl, type SocialAgentInput } from "@/lib/social-posts/social-agent";
import { resolveApprovedAssetContext } from "@/lib/social-posts/agents/approved-asset-context";
import {
  evaluateAgentComplianceGateWithPosts,
  type ComplianceGateResult,
} from "@/lib/social-posts/agents/agent-compliance-gate";
import {
  AGENT_INPUT_LIMITS,
  AgentInputValidationError,
  boundNullableText,
  boundOptionalText,
} from "@/lib/social-posts/agents/agent-input-bounds";
import { runCampaignStrategistAgent } from "@/lib/social-posts/agents/campaign-strategist-agent";
import {
  runCreativeDirectorAgent,
  validateCreativeDirectorOutputDetailed,
} from "@/lib/social-posts/agents/creative-director-agent";
import { durableAgentStoreErrorResponse } from "@/lib/social-posts/agents/agent-durable-store";
import {
  billableModelProtectionBlock,
  protectionMetadata,
} from "@/lib/social-posts/agents/agent-protection-mode";
import { runIndependentReviewerAgent } from "@/lib/social-posts/agents/independent-reviewer-agent";
import {
  SOCIAL_DRAFT_CHECKPOINT_VERSION,
  type SocialDraftCheckpoint,
  type SocialDraftNextStage,
} from "@/lib/social-posts/agents/staged-workflow-types";
import {
  signSocialDraftCheckpoint,
  verifySocialDraftCheckpointSignature,
} from "@/lib/social-posts/agents/staged-workflow-integrity";
import type {
  CreativeDirectorOutput,
  IndependentReviewerOutput,
  OrchestrationStageRecord,
} from "@/lib/social-posts/agents/orchestration-types";
import {
  applyVisualRealismConstraints,
  evaluateVisualRealismGate,
} from "@/lib/social-posts/agents/visual-realism-gate";
import { evaluateCreativeQualityGate } from "@/lib/social-posts/agents/creative-quality-gate";
import { socialPostAdminRateLimitResponse } from "@/lib/social-posts/social-post-admin-rate-limit";
import { socialPostAdminSchemaGuardResponse } from "@/lib/social-posts/social-post-admin-schema-guard";
import {
  resolveSocialThemeLibraryContext,
  socialThemePreferredSourceUrl,
} from "@/lib/social-posts/social-theme-library";

type StageAction = "start" | "continue" | "stop";

type StageRequest = {
  token?: string;
  action?: StageAction;
  checkpoint?: SocialDraftCheckpoint;
  checkpointSignature?: string;
  campaignId?: string;
  goal?: string;
  platform?: "facebook" | "instagram" | "both";
  mediaType?: "image" | "video";
  businessFocus?: "rentals" | "facility-parties" | "both";
  source_image_url?: string;
  theme?: string;
};

const VALID_NEXT_STAGES = new Set<SocialDraftNextStage>([
  "creative_director",
  "independent_reviewer",
  "compliance",
  "revision",
  "final_compliance",
  "persist",
  "blocked",
  "complete",
]);

function stageRecord(
  stageId: OrchestrationStageRecord["stageId"],
  status: OrchestrationStageRecord["status"],
  summary: string,
): OrchestrationStageRecord {
  return { stageId, status, summary };
}

function validateStartInput(body: StageRequest): SocialAgentInput {
  const platform = body.platform ?? "both";
  const mediaType = body.mediaType ?? "image";
  const businessFocus = body.businessFocus ?? "both";
  if (!["facebook", "instagram", "both"].includes(platform)) {
    throw new AgentInputValidationError("platform is invalid.");
  }
  if (!["image", "video"].includes(mediaType)) {
    throw new AgentInputValidationError("mediaType is invalid.");
  }
  if (!["rentals", "facility-parties", "both"].includes(businessFocus)) {
    throw new AgentInputValidationError("businessFocus is invalid.");
  }
  return {
    goal: boundOptionalText(body.goal, "goal", AGENT_INPUT_LIMITS.goal),
    campaignId: boundOptionalText(body.campaignId, "campaignId", 80),
    platform,
    mediaType,
    businessFocus,
    assetContext: null,
    theme: boundNullableText(body.theme, "theme", 160),
  };
}

function validateCheckpoint(value: unknown): SocialDraftCheckpoint {
  if (!value || typeof value !== "object") {
    throw new AgentInputValidationError("A workflow checkpoint is required.");
  }
  const checkpoint = value as SocialDraftCheckpoint;
  if (
    checkpoint.version !== SOCIAL_DRAFT_CHECKPOINT_VERSION ||
    typeof checkpoint.runId !== "string" ||
    !checkpoint.runId ||
    !VALID_NEXT_STAGES.has(checkpoint.nextStage) ||
    !Array.isArray(checkpoint.stages) ||
    !Array.isArray(checkpoint.diagnostics) ||
    typeof checkpoint.modelCallsUsed !== "number" ||
    checkpoint.modelCallsUsed < 0 ||
    checkpoint.modelCallsUsed > 4
  ) {
    throw new AgentInputValidationError("Workflow checkpoint is invalid.");
  }
  return checkpoint;
}

function creativeCandidate(creative: CreativeDirectorOutput) {
  return {
    title: creative.title,
    caption: creative.caption,
    generationPrompt: creative.generationPrompt,
    campaignId: creative.campaignId,
    platforms: creative.platforms,
    mediaType: creative.mediaType,
    imageAltText:
      creative.mediaType === "image"
        ? `${creative.title}. ${creative.visualDirection}`.slice(0, 500)
        : null,
    claimsImageOnly: false,
    candidateId: "explicit:staged-social-workflow",
  };
}

function withCheckpoint(
  checkpoint: SocialDraftCheckpoint,
  patch: Partial<SocialDraftCheckpoint>,
): SocialDraftCheckpoint {
  return { ...checkpoint, ...patch };
}

function shouldRevise(
  reviewer: IndependentReviewerOutput,
  compliance: ComplianceGateResult,
): boolean {
  return reviewer.verdict === "revise" || compliance.decision === "quarantine";
}

async function runManagedStage<T>(input: {
  runId: string;
  stage: SocialAgentStage;
  actorId: string;
  payload?: Record<string, unknown>;
  execute: (recordModelCall: () => void) => Promise<T>;
  summarize: (value: T) => string;
}): Promise<{ value: T; modelCalls: number }> {
  const job = await beginSocialAgentStage({
    runId: input.runId,
    stage: input.stage,
    actorId: input.actorId,
    payload: input.payload,
  });
  if (job.status === "succeeded") {
    throw new Error(`Social Agent ${input.stage} already completed for this run.`);
  }
  let modelCalls = 0;
  try {
    const value = await input.execute(() => {
      modelCalls += 1;
    });
    await finishSocialAgentStage({
      job,
      runId: input.runId,
      stage: input.stage,
      ok: true,
      summary: input.summarize(value),
      modelCalls,
    });
    return { value, modelCalls };
  } catch (error) {
    const summary = error instanceof Error ? error.message : `${input.stage} failed`;
    await finishSocialAgentStage({
      job,
      runId: input.runId,
      stage: input.stage,
      ok: false,
      summary,
      modelCalls,
    });
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as StageRequest;
    const auth = await verifyAdminAccess(body.token);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: "Invalid admin login" }, { status: 401 });
    }

    const schemaGuard = await socialPostAdminSchemaGuardResponse();
    if (schemaGuard) return schemaGuard;

    if (body.action === "stop") {
      const checkpoint = validateCheckpoint(body.checkpoint);
      if (!verifySocialDraftCheckpointSignature(checkpoint, auth.identity.id, body.checkpointSignature)) {
        return NextResponse.json({ ok: false, error: "Workflow checkpoint signature is invalid." }, { status: 400 });
      }
      const stoppedCheckpoint = withCheckpoint(checkpoint, { nextStage: "blocked" });
      return NextResponse.json({
        ok: true,
        stopped: true,
        checkpoint: stoppedCheckpoint,
        checkpointSignature: signSocialDraftCheckpoint(stoppedCheckpoint, auth.identity.id),
        publication: { published: false, note: "Workflow stopped by owner. No additional agent or model call ran." },
      });
    }

    const limited = await socialPostAdminRateLimitResponse(req, {
      route: "/api/social-posts/agent-draft/stage",
      category: "draft",
      token: body.token,
    });
    if (limited) return limited;

    if (body.action === "start") {
      const modelBlock = await billableModelProtectionBlock();
      if (modelBlock) return NextResponse.json(modelBlock, { status: 503 });

      const request = validateStartInput(body);
      const themeContext = resolveSocialThemeLibraryContext(request.theme);
      const themeSourceUrl =
        request.businessFocus === "facility-parties"
          ? socialThemePreferredSourceUrl(themeContext)
          : null;
      const requestedSource = body.source_image_url?.trim() || themeSourceUrl;
      const assetResolved = resolveApprovedAssetContext(requestedSource);
      if (!assetResolved.ok) {
        return NextResponse.json({ ok: false, error: assetResolved.error }, { status: 400 });
      }
      const combinedContext = [
        assetResolved.asset?.metadataSummary ?? null,
        themeContext?.promptContext ?? null,
      ]
        .filter(Boolean)
        .join("; ")
        .slice(0, AGENT_INPUT_LIMITS.assetContext);
      const strategyInput: SocialAgentInput = {
        ...request,
        assetContext: combinedContext || null,
      };
      const runId = randomUUID();
      const managed = await runManagedStage({
        runId,
        stage: "campaign_strategist",
        actorId: auth.identity.id,
        payload: { theme: request.theme ?? null, campaignId: request.campaignId ?? null },
        execute: (recordModelCall) =>
          runCampaignStrategistAgent(strategyInput, { onModelCall: recordModelCall }),
        summarize: (result) =>
          result.ok ? "Campaign strategy prepared for owner checkpoint." : result.error,
      });
      if (!managed.value.ok) throw new Error(managed.value.error);

      const checkpoint: SocialDraftCheckpoint = {
        version: SOCIAL_DRAFT_CHECKPOINT_VERSION,
        runId,
        request: strategyInput,
        selectedSourceImageUrl: assetResolved.asset?.url ?? null,
        themeContext,
        strategist: managed.value.output,
        creative: null,
        creativeQuality: null,
        reviewer: null,
        compliance: null,
        finalCompliance: null,
        revisionUsed: false,
        modelCallsUsed: managed.modelCalls,
        stages: [
          stageRecord(
            "campaign_strategist",
            "completed",
            "Campaign strategy ready for owner review. Next agent has not run.",
          ),
        ],
        diagnostics: [managed.value.diagnostics],
        nextStage: "creative_director",
      };
      return NextResponse.json({
        ok: true,
        checkpoint,
        checkpointSignature: signSocialDraftCheckpoint(checkpoint, auth.identity.id),
        preview: managed.value.output,
        protection: protectionMetadata(),
      });
    }

    const checkpoint = validateCheckpoint(body.checkpoint);
    if (!verifySocialDraftCheckpointSignature(checkpoint, auth.identity.id, body.checkpointSignature)) {
      return NextResponse.json({ ok: false, error: "Workflow checkpoint signature is invalid." }, { status: 400 });
    }
    if (checkpoint.nextStage === "blocked" || checkpoint.nextStage === "complete") {
      return NextResponse.json({ ok: false, error: "This workflow cannot continue." }, { status: 409 });
    }

    const modelStage = ["creative_director", "independent_reviewer", "revision"].includes(
      checkpoint.nextStage,
    );
    if (modelStage) {
      const modelBlock = await billableModelProtectionBlock();
      if (modelBlock) return NextResponse.json(modelBlock, { status: 503 });
    }

    if (checkpoint.nextStage === "creative_director") {
      if (!checkpoint.strategist) throw new AgentInputValidationError("Strategy checkpoint is missing.");
      const managed = await runManagedStage({
        runId: checkpoint.runId,
        stage: "creative_director",
        actorId: auth.identity.id,
        execute: (recordModelCall) =>
          runCreativeDirectorAgent(
            {
              strategist: checkpoint.strategist!,
              themeContext: checkpoint.themeContext,
            },
            { onModelCall: recordModelCall },
          ),
        summarize: (result) =>
          result.ok ? "Creative package prepared for owner checkpoint." : result.error,
      });
      if (!managed.value.ok) throw new Error(managed.value.error);
      const sourceUrl =
        checkpoint.selectedSourceImageUrl ??
        socialThemePreferredSourceUrl(checkpoint.themeContext) ??
        chooseSourceImageUrl(
          managed.value.output.goal,
          managed.value.output.businessFocus,
          managed.value.output.sourceImageKeywords,
        );
      const creative: CreativeDirectorOutput = {
        ...managed.value.output,
        generationPrompt: applyVisualRealismConstraints({
          prompt: managed.value.output.generationPrompt,
          hasReferenceAsset: Boolean(sourceUrl),
          themeLabel: checkpoint.themeContext?.themeLabel,
        }),
      };
      const creativeQuality = evaluateCreativeQualityGate({
        creative,
        themeLabel: checkpoint.themeContext?.themeLabel,
        themeSource: checkpoint.themeContext?.sourceText,
      });
      const nextCheckpoint = withCheckpoint(checkpoint, {
        selectedSourceImageUrl: sourceUrl,
        creative,
        creativeQuality,
        modelCallsUsed: checkpoint.modelCallsUsed + managed.modelCalls,
        stages: [
          ...checkpoint.stages,
          stageRecord(
            "creative_director",
            creativeQuality.allowed ? "completed" : "failed",
            creativeQuality.allowed
              ? "Creative package ready for owner review. Reviewer has not run."
              : `Creative quality gate stopped the workflow: ${creativeQuality.findings.join(" ")}`,
          ),
        ],
        diagnostics: [...checkpoint.diagnostics, managed.value.diagnostics],
        nextStage: creativeQuality.allowed ? "independent_reviewer" : "blocked",
      });
      return NextResponse.json({
        ok: true,
        checkpoint: nextCheckpoint,
        checkpointSignature: signSocialDraftCheckpoint(nextCheckpoint, auth.identity.id),
        preview: creative,
        creativeQuality,
        blocked: !creativeQuality.allowed,
        publication: {
          published: false,
          note: creativeQuality.allowed
            ? "No post has been saved yet."
            : "Stopped before the Reviewer and before persistence.",
        },
      });
    }

    if (checkpoint.nextStage === "independent_reviewer") {
      if (!checkpoint.strategist || !checkpoint.creative) {
        throw new AgentInputValidationError("Creative checkpoint is incomplete.");
      }
      const validCreative = validateCreativeDirectorOutputDetailed(checkpoint.creative);
      if (!validCreative.ok) throw new AgentInputValidationError(validCreative.reason);
      const managed = await runManagedStage({
        runId: checkpoint.runId,
        stage: "independent_reviewer",
        actorId: auth.identity.id,
        execute: (recordModelCall) =>
          runIndependentReviewerAgent(
            { strategist: checkpoint.strategist!, creative: validCreative.output },
            { onModelCall: recordModelCall },
          ),
        summarize: (result) =>
          result.ok ? `Independent review completed: ${result.output.verdict}.` : result.error,
      });
      if (!managed.value.ok) throw new Error(managed.value.error);
      const nextCheckpoint = withCheckpoint(checkpoint, {
        reviewer: managed.value.output,
        modelCallsUsed: checkpoint.modelCallsUsed + managed.modelCalls,
        stages: [
          ...checkpoint.stages,
          stageRecord(
            "independent_reviewer",
            "completed",
            `Independent review: ${managed.value.output.verdict}. Compliance has not run.`,
          ),
        ],
        diagnostics: [...checkpoint.diagnostics, managed.value.diagnostics],
        nextStage: "compliance",
      });
      return NextResponse.json({
        ok: true,
        checkpoint: nextCheckpoint,
        checkpointSignature: signSocialDraftCheckpoint(nextCheckpoint, auth.identity.id),
        preview: managed.value.output,
      });
    }

    if (checkpoint.nextStage === "compliance" || checkpoint.nextStage === "final_compliance") {
      if (!checkpoint.creative || !checkpoint.reviewer) {
        throw new AgentInputValidationError("Review checkpoint is incomplete.");
      }
      const finalPass = checkpoint.nextStage === "final_compliance";
      const managed = await runManagedStage({
        runId: checkpoint.runId,
        stage: finalPass ? "final_compliance" : "compliance",
        actorId: auth.identity.id,
        payload: { finalPass },
        execute: async () => evaluateAgentComplianceGateWithPosts(creativeCandidate(checkpoint.creative!)),
        summarize: (result) => `Deterministic compliance decision: ${result.decision}.`,
      });
      const visualGate = evaluateVisualRealismGate({
        prompt: checkpoint.creative.generationPrompt,
        sourceImageUrl: checkpoint.selectedSourceImageUrl,
        themeLabel: checkpoint.themeContext?.themeLabel,
      });
      const compliance = managed.value;
      const blocked = compliance.decision === "block" || !visualGate.allowed;
      const nextStage: SocialDraftNextStage = blocked
        ? "blocked"
        : finalPass
          ? compliance.decision === "allow"
            ? "persist"
            : "blocked"
          : shouldRevise(checkpoint.reviewer, compliance)
            ? "revision"
            : compliance.decision === "allow"
              ? "persist"
              : "blocked";
      const stageId = finalPass
        ? "final_deterministic_compliance"
        : "deterministic_compliance";
      const nextCheckpoint = withCheckpoint(checkpoint, {
        compliance: finalPass ? checkpoint.compliance : compliance,
        finalCompliance: finalPass ? compliance : null,
        stages: [
          ...checkpoint.stages,
          stageRecord(
            stageId,
            blocked ? "failed" : "completed",
            blocked
              ? `Compliance/visual QA blocked the workflow: ${[
                  compliance.summary,
                  ...visualGate.findings,
                ].join(" ")}`
              : `Compliance ${compliance.decision}; visual QA passed.`,
          ),
        ],
        nextStage,
      });
      return NextResponse.json({
        ok: true,
        blocked,
        visualGate,
        checkpoint: nextCheckpoint,
        checkpointSignature: signSocialDraftCheckpoint(nextCheckpoint, auth.identity.id),
        preview: { compliance, visualGate },
        publication: { published: false, note: blocked ? "Stopped before persistence." : "No post has been saved yet." },
      });
    }

    if (checkpoint.nextStage === "revision") {
      if (!checkpoint.strategist || !checkpoint.creative || !checkpoint.reviewer || !checkpoint.compliance) {
        throw new AgentInputValidationError("Revision checkpoint is incomplete.");
      }
      if (checkpoint.revisionUsed || checkpoint.modelCallsUsed >= 4) {
        return NextResponse.json({ ok: false, error: "Revision budget is exhausted." }, { status: 409 });
      }
      const instructions = [
        ...checkpoint.reviewer.revisionInstructions,
        `Address compliance decision ${checkpoint.compliance.decision}: ${checkpoint.compliance.summary}`,
      ];
      const managed = await runManagedStage({
        runId: checkpoint.runId,
        stage: "revision",
        actorId: auth.identity.id,
        execute: (recordModelCall) =>
          runCreativeDirectorAgent(
            {
              strategist: checkpoint.strategist!,
              themeContext: checkpoint.themeContext,
              priorCreative: checkpoint.creative!,
              revisionInstructions: instructions,
              complianceFindings: [
                checkpoint.compliance!.summary,
                ...checkpoint.compliance!.blockingCodes,
                ...checkpoint.compliance!.hardClaimFindings,
              ],
            },
            { onModelCall: recordModelCall },
          ),
        summarize: (result) =>
          result.ok ? "Single permitted Creative Director revision completed." : result.error,
      });
      if (!managed.value.ok) throw new Error(managed.value.error);
      const revised: CreativeDirectorOutput = {
        ...managed.value.output,
        generationPrompt: applyVisualRealismConstraints({
          prompt: managed.value.output.generationPrompt,
          hasReferenceAsset: Boolean(checkpoint.selectedSourceImageUrl),
          themeLabel: checkpoint.themeContext?.themeLabel,
        }),
      };
      const creativeQuality = evaluateCreativeQualityGate({
        creative: revised,
        themeLabel: checkpoint.themeContext?.themeLabel,
        themeSource: checkpoint.themeContext?.sourceText,
      });
      const nextCheckpoint = withCheckpoint(checkpoint, {
        creative: revised,
        creativeQuality,
        revisionUsed: true,
        modelCallsUsed: checkpoint.modelCallsUsed + managed.modelCalls,
        stages: [
          ...checkpoint.stages,
          stageRecord(
            "creative_director_revision",
            creativeQuality.allowed ? "completed" : "failed",
            creativeQuality.allowed
              ? "Revised creative ready for owner review. Final compliance has not run."
              : `Revised creative failed quality gate: ${creativeQuality.findings.join(" ")}`,
          ),
        ],
        diagnostics: [...checkpoint.diagnostics, managed.value.diagnostics],
        nextStage: creativeQuality.allowed ? "final_compliance" : "blocked",
      });
      return NextResponse.json({
        ok: true,
        checkpoint: nextCheckpoint,
        checkpointSignature: signSocialDraftCheckpoint(nextCheckpoint, auth.identity.id),
        preview: revised,
        creativeQuality,
        blocked: !creativeQuality.allowed,
      });
    }

    if (checkpoint.nextStage === "persist") {
      if (!checkpoint.creative || !checkpoint.reviewer) {
        throw new AgentInputValidationError("Owner-ready checkpoint is incomplete.");
      }
      const compliance = checkpoint.finalCompliance ?? checkpoint.compliance;
      if (!compliance || compliance.decision !== "allow" || !compliance.allowedToProceed) {
        return NextResponse.json(
          { ok: false, error: "Only an exact compliance allow may be persisted." },
          { status: 422 },
        );
      }
      const visualGate = evaluateVisualRealismGate({
        prompt: checkpoint.creative.generationPrompt,
        sourceImageUrl: checkpoint.selectedSourceImageUrl,
        themeLabel: checkpoint.themeContext?.themeLabel,
      });
      if (!visualGate.allowed) {
        return NextResponse.json(
          { ok: false, error: "Visual realism gate failed.", visualGate },
          { status: 422 },
        );
      }
      const managed = await runManagedStage({
        runId: checkpoint.runId,
        stage: "persist",
        actorId: auth.identity.id,
        execute: async () =>
          createSocialPost({
            title: checkpoint.creative!.title,
            campaign_id: checkpoint.creative!.campaignId,
            goal: checkpoint.creative!.goal,
            prompt: checkpoint.creative!.generationPrompt,
            caption: checkpoint.creative!.caption,
            media_type: checkpoint.creative!.mediaType,
            business_focus: checkpoint.creative!.businessFocus,
            source_image_url: checkpoint.selectedSourceImageUrl,
            platforms: checkpoint.creative!.platforms,
            creative_source: checkpoint.diagnostics.some((item) => item.source === "model")
              ? "openai"
              : "rule-fallback",
          }),
        summarize: (post) => `Owner-ready social draft ${post.id} persisted; not published.`,
      });
      revalidatePath("/admin/social-posts");
      const completeCheckpoint = withCheckpoint(checkpoint, {
        stages: [
          ...checkpoint.stages,
          stageRecord(
            "owner_ready",
            "completed",
            "Owner-ready draft saved. Nothing published or scheduled.",
          ),
        ],
        nextStage: "complete",
      });
      return NextResponse.json({
        ok: true,
        post: managed.value,
        checkpoint: completeCheckpoint,
        checkpointSignature: signSocialDraftCheckpoint(completeCheckpoint, auth.identity.id),
        publication: { published: false, note: "Draft saved only. Owner approval remains required." },
      });
    }

    return NextResponse.json({ ok: false, error: "Unsupported workflow stage." }, { status: 400 });
  } catch (error) {
    const durable = durableAgentStoreErrorResponse(error);
    if (durable) return durable;
    if (error instanceof SyntaxError) {
      return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
    }
    if (error instanceof AgentInputValidationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Staged Social Agent failed." },
      { status: 500 },
    );
  }
}
