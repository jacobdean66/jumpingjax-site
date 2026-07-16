import type { MarketingMemorySnapshot } from "../marketing-memory/marketing-memory-types";
import { buildSeasonalIntelligence } from "./seasonal-intelligence-service";
import type {
  SeasonalCustomOpportunityConfig,
  SeasonalIntelligenceSnapshot,
} from "./seasonal-intelligence-types";

export function replaySeasonalIntelligence(input: {
  marketingMemory: MarketingMemorySnapshot;
  asOf?: string;
  customOpportunities?: readonly SeasonalCustomOpportunityConfig[];
}): SeasonalIntelligenceSnapshot {
  const asOf = input.asOf ?? input.marketingMemory.generatedAt;
  return buildSeasonalIntelligence({
    asOf,
    marketingMemory: input.marketingMemory,
    customOpportunities: input.customOpportunities,
  });
}
