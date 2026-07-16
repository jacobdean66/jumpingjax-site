import type { CampaignPlannerSnapshot } from "./campaign-planner-types";

export type CampaignPlannerDiagnostic = Readonly<{
  code: "empty_campaigns" | "history_unavailable" | "duplicate_risk_detected" | "review_required";
  severity: "info" | "warning";
  message: string;
}>;

export function diagnoseCampaignPlanner(
  planner: CampaignPlannerSnapshot,
): readonly CampaignPlannerDiagnostic[] {
  const diagnostics: CampaignPlannerDiagnostic[] = [];
  if (planner.summary.campaignCount === 0) {
    diagnostics.push({
      code: "empty_campaigns",
      severity: "info",
      message: "No configured campaigns are available to preview.",
    });
  }
  if (planner.summary.recommendedCount === planner.summary.campaignCount) {
    diagnostics.push({
      code: "history_unavailable",
      severity: "info",
      message: "No recorded campaign conflicts were found in the available history.",
    });
  }
  if (planner.summary.duplicateRiskCount > 0) {
    diagnostics.push({
      code: "duplicate_risk_detected",
      severity: "warning",
      message: `${planner.summary.duplicateRiskCount} duplicate-risk warning(s) are present in Marketing Memory.`,
    });
  }
  if (planner.summary.reviewCount > 0) {
    diagnostics.push({
      code: "review_required",
      severity: "warning",
      message: `${planner.summary.reviewCount} campaign candidate(s) need history review before use.`,
    });
  }
  return diagnostics;
}
