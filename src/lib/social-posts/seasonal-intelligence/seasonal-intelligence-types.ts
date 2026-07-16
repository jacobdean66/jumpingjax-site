import type { MarketingMemorySnapshot } from "../marketing-memory/marketing-memory-types";

export type SeasonalBusinessFocus =
  | "outdoor-rentals"
  | "water-slides"
  | "bounce-houses"
  | "facility-parties"
  | "private-parties"
  | "church-events"
  | "school-daycare-events"
  | "brand-awareness";

export type SeasonalLifecycleState =
  | "future"
  | "preparation"
  | "active"
  | "final-call"
  | "passed";

export type SeasonalUrgency = "none" | "low" | "moderate" | "high" | "critical";

export type SeasonalRepetitionRisk = "none" | "low" | "moderate" | "high";

export type SeasonalReadiness =
  | "ready"
  | "needs-review"
  | "too-late"
  | "not-yet"
  | "passed";

export type SeasonalDateWindow = Readonly<{
  startDate: string;
  endDate: string;
}>;

export type SeasonalCustomOpportunityConfig = Readonly<{
  key: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  recommendedBusinessFocus?: readonly SeasonalBusinessFocus[];
  recommendedCampaignObjective?: string;
}>;

export type SeasonalOpportunityCatalogEntry = Readonly<{
  key: string;
  name: string;
  kind: "fixed-holiday" | "movable-holiday" | "season-window";
  recommendedBusinessFocus: readonly SeasonalBusinessFocus[];
  recommendedCampaignObjective: string;
  recommendedPlacements: readonly ("feed" | "story" | "reel" | "carousel" | "search")[];
  preparationLeadDays: number;
  finalCallDays: number;
  memoryThemeTokens: readonly string[];
}>;

export type SeasonalOpportunityEvaluation = Readonly<{
  opportunityKey: string;
  name: string;
  eventDateOrWindow: SeasonalDateWindow | Readonly<{ date: string }>;
  lifecycleState: SeasonalLifecycleState;
  daysUntilStart: number;
  daysUntilEnd: number;
  urgency: SeasonalUrgency;
  recommendedBusinessFocus: readonly SeasonalBusinessFocus[];
  recommendedCampaignObjective: string;
  recommendedPlacements: readonly string[];
  preparationNeeds: readonly string[];
  memorySignals: readonly string[];
  repetitionRisk: SeasonalRepetitionRisk;
  readiness: SeasonalReadiness;
  reasons: readonly string[];
  warnings: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
}>;

export type SeasonalIntelligenceInput = Readonly<{
  asOf: string;
  marketingMemory: MarketingMemorySnapshot;
  customOpportunities?: readonly SeasonalCustomOpportunityConfig[];
}>;

export type SeasonalIntelligenceSnapshot = Readonly<{
  asOf: string;
  businessDate: string;
  timeZone: string;
  opportunities: readonly SeasonalOpportunityEvaluation[];
  activeOpportunities: readonly SeasonalOpportunityEvaluation[];
  upcomingOpportunities: readonly SeasonalOpportunityEvaluation[];
  passedOpportunities: readonly SeasonalOpportunityEvaluation[];
  assumptions: readonly string[];
  missingConfiguration: readonly string[];
  constraints: Readonly<{
    readOnly: true;
    deterministic: true;
    performsNoWrites: true;
    performsNoNetworkCalls: true;
    authoritative: false;
  }>;
}>;
