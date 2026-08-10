import {
  evaluateAgentComplianceGate,
  evaluateAgentComplianceGateWithPosts,
  type ComplianceGateResult,
} from "./agent-compliance-gate";
import { complianceBlocksPersistence } from "./generation-gate";
import {
  runCampaignStrategistAgent,
  type CampaignStrategistInput,
} from "./campaign-strategist-agent";
import { runCreativeDirectorAgent } from "./creative-director-agent";
import { runIndependentReviewerAgent } from "./independent-reviewer-agent";
import type { LlmJsonClient } from "./llm-json-client";
import type { AgentDiagnostics } from "./agent-types";
import {
  MAX_CREATIVE_DIRECTOR_REVISIONS,
  MAX_MODEL_CALLS_WITH_REVISION,
  createModelCallBudget,
  type CampaignStrategistOutput,
  type CreativeDirectorOutput,
  type IndependentReviewerOutput,
  type OrchestrationStageRecord,
  type SocialPostOrchestrationResult,
} from "./orchestration-types";
import { chooseSourceImageUrl } from "../social-agent";
import type { SocialPost } from "../social-post-data";

export type RunSocialPostOrchestratorInput = {
  request: CampaignStrategistInput;
  /** Optional posts list for compliance; when omitted, WithPosts loads them. */
  posts?: SocialPost[];
  /**
   * Test seam: inject compliance results in order
   * (initial creative, then after revision if any).
   */
  complianceEvaluator?: (
    creative: CreativeDirectorOutput,
    pass: "initial" | "final",
  ) => Promise<ComplianceGateResult> | ComplianceGateResult;
};

export type SocialPostOrchestratorDeps = {
  client?: LlmJsonClient;
  runStrategist?: typeof runCampaignStrategistAgent;
  runCreativeDirector?: typeof runCreativeDirectorAgent;
  runReviewer?: typeof runIndependentReviewerAgent;
};

function stage(
  stageId: OrchestrationStageRecord["stageId"],
  status: OrchestrationStageRecord["status"],
  summary?: string,
  agentDiagnostics?: AgentDiagnostics,
): OrchestrationStageRecord {
  return { stageId, status, summary, agentDiagnostics };
}

function emptyResult(
  partial: Partial<SocialPostOrchestrationResult> &
    Pick<SocialPostOrchestrationResult, "outcome" | "ok" | "error">,
): SocialPostOrchestrationResult {
  return {
    stages: [],
    strategist: null,
    creative: null,
    reviewer: null,
    compliance: null,
    finalCompliance: null,
    revisionUsed: false,
    creativeDirectorRevisionCount: 0,
    modelCallsUsed: 0,
    modelCallBudget: MAX_MODEL_CALLS_WITH_REVISION,
    ownerApprovalRequired: true,
    ownerApproved: false,
    published: false,
    generationReady: false,
    diagnostics: [],
    ...partial,
  };
}

async function evaluateCompliance(
  creative: CreativeDirectorOutput,
  input: RunSocialPostOrchestratorInput,
  pass: "initial" | "final",
): Promise<ComplianceGateResult> {
  if (input.complianceEvaluator) {
    return input.complianceEvaluator(creative, pass);
  }

  const candidate = {
    title: creative.title,
    caption: creative.caption,
    generationPrompt: creative.generationPrompt,
    campaignId: creative.campaignId,
    platforms: creative.platforms,
    mediaType: creative.mediaType,
    candidateId: `explicit:orchestrator:${pass}`,
  };

  if (input.posts) {
    return evaluateAgentComplianceGate({ ...candidate, posts: input.posts });
  }
  return evaluateAgentComplianceGateWithPosts(candidate);
}

function needsCorrectableComplianceRevision(
  compliance: ComplianceGateResult,
): boolean {
  // Block is not auto-revised into allow — quarantine/insufficient may benefit
  // from one creative revision when reviewer also asked, or when quarantine.
  return compliance.decision === "quarantine";
}

/**
 * Authoritative Social Posts agent-to-agent orchestration.
 *
 * Order (deterministic):
 * Strategist -> Creative Director -> Independent Reviewer -> compliance
 * -> optional ONE Creative Director revision -> final compliance
 * -> owner-ready (never auto owner-approved / never published / never paid gen).
 */
export async function runSocialPostOrchestrator(
  input: RunSocialPostOrchestratorInput,
  deps: SocialPostOrchestratorDeps = {},
): Promise<SocialPostOrchestrationResult> {
  const budget = createModelCallBudget(MAX_MODEL_CALLS_WITH_REVISION);
  const stages: OrchestrationStageRecord[] = [];
  const diagnostics: AgentDiagnostics[] = [];
  const runStrategist = deps.runStrategist ?? runCampaignStrategistAgent;
  const runCreative = deps.runCreativeDirector ?? runCreativeDirectorAgent;
  const runReviewer = deps.runReviewer ?? runIndependentReviewerAgent;
  const client = deps.client;

  const onModelCall = () => budget.recordCall();

  let strategist: CampaignStrategistOutput | null = null;
  let creative: CreativeDirectorOutput | null = null;
  let reviewer: IndependentReviewerOutput | null = null;
  let compliance: ComplianceGateResult | null = null;
  let finalCompliance: ComplianceGateResult | null = null;
  let creativeDirectorRevisionCount = 0;

  try {
    // 1) Campaign Strategist
    stages.push(stage("campaign_strategist", "running"));
    const strategistResult = await runStrategist(input.request, {
      client,
      onModelCall,
    });
    if (!strategistResult.ok) {
      stages[stages.length - 1] = stage(
        "campaign_strategist",
        "failed",
        strategistResult.error,
        strategistResult.diagnostics,
      );
      diagnostics.push(strategistResult.diagnostics);
      return emptyResult({
        ok: false,
        outcome: "failed",
        stages,
        diagnostics,
        modelCallsUsed: budget.used,
        error: strategistResult.error,
      });
    }
    strategist = strategistResult.output;
    diagnostics.push(strategistResult.diagnostics);
    stages[stages.length - 1] = stage(
      "campaign_strategist",
      "completed",
      "Campaign Strategist completed",
      strategistResult.diagnostics,
    );

    // 2) Creative Director (initial) — must receive strategist output
    stages.push(stage("creative_director", "running"));
    const creativeResult = await runCreative(
      { strategist },
      { client, onModelCall },
    );
    if (!creativeResult.ok) {
      stages[stages.length - 1] = stage(
        "creative_director",
        "failed",
        creativeResult.error,
        creativeResult.diagnostics,
      );
      diagnostics.push(creativeResult.diagnostics);
      return emptyResult({
        ok: false,
        outcome: "failed",
        stages,
        strategist,
        diagnostics,
        modelCallsUsed: budget.used,
        error: creativeResult.error,
      });
    }
    creative = creativeResult.output;
    diagnostics.push(creativeResult.diagnostics);
    stages[stages.length - 1] = stage(
      "creative_director",
      "completed",
      "Creative Director completed",
      creativeResult.diagnostics,
    );

    // 3) Independent Reviewer — must receive strategist + creative
    stages.push(stage("independent_reviewer", "running"));
    const reviewerResult = await runReviewer(
      {
        strategist,
        creative,
      },
      { client, onModelCall },
    );
    if (!reviewerResult.ok) {
      stages[stages.length - 1] = stage(
        "independent_reviewer",
        "failed",
        reviewerResult.error,
        reviewerResult.diagnostics,
      );
      diagnostics.push(reviewerResult.diagnostics);
      return emptyResult({
        ok: false,
        outcome: "failed",
        stages,
        strategist,
        creative,
        diagnostics,
        modelCallsUsed: budget.used,
        error: reviewerResult.error,
      });
    }
    reviewer = {
      ...reviewerResult.output,
      grantsOwnerApproval: false,
    };
    diagnostics.push(reviewerResult.diagnostics);
    stages[stages.length - 1] = stage(
      "independent_reviewer",
      "completed",
      `Independent Reviewer: ${reviewer.verdict}`,
      reviewerResult.diagnostics,
    );

    // 4) Deterministic compliance (authoritative)
    stages.push(stage("deterministic_compliance", "running"));
    compliance = await evaluateCompliance(creative, input, "initial");
    stages[stages.length - 1] = stage(
      "deterministic_compliance",
      "completed",
      `Deterministic compliance: ${compliance.decision}`,
    );

    if (complianceBlocksPersistence(compliance)) {
      stages.push(
        stage(
          "creative_director_revision",
          "skipped",
          "Blocked by deterministic compliance; no revision or paid generation.",
        ),
      );
      stages.push(
        stage(
          "owner_ready",
          "failed",
          "Compliance blocked — draft not owner-ready.",
        ),
      );
      return {
        ok: false,
        outcome: "compliance_blocked",
        stages,
        strategist,
        creative,
        reviewer,
        compliance,
        finalCompliance: compliance,
        revisionUsed: false,
        creativeDirectorRevisionCount: 0,
        modelCallsUsed: budget.used,
        modelCallBudget: budget.max,
        ownerApprovalRequired: true,
        ownerApproved: false,
        published: false,
        generationReady: false,
        error: "Draft blocked by deterministic compliance validation.",
        diagnostics,
      };
    }

    // 5) At most one Creative Director revision
    const reviewerWantsRevision = reviewer.verdict === "revise";
    const complianceWantsRevision = needsCorrectableComplianceRevision(compliance);
    const shouldRevise = reviewerWantsRevision || complianceWantsRevision;

    if (shouldRevise) {
      if (creativeDirectorRevisionCount >= MAX_CREATIVE_DIRECTOR_REVISIONS) {
        throw new Error("Creative Director revision budget already exhausted.");
      }

      stages.push(stage("creative_director_revision", "running"));
      const revisionInstructions = [
        ...reviewer.revisionInstructions,
        ...(complianceWantsRevision
          ? [
              `Address deterministic compliance decision=${compliance.decision}: ${compliance.summary}`,
            ]
          : []),
      ];
      const complianceFindings = [
        compliance.summary,
        ...compliance.blockingCodes.map((code) => `code:${code}`),
        ...compliance.hardClaimFindings,
      ].filter(Boolean);

      const revisionResult = await runCreative(
        {
          strategist,
          priorCreative: creative,
          revisionInstructions,
          complianceFindings,
        },
        { client, onModelCall },
      );
      creativeDirectorRevisionCount += 1;

      if (!revisionResult.ok) {
        stages[stages.length - 1] = stage(
          "creative_director_revision",
          "failed",
          revisionResult.error,
          revisionResult.diagnostics,
        );
        diagnostics.push(revisionResult.diagnostics);
        return emptyResult({
          ok: false,
          outcome: "failed",
          stages,
          strategist,
          creative,
          reviewer,
          compliance,
          creativeDirectorRevisionCount,
          revisionUsed: true,
          diagnostics,
          modelCallsUsed: budget.used,
          error: revisionResult.error,
        });
      }

      creative = revisionResult.output;
      diagnostics.push(revisionResult.diagnostics);
      stages[stages.length - 1] = stage(
        "creative_director_revision",
        "completed",
        "Creative Director revision completed (max 1)",
        revisionResult.diagnostics,
      );

      // Hard stop: no second revision even if reviewer would want another.
      stages.push(
        stage(
          "final_deterministic_compliance",
          "running",
          "Re-running deterministic compliance after single permitted revision",
        ),
      );
      finalCompliance = await evaluateCompliance(creative, input, "final");
      stages[stages.length - 1] = stage(
        "final_deterministic_compliance",
        "completed",
        `Final deterministic compliance: ${finalCompliance.decision}`,
      );
    } else {
      stages.push(
        stage(
          "creative_director_revision",
          "not_needed",
          "No Creative Director revision required",
        ),
      );
      finalCompliance = compliance;
      stages.push(
        stage(
          "final_deterministic_compliance",
          "skipped",
          "Final compliance same as initial (no revision)",
        ),
      );
    }

    const authoritative = finalCompliance ?? compliance;
    if (!authoritative) {
      return emptyResult({
        ok: false,
        outcome: "failed",
        stages,
        strategist,
        creative,
        reviewer,
        compliance,
        finalCompliance,
        creativeDirectorRevisionCount,
        revisionUsed: creativeDirectorRevisionCount > 0,
        diagnostics,
        modelCallsUsed: budget.used,
        error: "Missing authoritative compliance result.",
      });
    }

    if (complianceBlocksPersistence(authoritative)) {
      stages.push(
        stage(
          "owner_ready",
          "failed",
          "Final compliance blocked — not owner-ready.",
        ),
      );
      return {
        ok: false,
        outcome: "compliance_blocked",
        stages,
        strategist,
        creative,
        reviewer,
        compliance,
        finalCompliance: authoritative,
        revisionUsed: creativeDirectorRevisionCount > 0,
        creativeDirectorRevisionCount,
        modelCallsUsed: budget.used,
        modelCallBudget: budget.max,
        ownerApprovalRequired: true,
        ownerApproved: false,
        published: false,
        generationReady: false,
        error: "Draft blocked by deterministic compliance after revision.",
        diagnostics,
      };
    }

    // Reviewer still revise after the single allowed revision => review_needed
    // (we do not loop). Quarantine also surfaces as review_needed.
    const stillNeedsOwnerAttention =
      (shouldRevise && reviewerWantsRevision && creativeDirectorRevisionCount >= 1) ||
      authoritative.decision === "quarantine";

    // Note: after one revision we do NOT re-run the reviewer (bounded design).
    // If the initial reviewer said revise, outcome is review_needed unless
    // compliance allow and we treat revision as completed for owner review.
    const outcome =
      authoritative.decision === "allow" && !stillNeedsOwnerAttention
        ? "owner_ready"
        : authoritative.decision === "allow" && reviewerWantsRevision
          ? "owner_ready" // revision already applied once; owner reviews
          : authoritative.decision === "quarantine"
            ? "review_needed"
            : "owner_ready";

    stages.push(
      stage(
        "owner_ready",
        "completed",
        outcome === "owner_ready"
          ? "Owner-ready draft prepared. Jacob approval still required. Not published."
          : "Review needed. Jacob approval still required. Not published.",
      ),
    );

    return {
      ok: true,
      outcome: outcome === "owner_ready" ? "owner_ready" : "review_needed",
      stages,
      strategist,
      creative,
      reviewer,
      compliance,
      finalCompliance: authoritative,
      revisionUsed: creativeDirectorRevisionCount > 0,
      creativeDirectorRevisionCount,
      modelCallsUsed: budget.used,
      modelCallBudget: budget.max,
      ownerApprovalRequired: true,
      ownerApproved: false,
      published: false,
      generationReady: false,
      error: null,
      diagnostics,
    };
  } catch (error) {
    return emptyResult({
      ok: false,
      outcome: "failed",
      stages,
      strategist,
      creative,
      reviewer,
      compliance,
      finalCompliance,
      revisionUsed: creativeDirectorRevisionCount > 0,
      creativeDirectorRevisionCount,
      diagnostics,
      modelCallsUsed: budget.used,
      error:
        error instanceof Error
          ? error.message
          : "Social Posts orchestration failed.",
    });
  }
}

/** Convenience: map orchestration creative output to persistence + source image. */
export function orchestrationPersistableFields(
  result: SocialPostOrchestrationResult,
  preferredSourceImageUrl?: string | null,
): {
  title: string;
  caption: string;
  prompt: string;
  media_type: "image" | "video";
  platforms: ("facebook" | "instagram")[];
  business_focus: "rentals" | "facility-parties" | "both";
  campaign_id: string | null;
  goal: string | null;
  source_image_url: string | null;
  creative_source: "openai" | "rule-fallback";
} | null {
  if (!result.creative || !result.strategist) return null;
  const creative = result.creative;
  const modelBacked = result.diagnostics.some(
    (item) => item.source === "model" && item.provider === "openai",
  );
  return {
    title: creative.title,
    caption: creative.caption,
    prompt: creative.generationPrompt,
    media_type: creative.mediaType,
    platforms: creative.platforms,
    business_focus: creative.businessFocus,
    campaign_id: creative.campaignId,
    goal: creative.goal,
    source_image_url:
      preferredSourceImageUrl ??
      chooseSourceImageUrl(
        creative.goal,
        creative.businessFocus,
        creative.sourceImageKeywords,
      ),
    creative_source: modelBacked ? "openai" : "rule-fallback",
  };
}

export function buildOrchestrationWorkflowSummary(
  result: SocialPostOrchestrationResult,
): {
  independentReviewerImplemented: true;
  ownerApprovalRequired: true;
  maxCreativeDirectorRevisions: typeof MAX_CREATIVE_DIRECTOR_REVISIONS;
  stages: OrchestrationStageRecord[];
  revisionUsed: boolean;
  modelCallsUsed: number;
  note: string;
} {
  return {
    independentReviewerImplemented: true,
    ownerApprovalRequired: true,
    maxCreativeDirectorRevisions: MAX_CREATIVE_DIRECTOR_REVISIONS,
    stages: result.stages,
    revisionUsed: result.revisionUsed,
    modelCallsUsed: result.modelCallsUsed,
    note:
      "Server-side orchestration: Campaign Strategist → Creative Director → Independent Reviewer → deterministic compliance → optional one Creative Director revision. Jacob remains final owner approver. No autonomous publish/schedule/paid generation.",
  };
}
