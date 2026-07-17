import {
  buildCreativeBrief,
  businessDateFromAsOf,
  campaignLookup,
} from "./creative-brief-intelligence-domain";
import type {
  CreativeBriefIntelligenceInput,
  CreativeBriefIntelligenceSnapshot,
} from "./creative-brief-intelligence-types";

export function buildCreativeBriefIntelligence(
  input: CreativeBriefIntelligenceInput,
): CreativeBriefIntelligenceSnapshot {
  const evaluationDate = businessDateFromAsOf(input.asOf);
  const facts = input.authoritativeFacts ?? null;

  const briefs = input.campaignPlanner.candidates.map((candidate) => {
    const campaign = campaignLookup(input.campaigns, candidate.campaignId);
    if (!campaign) {
      return buildCreativeBrief({
        candidate,
        campaign: {
          id: candidate.campaignId,
          label: candidate.label,
          description: candidate.label,
          businessFocus: candidate.businessFocus,
          defaultMediaType: candidate.defaultMediaType,
          goalTemplates: candidate.referenceGoal ? [candidate.referenceGoal] : [],
          captionAngles: candidate.referenceCaptionAngle
            ? [candidate.referenceCaptionAngle]
            : [],
          promptAngles: candidate.referencePromptAngle
            ? [candidate.referencePromptAngle]
            : [],
        },
        planner: input.campaignPlanner,
        asOf: input.asOf,
        evaluationDate,
        authoritativeFacts: facts,
      });
    }

    return buildCreativeBrief({
      candidate,
      campaign,
      planner: input.campaignPlanner,
      asOf: input.asOf,
      evaluationDate,
      authoritativeFacts: facts,
    });
  });

  // Preserve Campaign Planner order exactly; do not rerank.
  const assumptions = Array.from(
    new Set([
      "Creative Brief Intelligence consumes Campaign Planner output without changing planner scores.",
      "Briefs are structured data only; no captions, images, or posts are generated.",
      "Unknown facts remain unknown and unsupported claims are prohibited.",
      ...briefs.flatMap((brief) => brief.assumptions),
    ]),
  ).sort((left, right) => left.localeCompare(right));

  const warnings = Array.from(
    new Set(briefs.flatMap((brief) => brief.warnings)),
  ).sort((left, right) => left.localeCompare(right));

  return deepFreeze({
    generatedAt: input.asOf,
    evaluationDate,
    briefs,
    readinessSummary: {
      ready: briefs.filter((brief) => brief.readiness === "ready").length,
      needsAssets: briefs.filter((brief) => brief.readiness === "needs-assets").length,
      needsFacts: briefs.filter((brief) => brief.readiness === "needs-facts").length,
      needsReview: briefs.filter((brief) => brief.readiness === "needs-review").length,
      blocked: briefs.filter((brief) => brief.readiness === "blocked").length,
      unknown: briefs.filter((brief) => brief.readiness === "unknown").length,
    },
    assumptions,
    warnings,
    constraints: {
      readOnly: true,
      deterministic: true,
      performsNoWrites: true,
      performsNoNetworkCalls: true,
      createsNoDrafts: true,
      generatesNothing: true,
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
