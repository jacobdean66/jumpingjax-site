import assert from "node:assert/strict";
import test from "node:test";

import { createSocialDraftWorkflowContext } from "./staged-workflow-context";
import type { ApprovedAssetContext } from "./approved-asset-context";
import type { ContentDraftSpecification } from "../content-draft-specification/content-draft-specification-types";
import type { CreativeBrief } from "../creative-brief-intelligence/creative-brief-intelligence-types";
import type { SocialWorkingContext } from "../social-working-context";
import type { SocialThemeLibraryContext } from "../social-theme-library";

const workingContext: SocialWorkingContext = {
  campaign: {
    id: "birthday-parties",
    label: "Birthday Parties",
    description: "Birthday campaign",
    businessFocus: "both",
    defaultMediaType: "video",
  },
  sourceSummary: {
    generatedAt: "2026-09-01T12:00:00.000Z",
    postCount: 4,
    decisionCount: 9,
    activeMemoryCount: 2,
    evidenceCount: 3,
  },
  recentPosts: [],
  decisionSummary: {
    byStage: {},
    byType: {},
    recentDecisions: [],
  },
  campaignMemory: [
    {
      id: "memory-1",
      key: "campaign:birthday-parties:hook",
      type: "image_pattern",
      text: "Use energetic kid-led celebration scenes.",
      recommendation: "Keep the first line celebratory.",
      confidenceScore: 0.8,
      supportCount: 4,
      contradictionCount: 0,
      evidenceCount: 2,
    },
  ],
  constraints: {
    temporary: true,
    campaignScoped: true,
    readOnly: true,
    authoritative: false,
  },
};

const creativeBrief: CreativeBrief = {
  id: "brief-1",
  campaignId: "birthday-parties",
  campaignTitle: "Birthday Parties",
  objective: "Promote easy birthday planning.",
  evaluationDate: "2026-09-01",
  generatedAt: "2026-09-01T12:00:00.000Z",
  plannerRank: 1,
  plannerScore: 97,
  plannerStatus: "recommended",
  audience: {
    customerSegment: "Families",
    useCase: "Birthday parties",
    serviceAreaContext: "Greenwood, SC",
    assumptions: [],
  },
  messageStrategy: {
    primaryAngle: "Stress-free party fun",
    hookDirection: "Lead with birthday excitement",
    primaryMessage: "Jumping Jax makes party planning easier.",
    supportingProofPoints: [],
    offerOrValueProposition: "Indoor fun",
    callToAction: "Message us to plan",
    toneGuidance: "family-friendly",
  },
  contentStrategy: {
    recommendedFormat: "short-video",
    recommendedPlacements: [],
    placementConfidence: "known",
    recommendedAssetIds: ["asset-1"],
    assetUsageGuidance: ["Use approved party room imagery."],
    requiredNewAssets: [],
    aspectRatioNeeds: ["4:5"],
    videoOrStillRequirement: "video-preferred",
  },
  seasonalContext: {
    matchedOpportunityKeys: ["fall-birthdays"],
    lifecycleStates: ["active"],
    urgencyGuidance: "Birthday demand is steady this month.",
    timingWarnings: [],
  },
  memoryConstraints: {
    repetitionWarnings: ["Avoid repeating the same birthday hook too often."],
    differentiationGuidance: "Use a fresh opening line.",
    duplicateRiskMessages: [],
  },
  safeFactualClaims: ["Indoor birthday parties available."],
  assumptions: [],
  warnings: [],
  prohibitedClaims: ["Do not promise same-day openings."],
  missingFacts: [],
  missingAssets: [],
  readiness: "ready",
  diagnostics: [],
  pipelineReferences: {
    marketingMemoryGeneratedAt: "2026-09-01T12:00:00.000Z",
    seasonalBusinessDate: "2026-09-01",
    assetIntelligenceGeneratedAt: "2026-09-01T12:00:00.000Z",
    campaignPlannerGeneratedAt: "2026-09-01T12:00:00.000Z",
    assetAssessment: null,
    seasonalMatches: [],
  },
  computedOnly: true,
  readOnly: true,
  authoritative: false,
};

const specification: ContentDraftSpecification = {
  id: "spec-1",
  sourceBriefId: "brief-1",
  campaignId: "birthday-parties",
  campaignName: "Birthday Parties",
  plannerRank: 1,
  plannerScore: 97,
  evaluationDate: "2026-09-01",
  asOf: "2026-09-01T12:00:00.000Z",
  pipelineReferences: {
    creativeBriefId: "brief-1",
    creativeBriefGeneratedAt: "2026-09-01T12:00:00.000Z",
    marketingMemoryGeneratedAt: "2026-09-01T12:00:00.000Z",
    seasonalBusinessDate: "2026-09-01",
    assetIntelligenceGeneratedAt: "2026-09-01T12:00:00.000Z",
    campaignPlannerGeneratedAt: "2026-09-01T12:00:00.000Z",
  },
  contentPurpose: {
    businessObjective: "Book birthday parties",
    intendedAudience: "Local families",
    contentIntent: "Drive party inquiries",
    campaignAngleReference: "Easy planning",
    placementOrPlatformTarget: "Facebook and Instagram",
  },
  requiredContentSections: [],
  messageHierarchy: [],
  allowedFactualClaims: [
    {
      claimId: "claim-1",
      claimText: "Indoor birthday parties at Jumping Jax.",
      sourceCategory: "other-safe-fact",
      sourceReference: "creative-brief",
      permittedUsageContext: "caption",
      qualification: null,
      priceKind: null,
    },
  ],
  pricingConstraints: {
    allowedPriceClaimIds: [],
    allowedPriceKinds: [],
    selectionSource: "creative-brief-intelligence",
    newMatchingForbidden: true,
    emptySafeClaimSet: true,
  },
  prohibitedClaims: ["No invented prices."],
  ctaConstraints: {
    allowedIntent: "Invite families to message Jumping Jax",
    permittedActionCategories: ["message"],
    destinationType: "direct-message",
    prohibitedAvailabilityImplications: [],
    prohibitedScarcityImplications: [],
    requiresHumanReview: true,
    structuralGuidance: "Use a soft inquiry CTA.",
  },
  platformPlacementRequirements: [],
  assetSlots: [
    {
      slotId: "hero",
      purpose: "Main image",
      selectedAssetIds: ["asset-1"],
      requiredAssetType: "still-image",
      aspectOrOrientationRequirement: "4:5",
      videoPreference: "optional",
      assetReadiness: "ready",
      missingAssetDetails: [],
      authoritativeDimensionStatus: "known",
    },
  ],
  accessibilityRequirements: [],
  missingInputs: [],
  reviewGates: [],
  generationReadiness: "ready",
  diagnostics: [],
  specificationOnly: true,
  nonPublishable: true,
  computedOnly: true,
  readOnly: true,
  authoritative: false,
};

const themeContext: SocialThemeLibraryContext = {
  sourceText: "Sonic",
  themeId: "sonic",
  themeLabel: "Sonic",
  styleFamily: "gamer",
  matchedAlias: "sonic",
  matchKind: "exact",
  attachedLibraries: ["Canva Elements", "Freepik"],
  heroPath: "/invitation-library/sonic/hero.png",
  decorationPaths: [],
  approvedArtworkPath: "/invitation-library/sonic/approved.png",
  palette: {
    background: "#123",
    backgroundAlt: "#234",
    accent: "#345",
    accent2: "#456",
    text: "#fff",
  },
  promptContext:
    "facility invitation theme source=Sonic; licensed libraries=Canva Elements, Freepik",
};

const approvedAsset: ApprovedAssetContext = {
  url: "https://example.com/asset.png",
  label: "Blue Castle Combo",
  category: "Combos",
  focus: "both",
  metadataSummary:
    "label=Blue Castle Combo; category=Combos; preserve exact inflatable product identity",
};

test("builds passed workflow modules and reusable agent summaries", () => {
  const context = createSocialDraftWorkflowContext({
    workingContext,
    creativeBrief,
    specification,
    themeContext,
    approvedAsset,
  });

  assert.equal(context.modules.length, 9);
  assert.equal(
    context.modules.find((module) => module.moduleId === "theme_library")?.status,
    "passed",
  );
  assert.equal(
    context.modules.find(
      (module) => module.moduleId === "content_draft_specification",
    )?.status,
    "passed",
  );
  assert.match(context.strategistSeasonalContext ?? "", /Rank 1/);
  assert.match(
    context.strategistAssetContext ?? "",
    /licensed libraries=Canva Elements, Freepik/,
  );
  assert.match(context.agentContextSummary ?? "", /Content Draft Specification/);
});

test("marks campaign-specific intelligence empty when no campaign match exists", () => {
  const context = createSocialDraftWorkflowContext({
    workingContext: {
      ...workingContext,
      campaign: {
        ...workingContext.campaign,
        id: null,
        label: null,
      },
    },
    creativeBrief: null,
    specification: null,
    themeContext: null,
    approvedAsset: null,
  });

  assert.equal(
    context.modules.find((module) => module.moduleId === "creative_brief")?.status,
    "empty",
  );
  assert.equal(
    context.modules.find(
      (module) => module.moduleId === "content_draft_specification",
    )?.status,
    "empty",
  );
  assert.equal(
    context.modules.find((module) => module.moduleId === "theme_library")?.status,
    "empty",
  );
});
