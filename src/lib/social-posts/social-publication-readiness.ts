import "server-only";

import {
  buildPublicationManifest,
  type PublicationManifest,
} from "./social-publication-manifest";

export const PUBLICATION_READINESS_STATES = [
  "blocked",
  "ready_for_approval",
] as const;

export const PUBLICATION_READINESS_SEVERITIES = [
  "blocker",
  "warning",
] as const;

export const PUBLICATION_READINESS_ISSUE_SOURCES = [
  "manifest",
  "identity",
  "post",
  "campaign",
  "content",
  "asset",
  "destination",
  "decision_history",
  "working_context",
] as const;

export type PublicationReadinessState =
  (typeof PUBLICATION_READINESS_STATES)[number];
export type PublicationReadinessSeverity =
  (typeof PUBLICATION_READINESS_SEVERITIES)[number];
export type PublicationReadinessIssueSource =
  (typeof PUBLICATION_READINESS_ISSUE_SOURCES)[number];

export type PublicationReadinessIssue = {
  code: string;
  severity: PublicationReadinessSeverity;
  source: PublicationReadinessIssueSource;
  label: string;
  detail: string;
};

export type PublicationReadinessNextAction =
  | "fix_blockers"
  | "request_owner_approval";

export type PublicationReadinessConstraints = {
  derivedEphemeral: true;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  approvesNothing: true;
  publishesNothing: true;
  schedulesNothing: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
};

// D6.1 invariants:
// - Publication Readiness is computed from a Publication Manifest and is never stored.
// - It only answers whether the manifest is complete enough to request owner approval.
// - It does not approve, fingerprint, publish, schedule, write ledger events,
//   create targets, record metrics, perform learning, or grant authority.
export type PublicationReadiness = {
  manifest: PublicationManifest | null;
  state: PublicationReadinessState;
  blockers: PublicationReadinessIssue[];
  warnings: PublicationReadinessIssue[];
  nextAction: PublicationReadinessNextAction;
  constraints: PublicationReadinessConstraints;
};

const READINESS_CONSTRAINTS: PublicationReadinessConstraints = {
  derivedEphemeral: true,
  computedOnly: true,
  readOnly: true,
  authoritative: false,
  approvesNothing: true,
  publishesNothing: true,
  schedulesNothing: true,
  recordsNoMetrics: true,
  performsNoLearning: true,
};

function issue(input: {
  code: string;
  severity: PublicationReadinessSeverity;
  source: PublicationReadinessIssueSource;
  label: string;
  detail: string;
}): PublicationReadinessIssue {
  return input;
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function hasUsableAsset(manifest: PublicationManifest): boolean {
  const assets = [...manifest.assets.selected, ...manifest.assets.approved];
  return assets.some((asset) => hasText(asset.url) || hasText(asset.storagePath));
}

function hasFallbackMedia(manifest: PublicationManifest): boolean {
  if (manifest.content.mediaType === "video") {
    return hasText(manifest.assets.mediaUrl);
  }

  return (
    hasText(manifest.assets.approvedImageUrl) ||
    hasText(manifest.assets.generatedImageUrl) ||
    hasText(manifest.assets.mediaUrl) ||
    hasText(manifest.assets.sourceImageUrl)
  );
}

function readinessResult(input: {
  manifest: PublicationManifest | null;
  blockers: PublicationReadinessIssue[];
  warnings: PublicationReadinessIssue[];
}): PublicationReadiness {
  return {
    manifest: input.manifest,
    state: input.blockers.length > 0 ? "blocked" : "ready_for_approval",
    blockers: input.blockers,
    warnings: input.warnings,
    nextAction:
      input.blockers.length > 0 ? "fix_blockers" : "request_owner_approval",
    constraints: READINESS_CONSTRAINTS,
  };
}

export function evaluatePublicationReadiness(
  manifest: PublicationManifest | null | undefined,
): PublicationReadiness {
  const blockers: PublicationReadinessIssue[] = [];
  const warnings: PublicationReadinessIssue[] = [];

  if (!manifest) {
    blockers.push(
      issue({
        code: "manifest_missing",
        severity: "blocker",
        source: "manifest",
        label: "Manifest missing",
        detail: "A publication manifest is required before readiness can be computed.",
      }),
    );
    return readinessResult({ manifest: null, blockers, warnings });
  }

  if (!hasText(manifest.identity.socialPostId)) {
    blockers.push(
      issue({
        code: "identity_missing",
        severity: "blocker",
        source: "identity",
        label: "Social post identity missing",
        detail: "The manifest must reference a social post before approval can be requested.",
      }),
    );
  }

  if (manifest.source.status === "rejected" || manifest.source.status === "failed") {
    blockers.push(
      issue({
        code: "post_not_publishable",
        severity: "blocker",
        source: "post",
        label: "Post is not publishable",
        detail: `The social post status is ${manifest.source.status}.`,
      }),
    );
  }

  if (manifest.content.mediaType !== "image" && manifest.content.mediaType !== "video") {
    blockers.push(
      issue({
        code: "invalid_media_type",
        severity: "blocker",
        source: "content",
        label: "Invalid media type",
        detail: "The manifest media type must be image or video.",
      }),
    );
  }

  if (!hasText(manifest.content.caption)) {
    blockers.push(
      issue({
        code: "caption_missing",
        severity: "blocker",
        source: "content",
        label: "Caption missing",
        detail: "A caption is required before owner approval can be requested.",
      }),
    );
  }

  if (manifest.destinations.platforms.length === 0) {
    blockers.push(
      issue({
        code: "destination_missing",
        severity: "blocker",
        source: "destination",
        label: "Destination missing",
        detail: "At least one destination platform is required.",
      }),
    );
  }

  const usableAsset = hasUsableAsset(manifest);
  const fallbackMedia = hasFallbackMedia(manifest);
  if (!usableAsset && !fallbackMedia) {
    blockers.push(
      issue({
        code: "media_missing",
        severity: "blocker",
        source: "asset",
        label: "Media missing",
        detail: "A selected/approved asset or existing media reference is required.",
      }),
    );
    blockers.push(
      issue({
        code: "selected_or_approved_asset_missing",
        severity: "blocker",
        source: "asset",
        label: "Selected or approved asset missing",
        detail: "No selected or approved asset is available for this manifest.",
      }),
    );
  } else if (!usableAsset && fallbackMedia) {
    warnings.push(
      issue({
        code: "fallback_media_used",
        severity: "warning",
        source: "asset",
        label: "Using fallback media",
        detail: "The manifest has media references but no selected or approved asset row.",
      }),
    );
  }

  if (!manifest.campaign.campaignId) {
    warnings.push(
      issue({
        code: "campaign_uncategorized",
        severity: "warning",
        source: "campaign",
        label: "No campaign assigned",
        detail: "This manifest is scoped to no campaign / uncategorized work.",
      }),
    );
  } else if (!manifest.campaign.label) {
    warnings.push(
      issue({
        code: "campaign_unknown",
        severity: "warning",
        source: "campaign",
        label: "Campaign metadata missing",
        detail: "The manifest has a campaign id but no matching campaign metadata.",
      }),
    );
  }

  if (manifest.decisionSummary.totalCount === 0) {
    warnings.push(
      issue({
        code: "decision_history_empty",
        severity: "warning",
        source: "decision_history",
        label: "No decisions recorded",
        detail: "No Decision History rows are linked to this social post.",
      }),
    );
  }

  if (manifest.workingContextSummary.activeMemoryCount === 0) {
    warnings.push(
      issue({
        code: "active_memory_missing",
        severity: "warning",
        source: "working_context",
        label: "No active campaign memory",
        detail: "Working Context found no active Campaign Memory for this scope.",
      }),
    );
  }

  if (
    manifest.workingContextSummary.contextPostCount === 0 &&
    manifest.workingContextSummary.contextDecisionCount === 0
  ) {
    warnings.push(
      issue({
        code: "working_context_empty",
        severity: "warning",
        source: "working_context",
        label: "Working Context empty",
        detail: "Working Context has no posts or decisions for this scope.",
      }),
    );
  }

  return readinessResult({ manifest, blockers, warnings });
}

export async function evaluatePublicationReadinessForPost(
  postId: string,
): Promise<PublicationReadiness> {
  try {
    return evaluatePublicationReadiness(await buildPublicationManifest(postId));
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : "Publication manifest could not be built.";
    return readinessResult({
      manifest: null,
      blockers: [
        issue({
          code: "manifest_unavailable",
          severity: "blocker",
          source: "manifest",
          label: "Manifest unavailable",
          detail,
        }),
      ],
      warnings: [],
    });
  }
}
