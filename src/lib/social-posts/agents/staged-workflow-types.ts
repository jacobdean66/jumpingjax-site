import type { ComplianceGateResult } from "./agent-compliance-gate";
import type { AgentDiagnostics } from "./agent-types";
import type {
  CampaignStrategistOutput,
  CreativeDirectorOutput,
  IndependentReviewerOutput,
  OrchestrationStageRecord,
} from "./orchestration-types";
import type { SocialAgentInput } from "../social-agent";
import type { SocialThemeLibraryContext } from "../social-theme-library";
import type { CreativeQualityGateResult } from "./creative-quality-gate";

export const SOCIAL_DRAFT_CHECKPOINT_VERSION = 1 as const;

export type SocialDraftNextStage =
  | "creative_director"
  | "independent_reviewer"
  | "compliance"
  | "revision"
  | "final_compliance"
  | "persist"
  | "blocked"
  | "complete";

export type SocialDraftCheckpoint = Readonly<{
  version: typeof SOCIAL_DRAFT_CHECKPOINT_VERSION;
  runId: string;
  request: SocialAgentInput;
  selectedSourceImageUrl: string | null;
  themeContext: SocialThemeLibraryContext | null;
  strategist: CampaignStrategistOutput | null;
  creative: CreativeDirectorOutput | null;
  creativeQuality: CreativeQualityGateResult | null;
  reviewer: IndependentReviewerOutput | null;
  compliance: ComplianceGateResult | null;
  finalCompliance: ComplianceGateResult | null;
  revisionUsed: boolean;
  modelCallsUsed: number;
  stages: readonly OrchestrationStageRecord[];
  diagnostics: readonly AgentDiagnostics[];
  nextStage: SocialDraftNextStage;
}>;
