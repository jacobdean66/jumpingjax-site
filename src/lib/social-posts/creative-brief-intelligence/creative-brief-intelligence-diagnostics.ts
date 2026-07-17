import type { CreativeBriefIntelligenceSnapshot } from "./creative-brief-intelligence-types";

export type CreativeBriefIntelligenceDiagnostic = Readonly<{
  code:
    | "no_briefs"
    | "blocked_briefs"
    | "needs_assets"
    | "needs_facts"
    | "ready_briefs"
    | "unknown_placement_confidence";
  severity: "info" | "warning";
  message: string;
}>;

export function diagnoseCreativeBriefIntelligence(
  snapshot: CreativeBriefIntelligenceSnapshot,
): readonly CreativeBriefIntelligenceDiagnostic[] {
  const diagnostics: CreativeBriefIntelligenceDiagnostic[] = [];

  if (snapshot.briefs.length === 0) {
    diagnostics.push({
      code: "no_briefs",
      severity: "warning",
      message: "No Campaign Planner candidates were available to brief.",
    });
  }

  if (snapshot.readinessSummary.blocked > 0) {
    diagnostics.push({
      code: "blocked_briefs",
      severity: "warning",
      message: `${snapshot.readinessSummary.blocked} brief${snapshot.readinessSummary.blocked === 1 ? "" : "s"} are blocked from future generation readiness.`,
    });
  }

  if (snapshot.readinessSummary.needsAssets > 0) {
    diagnostics.push({
      code: "needs_assets",
      severity: "warning",
      message: `${snapshot.readinessSummary.needsAssets} brief${snapshot.readinessSummary.needsAssets === 1 ? "" : "s"} need additional or verified assets.`,
    });
  }

  if (snapshot.readinessSummary.needsFacts > 0) {
    diagnostics.push({
      code: "needs_facts",
      severity: "warning",
      message: `${snapshot.readinessSummary.needsFacts} brief${snapshot.readinessSummary.needsFacts === 1 ? "" : "s"} are missing authoritative facts.`,
    });
  }

  if (snapshot.readinessSummary.ready > 0) {
    diagnostics.push({
      code: "ready_briefs",
      severity: "info",
      message: `${snapshot.readinessSummary.ready} brief${snapshot.readinessSummary.ready === 1 ? "" : "s"} are marked ready for future generation review.`,
    });
  }

  const unknownPlacement = snapshot.briefs.filter(
    (brief) => brief.contentStrategy.placementConfidence === "unknown",
  ).length;
  if (unknownPlacement > 0) {
    diagnostics.push({
      code: "unknown_placement_confidence",
      severity: "info",
      message: `${unknownPlacement} brief${unknownPlacement === 1 ? "" : "s"} lack known placement confidence because asset dimensions are unknown.`,
    });
  }

  return diagnostics;
}
