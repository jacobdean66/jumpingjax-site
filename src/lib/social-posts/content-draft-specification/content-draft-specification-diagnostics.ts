import type { ContentDraftSpecificationSnapshot } from "./content-draft-specification-types";

export type ContentDraftSpecificationDiagnostic = Readonly<{
  code:
    | "no_specifications"
    | "skipped_briefs"
    | "blocked_specifications"
    | "needs_assets"
    | "needs_facts"
    | "needs_review"
    | "ready_specifications"
    | "unknown_placement"
    | "empty_safe_claims";
  severity: "info" | "warning";
  message: string;
}>;

export function diagnoseContentDraftSpecification(
  snapshot: ContentDraftSpecificationSnapshot,
): readonly ContentDraftSpecificationDiagnostic[] {
  const diagnostics: ContentDraftSpecificationDiagnostic[] = [];

  if (snapshot.specifications.length === 0) {
    diagnostics.push({
      code: "no_specifications",
      severity: "warning",
      message: "No content draft specifications were produced from Creative Brief Intelligence.",
    });
  }

  if (snapshot.skippedBriefs.length > 0) {
    diagnostics.push({
      code: "skipped_briefs",
      severity: "warning",
      message: `${snapshot.skippedBriefs.length} brief${snapshot.skippedBriefs.length === 1 ? "" : "s"} were skipped with explicit deterministic reasons.`,
    });
  }

  if (snapshot.readinessSummary.blocked > 0) {
    diagnostics.push({
      code: "blocked_specifications",
      severity: "warning",
      message: `${snapshot.readinessSummary.blocked} specification${snapshot.readinessSummary.blocked === 1 ? "" : "s"} are blocked from generation readiness.`,
    });
  }

  if (snapshot.readinessSummary.needsAssets > 0) {
    diagnostics.push({
      code: "needs_assets",
      severity: "warning",
      message: `${snapshot.readinessSummary.needsAssets} specification${snapshot.readinessSummary.needsAssets === 1 ? "" : "s"} need additional or verified assets.`,
    });
  }

  if (snapshot.readinessSummary.needsFacts > 0) {
    diagnostics.push({
      code: "needs_facts",
      severity: "warning",
      message: `${snapshot.readinessSummary.needsFacts} specification${snapshot.readinessSummary.needsFacts === 1 ? "" : "s"} are missing authoritative facts.`,
    });
  }

  if (snapshot.readinessSummary.needsReview > 0) {
    diagnostics.push({
      code: "needs_review",
      severity: "info",
      message: `${snapshot.readinessSummary.needsReview} specification${snapshot.readinessSummary.needsReview === 1 ? "" : "s"} require human review gates.`,
    });
  }

  if (snapshot.readinessSummary.ready > 0) {
    diagnostics.push({
      code: "ready_specifications",
      severity: "info",
      message: `${snapshot.readinessSummary.ready} specification${snapshot.readinessSummary.ready === 1 ? "" : "s"} are marked ready for a future generation review layer.`,
    });
  }

  const unknownPlacement = snapshot.specifications.filter((spec) =>
    spec.platformPlacementRequirements.some((item) => item.placementConfidence === "unknown"),
  ).length;
  if (unknownPlacement > 0) {
    diagnostics.push({
      code: "unknown_placement",
      severity: "info",
      message: `${unknownPlacement} specification${unknownPlacement === 1 ? "" : "s"} include unknown placement certainty.`,
    });
  }

  const emptyClaims = snapshot.specifications.filter(
    (spec) => spec.allowedFactualClaims.length === 0,
  ).length;
  if (emptyClaims > 0) {
    diagnostics.push({
      code: "empty_safe_claims",
      severity: "warning",
      message: `${emptyClaims} specification${emptyClaims === 1 ? "" : "s"} inherited an empty safe-claim set.`,
    });
  }

  return diagnostics;
}
