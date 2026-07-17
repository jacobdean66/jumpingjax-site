import type { AssetIntelligenceSnapshot } from "./asset-intelligence-types";

export type AssetIntelligenceDiagnostic = Readonly<{
  code:
    | "empty_inventory"
    | "unknown_dimensions"
    | "insufficient_campaigns"
    | "overused_assets"
    | "ready_campaigns";
  severity: "info" | "warning";
  message: string;
}>;

export function diagnoseAssetIntelligence(
  snapshot: AssetIntelligenceSnapshot,
): readonly AssetIntelligenceDiagnostic[] {
  const diagnostics: AssetIntelligenceDiagnostic[] = [];

  if (snapshot.inventory.totalAssets === 0) {
    diagnostics.push({
      code: "empty_inventory",
      severity: "warning",
      message: "Asset inventory is empty; all campaign readiness states are unknown or insufficient.",
    });
  }

  if (snapshot.inventory.aspectCoverage.unknown > 0) {
    diagnostics.push({
      code: "unknown_dimensions",
      severity: "info",
      message: `${snapshot.inventory.aspectCoverage.unknown} asset${snapshot.inventory.aspectCoverage.unknown === 1 ? "" : "s"} lack known dimensions.`,
    });
  }

  if (snapshot.insufficientCampaignIds.length > 0) {
    diagnostics.push({
      code: "insufficient_campaigns",
      severity: "warning",
      message: `${snapshot.insufficientCampaignIds.length} campaign${snapshot.insufficientCampaignIds.length === 1 ? "" : "s"} lack relevant assets.`,
    });
  }

  const overused = snapshot.campaignAssessments.filter((assessment) =>
    assessment.gaps.some((gap) => gap.kind === "repeated-overused-asset"),
  );
  if (overused.length > 0) {
    diagnostics.push({
      code: "overused_assets",
      severity: "warning",
      message: `${overused.length} campaign${overused.length === 1 ? "" : "s"} reference repeated or overused assets.`,
    });
  }

  if (snapshot.readyCampaignIds.length > 0) {
    diagnostics.push({
      code: "ready_campaigns",
      severity: "info",
      message: `${snapshot.readyCampaignIds.length} campaign${snapshot.readyCampaignIds.length === 1 ? "" : "s"} appear ready for creative production.`,
    });
  }

  return diagnostics;
}
