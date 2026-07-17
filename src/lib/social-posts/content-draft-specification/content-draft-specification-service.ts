import { buildContentDraftSpecification } from "./content-draft-specification-domain";
import type {
  ContentDraftSpecificationInput,
  ContentDraftSpecificationSnapshot,
} from "./content-draft-specification-types";

export function buildContentDraftSpecificationIntelligence(
  input: ContentDraftSpecificationInput,
): ContentDraftSpecificationSnapshot {
  const evaluationDate = input.creativeBriefs.evaluationDate;
  const skippedBriefs: Array<{
    sourceBriefId: string;
    campaignId: string;
    reason: string;
  }> = [];

  const specifications = input.creativeBriefs.briefs
    .map((brief) => {
      if (!brief.id || !brief.campaignId) {
        skippedBriefs.push({
          sourceBriefId: brief.id || "missing-brief-id",
          campaignId: brief.campaignId || "missing-campaign-id",
          reason: "Brief lacked stable identity required for deterministic specification mapping.",
        });
        return null;
      }

      return buildContentDraftSpecification({
        brief,
        asOf: input.asOf,
        evaluationDate,
      });
    })
    .filter((spec): spec is NonNullable<typeof spec> => spec != null);

  // Preserve Creative Brief / Campaign Planner order exactly; do not rerank.
  const assumptions = Array.from(
    new Set([
      "Content Draft Specification Intelligence consumes Creative Brief output without changing planner scores or brief order.",
      "Specifications are structural requirements only; no final captions, ads, scripts, images, or posts are generated.",
      "Allowed claims are a subset of Creative Brief safe facts and are never expanded.",
      "Price selection remains fail-closed inside Creative Brief Intelligence; Wave 10 adds no price matching.",
      ...specifications.flatMap((spec) =>
        spec.allowedFactualClaims.length === 0
          ? ["Empty inherited safe-claim set remains empty and fails closed for claim usage."]
          : [],
      ),
    ]),
  ).sort((left, right) => left.localeCompare(right));

  const warnings = Array.from(
    new Set([
      ...input.creativeBriefs.briefs.flatMap((brief) => brief.warnings),
      ...skippedBriefs.map(
        (skip) => `Skipped brief ${skip.sourceBriefId} (${skip.campaignId}): ${skip.reason}`,
      ),
    ]),
  ).sort((left, right) => left.localeCompare(right));

  const diagnostics = Array.from(
    new Set([
      `specifications:${specifications.length}`,
      `skipped-briefs:${skippedBriefs.length}`,
      `ordering-preserved:true`,
      `asOf:${input.asOf}`,
      ...skippedBriefs.map((skip) => `skip:${skip.campaignId}:${skip.reason}`),
      ...specifications.flatMap((spec) => spec.diagnostics.slice(0, 3)),
    ]),
  ).sort((left, right) => left.localeCompare(right));

  return deepFreeze({
    generatedAt: input.asOf,
    evaluationDate,
    specifications,
    skippedBriefs: skippedBriefs
      .slice()
      .sort(
        (left, right) =>
          left.campaignId.localeCompare(right.campaignId) ||
          left.sourceBriefId.localeCompare(right.sourceBriefId),
      ),
    readinessSummary: {
      ready: specifications.filter((spec) => spec.generationReadiness === "ready").length,
      needsAssets: specifications.filter((spec) => spec.generationReadiness === "needs-assets").length,
      needsFacts: specifications.filter((spec) => spec.generationReadiness === "needs-facts").length,
      needsReview: specifications.filter((spec) => spec.generationReadiness === "needs-review").length,
      blocked: specifications.filter((spec) => spec.generationReadiness === "blocked").length,
      unknown: specifications.filter((spec) => spec.generationReadiness === "unknown").length,
    },
    assumptions,
    warnings,
    diagnostics,
    constraints: {
      readOnly: true,
      deterministic: true,
      performsNoWrites: true,
      performsNoNetworkCalls: true,
      createsNoDrafts: true,
      generatesNoFinalCopy: true,
      generatesNoMedia: true,
      schedulesNothing: true,
      publishesNothing: true,
      approvesNothing: true,
      executesNothing: true,
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
