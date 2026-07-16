import type { SeasonalIntelligenceSnapshot } from "./seasonal-intelligence-types";

export type SeasonalIntelligenceDiagnostic = Readonly<{
  code: string;
  message: string;
  severity: "info" | "warning";
}>;

export function diagnoseSeasonalIntelligence(
  snapshot: SeasonalIntelligenceSnapshot,
): readonly SeasonalIntelligenceDiagnostic[] {
  const diagnostics: SeasonalIntelligenceDiagnostic[] = [];

  if (snapshot.missingConfiguration.length > 0) {
    for (const message of snapshot.missingConfiguration) {
      diagnostics.push({
        code: "missing_configuration",
        message,
        severity: "warning",
      });
    }
  }

  if (snapshot.activeOpportunities.length === 0 && snapshot.upcomingOpportunities.length === 0) {
    diagnostics.push({
      code: "no_current_opportunities",
      message: "No active or upcoming seasonal opportunities were identified for the current business date.",
      severity: "info",
    });
  }

  for (const opportunity of snapshot.opportunities) {
    if (opportunity.readiness === "too-late") {
      diagnostics.push({
        code: "late_planning_warning",
        message: `${opportunity.name} may be too late for a useful campaign this cycle.`,
        severity: "warning",
      });
    }
    if (opportunity.repetitionRisk === "high") {
      diagnostics.push({
        code: "repetition_risk_high",
        message: `${opportunity.name} has high repetition risk according to Marketing Memory.`,
        severity: "warning",
      });
    }
  }

  return diagnostics;
}
