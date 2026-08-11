import type { ComplianceGateResult } from "./agent-compliance-gate";
import type { AgentDiagnostics } from "./agent-types";

/** Hard invariant: Creative Director may revise at most once per workflow. */
export const MAX_CREATIVE_DIRECTOR_REVISIONS = 1 as const;

/**
 * Bounded model-call budget for one orchestrated workflow invocation.
 * Strategist (1) + Creative Director (1) + Reviewer (1) + optional CD revision (1).
 * No optional second reviewer pass in the default design.
 */
export const MAX_MODEL_CALLS_WITHOUT_REVISION = 3 as const;
export const MAX_MODEL_CALLS_WITH_REVISION = 4 as const;

export type OrchestrationStageId =
  | "campaign_strategist"
  | "creative_director"
  | "independent_reviewer"
  | "deterministic_compliance"
  | "creative_director_revision"
  | "final_deterministic_compliance"
  | "owner_ready";

export type OrchestrationStageStatus =
  | "pending"
  | "running"
  | "completed"
  | "skipped"
  | "failed"
  | "not_needed";

export type CampaignStrategistOutput = {
  campaignObjective: string;
  audience: string;
  angleMessage: string;
  ctaIntent: string;
  platformGuidance: string;
  selectedAssetContext: string | null;
  creativeConstraints: string[];
  notesForCreativeDirector: string[];
  goal: string;
  campaignId: string | null;
  mediaType: "image" | "video";
  platforms: ("facebook" | "instagram")[];
  businessFocus: "rentals" | "facility-parties" | "both";
  tone: string;
  factualConstraints: string[];
  ownerInputRequired: string[];
  sourceImageKeywords: string[];
  seasonalContextUsed: string | null;
};

export type CreativeDirectorOutput = {
  title: string;
  caption: string;
  generationPrompt: string;
  mediaType: "image" | "video";
  platforms: ("facebook" | "instagram")[];
  businessFocus: "rentals" | "facility-parties" | "both";
  campaignId: string | null;
  goal: string;
  assetUsageGuidance: string;
  visualDirection: string;
  platformSpecificConstraints: string[];
  sourceImageKeywords: string[];
  ownerInputRequired: string[];
  revisionOfPrior: boolean;
};

export type IndependentReviewerVerdict = "approve" | "revise";

export type IndependentReviewerOutput = {
  verdict: IndependentReviewerVerdict;
  reasoning: string;
  revisionInstructions: string[];
  flags: string[];
  /** Explicitly never grants owner approval. */
  grantsOwnerApproval: false;
};

export type OrchestrationStageRecord = {
  stageId: OrchestrationStageId;
  status: OrchestrationStageStatus;
  agentDiagnostics?: AgentDiagnostics;
  summary?: string;
};

export type OrchestrationOutcomeKind =
  | "owner_ready"
  | "review_needed"
  | "compliance_blocked"
  | "failed";

export type SocialPostOrchestrationResult = {
  ok: boolean;
  outcome: OrchestrationOutcomeKind;
  stages: OrchestrationStageRecord[];
  strategist: CampaignStrategistOutput | null;
  creative: CreativeDirectorOutput | null;
  reviewer: IndependentReviewerOutput | null;
  compliance: ComplianceGateResult | null;
  finalCompliance: ComplianceGateResult | null;
  revisionUsed: boolean;
  creativeDirectorRevisionCount: number;
  modelCallsUsed: number;
  modelCallBudget: number;
  ownerApprovalRequired: true;
  ownerApproved: false;
  published: false;
  generationReady: false;
  error: string | null;
  diagnostics: AgentDiagnostics[];
};

export type ModelCallBudget = {
  used: number;
  max: number;
  recordCall(): void;
  remaining(): number;
};

export function createModelCallBudget(
  max: number = MAX_MODEL_CALLS_WITH_REVISION,
): ModelCallBudget {
  let used = 0;
  return {
    get used() {
      return used;
    },
    get max() {
      return max;
    },
    recordCall() {
      if (used >= max) {
        throw new Error(
          `Orchestration model-call budget exceeded (max ${max}).`,
        );
      }
      used += 1;
    },
    remaining() {
      return Math.max(0, max - used);
    },
  };
}
