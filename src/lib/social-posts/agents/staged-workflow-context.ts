import { AGENT_INPUT_LIMITS } from "./agent-input-bounds";
import type { ApprovedAssetContext } from "./approved-asset-context";
import type { ContentDraftSpecification } from "../content-draft-specification/content-draft-specification-types";
import type { CreativeBrief } from "../creative-brief-intelligence/creative-brief-intelligence-types";
import type { SocialWorkingContext } from "../social-working-context";
import type { SocialThemeLibraryContext } from "../social-theme-library";

export type SocialDraftWorkflowModuleId =
  | "theme_library"
  | "approved_asset"
  | "working_context"
  | "marketing_memory"
  | "seasonal_intelligence"
  | "asset_intelligence"
  | "campaign_planner"
  | "creative_brief"
  | "content_draft_specification";

export type SocialDraftWorkflowModuleStatus = "passed" | "blocked" | "empty";

export type SocialDraftWorkflowModule = Readonly<{
  moduleId: SocialDraftWorkflowModuleId;
  label: string;
  status: SocialDraftWorkflowModuleStatus;
  summary: string;
}>;

export type SocialDraftWorkflowContext = Readonly<{
  modules: readonly SocialDraftWorkflowModule[];
  strategistSeasonalContext: string | null;
  strategistAssetContext: string | null;
  agentContextSummary: string | null;
}>;

type CreateSocialDraftWorkflowContextInput = Readonly<{
  workingContext: SocialWorkingContext;
  creativeBrief: CreativeBrief | null;
  specification: ContentDraftSpecification | null;
  themeContext: SocialThemeLibraryContext | null;
  approvedAsset: ApprovedAssetContext | null;
}>;

function compactText(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function boundText(value: string, max: number): string | null {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.slice(0, max);
}

function limitedList(
  values: readonly string[],
  maxItems: number,
  fallback: string,
): string {
  if (values.length === 0) return fallback;
  return values.slice(0, maxItems).join(", ");
}

function moduleStatusFromReadiness(
  readiness: string | null | undefined,
): SocialDraftWorkflowModuleStatus {
  if (!readiness) return "empty";
  return readiness === "blocked" ? "blocked" : "passed";
}

function createModule(
  moduleId: SocialDraftWorkflowModuleId,
  label: string,
  status: SocialDraftWorkflowModuleStatus,
  summary: string,
): SocialDraftWorkflowModule {
  return {
    moduleId,
    label,
    status,
    summary: summary.trim(),
  };
}

export function createSocialDraftWorkflowContext(
  input: CreateSocialDraftWorkflowContextInput,
): SocialDraftWorkflowContext {
  const campaignLabel =
    input.workingContext.campaign.label ??
    input.workingContext.campaign.id ??
    "Custom / no campaign";

  const themeSummary = input.themeContext
    ? `Matched ${input.themeContext.themeLabel}; licensed libraries ${limitedList(input.themeContext.attachedLibraries, 3, "none")}.`
    : "No party theme selected.";
  const approvedAssetSummary = input.approvedAsset
    ? `${input.approvedAsset.label}${input.approvedAsset.category ? ` (${input.approvedAsset.category})` : ""}.`
    : "No approved source asset selected.";
  const workingContextSummary = `Scope ${campaignLabel}; ${input.workingContext.sourceSummary.postCount} recent post(s), ${input.workingContext.sourceSummary.decisionCount} decision(s), ${input.workingContext.sourceSummary.activeMemoryCount} active memory item(s), ${input.workingContext.sourceSummary.evidenceCount} evidence item(s).`;

  const creativeBriefStatus = moduleStatusFromReadiness(
    input.creativeBrief?.readiness,
  );
  const contentSpecStatus = moduleStatusFromReadiness(
    input.specification?.generationReadiness,
  );

  const marketingMemorySummary = input.creativeBrief
    ? `Campaign memory items ${input.workingContext.sourceSummary.activeMemoryCount}; repetition warnings ${input.creativeBrief.memoryConstraints.repetitionWarnings.length}; duplicate-risk notes ${input.creativeBrief.memoryConstraints.duplicateRiskMessages.length}.`
    : "No campaign-specific creative brief was selected, so memory guidance was not passed into this run.";
  const seasonalSummary = input.creativeBrief
    ? compactText([
        `Readiness ${input.creativeBrief.readiness}.`,
        input.creativeBrief.seasonalContext.urgencyGuidance
          ? `Urgency: ${input.creativeBrief.seasonalContext.urgencyGuidance}.`
          : "No urgency guidance.",
        `Lifecycle: ${limitedList(input.creativeBrief.seasonalContext.lifecycleStates, 3, "none")}.`,
        input.creativeBrief.seasonalContext.timingWarnings.length > 0
          ? `Timing warnings: ${limitedList(input.creativeBrief.seasonalContext.timingWarnings, 2, "none")}.`
          : null,
      ])
    : "No campaign-specific seasonal intelligence was selected for this run.";
  const assetIntelligenceSummary = input.creativeBrief
    ? `Recommended assets ${input.creativeBrief.contentStrategy.recommendedAssetIds.length}; required new assets ${input.creativeBrief.contentStrategy.requiredNewAssets.length}; missing assets ${input.creativeBrief.missingAssets.length}.`
    : "No campaign-specific asset intelligence was selected for this run.";
  const campaignPlannerSummary = input.creativeBrief
    ? `Rank ${input.creativeBrief.plannerRank}; score ${input.creativeBrief.plannerScore}; planner status ${input.creativeBrief.plannerStatus}.`
    : "No campaign-planner result was selected for this run.";
  const creativeBriefSummary = input.creativeBrief
    ? `Readiness ${input.creativeBrief.readiness}; safe claims ${input.creativeBrief.safeFactualClaims.length}; missing facts ${input.creativeBrief.missingFacts.length}; missing assets ${input.creativeBrief.missingAssets.length}.`
    : "No campaign-specific creative brief was selected for this run.";
  const contentSpecSummary = input.specification
    ? `Readiness ${input.specification.generationReadiness}; allowed claims ${input.specification.allowedFactualClaims.length}; missing inputs ${input.specification.missingInputs.length}; review gates ${input.specification.reviewGates.length}.`
    : "No campaign-specific content draft specification was selected for this run.";

  const modules: SocialDraftWorkflowModule[] = [
    createModule(
      "theme_library",
      "Theme Library",
      input.themeContext ? "passed" : "empty",
      themeSummary,
    ),
    createModule(
      "approved_asset",
      "Approved Asset",
      input.approvedAsset ? "passed" : "empty",
      approvedAssetSummary,
    ),
    createModule(
      "working_context",
      "Social Working Context",
      "passed",
      workingContextSummary,
    ),
    createModule(
      "marketing_memory",
      "Marketing Memory",
      creativeBriefStatus,
      marketingMemorySummary,
    ),
    createModule(
      "seasonal_intelligence",
      "Seasonal Intelligence",
      creativeBriefStatus,
      seasonalSummary,
    ),
    createModule(
      "asset_intelligence",
      "Asset Intelligence",
      creativeBriefStatus,
      assetIntelligenceSummary,
    ),
    createModule(
      "campaign_planner",
      "Campaign Planner",
      creativeBriefStatus,
      campaignPlannerSummary,
    ),
    createModule(
      "creative_brief",
      "Creative Brief Intelligence",
      creativeBriefStatus,
      creativeBriefSummary,
    ),
    createModule(
      "content_draft_specification",
      "Content Draft Specification",
      contentSpecStatus,
      contentSpecSummary,
    ),
  ];

  const strategistSeasonalContext = boundText(
    compactText([
      campaignPlannerSummary,
      seasonalSummary,
      contentSpecSummary,
    ]),
    AGENT_INPUT_LIMITS.seasonalContext,
  );

  const strategistAssetContext = boundText(
    compactText([
      input.approvedAsset?.metadataSummary,
      input.themeContext?.promptContext,
      assetIntelligenceSummary,
      input.specification
        ? `Asset slots: ${input.specification.assetSlots
            .map((slot) => `${slot.slotId}:${slot.requiredAssetType}:${slot.assetReadiness}`)
            .join("; ")}.`
        : null,
      input.workingContext.campaignMemory.length > 0
        ? `Campaign memory keys: ${input.workingContext.campaignMemory
            .slice(0, 3)
            .map((memory) => memory.key)
            .join(", ")}.`
        : null,
    ]),
    AGENT_INPUT_LIMITS.assetContext,
  );

  const agentContextSummary = boundText(
    modules
      .map(
        (module) =>
          `${module.label}: ${module.status.toUpperCase()}. ${module.summary}`,
      )
      .join(" "),
    1_600,
  );

  return {
    modules,
    strategistSeasonalContext,
    strategistAssetContext,
    agentContextSummary,
  };
}
