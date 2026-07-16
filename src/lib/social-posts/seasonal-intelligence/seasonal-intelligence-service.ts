import {
  businessDateFromAsOf,
  evaluateCatalogOpportunity,
  evaluateCustomOpportunity,
} from "./seasonal-intelligence-domain";
import { SEASONAL_INTELLIGENCE_TIME_ZONE, SEASONAL_OPPORTUNITY_CATALOG } from "./seasonal-intelligence-calendar";
import type {
  SeasonalIntelligenceInput,
  SeasonalIntelligenceSnapshot,
  SeasonalOpportunityEvaluation,
} from "./seasonal-intelligence-types";

export function emptySeasonalIntelligenceSnapshot(asOf: string): SeasonalIntelligenceSnapshot {
  const businessDate = businessDateFromAsOf(asOf) ?? "1970-01-01";
  return deepFreeze({
    asOf,
    businessDate,
    timeZone: SEASONAL_INTELLIGENCE_TIME_ZONE,
    opportunities: [],
    activeOpportunities: [],
    upcomingOpportunities: [],
    passedOpportunities: [],
    assumptions: [
      "Seasonal Intelligence uses explicit asOf dates in America/New_York.",
      "Local school, VBS, and community festival dates require explicit owner configuration.",
    ],
    missingConfiguration: businessDateFromAsOf(asOf)
      ? []
      : ["asOf value could not be resolved to a business date."],
    constraints: {
      readOnly: true,
      deterministic: true,
      performsNoWrites: true,
      performsNoNetworkCalls: true,
      authoritative: false,
    },
  });
}

export function buildSeasonalIntelligence(
  input: SeasonalIntelligenceInput,
): SeasonalIntelligenceSnapshot {
  const businessDate = businessDateFromAsOf(input.asOf);
  if (!businessDate) {
    return emptySeasonalIntelligenceSnapshot(input.asOf);
  }

  const missingConfiguration: string[] = [];
  const opportunities: SeasonalOpportunityEvaluation[] = [];

  for (const entry of SEASONAL_OPPORTUNITY_CATALOG) {
    const evaluation = evaluateCatalogOpportunity({
      entry,
      businessDate,
      memory: input.marketingMemory,
    });
    if (evaluation) {
      opportunities.push(evaluation);
    }
  }

  for (const config of input.customOpportunities ?? []) {
    const result = evaluateCustomOpportunity({
      config,
      businessDate,
      memory: input.marketingMemory,
    });
    missingConfiguration.push(...result.missingConfiguration);
    if (result.evaluation) {
      opportunities.push(result.evaluation);
    }
  }

  opportunities.sort((left, right) =>
    left.daysUntilStart - right.daysUntilStart ||
    left.name.localeCompare(right.name) ||
    left.opportunityKey.localeCompare(right.opportunityKey),
  );

  const activeOpportunities = opportunities.filter((item) =>
    item.lifecycleState === "active" || item.lifecycleState === "final-call",
  );
  const upcomingOpportunities = opportunities.filter((item) =>
    item.lifecycleState === "preparation" || item.lifecycleState === "future",
  );
  const passedOpportunities = opportunities.filter((item) => item.lifecycleState === "passed");

  return deepFreeze({
    asOf: input.asOf,
    businessDate,
    timeZone: SEASONAL_INTELLIGENCE_TIME_ZONE,
    opportunities,
    activeOpportunities,
    upcomingOpportunities,
    passedOpportunities,
    assumptions: [
      "Seasonal Intelligence uses explicit asOf dates in America/New_York.",
      "Fixed holidays use documented calendar dates; movable holidays use deterministic rules.",
      "Broad seasons use explicit documented date windows.",
      "School calendars, spring break, VBS, and local festivals require explicit owner configuration.",
      "No pricing, inventory, weather, or booking availability is inferred.",
    ],
    missingConfiguration,
    constraints: {
      readOnly: true,
      deterministic: true,
      performsNoWrites: true,
      performsNoNetworkCalls: true,
      authoritative: false,
    },
  });
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }
  return Object.freeze(value);
}
