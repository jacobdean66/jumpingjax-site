import {
  evaluatePublicationTargetCapabilities,
  type PublicationTargetCapabilityEvaluation,
  type PublicationTargetCapabilityEvaluationIssue,
  type PublicationTargetCopyShape,
  type PublicationTargetMediaShape,
} from "./social-publication-target-capabilities";
import {
  buildPublicationTargetSelectionSnapshot,
  isPublicationTargetPlatform,
  validatePublicationTargetSelectionSnapshot,
  type PublicationTargetDefinition,
  type PublicationTargetPlatform,
  type PublicationTargetSelectionSnapshot,
  type PublicationTargetValidationError,
} from "./social-publication-targets";

export const PUBLICATION_TARGET_SELECTION_ISSUE_CODES = [
  "destination_hint_missing",
  "target_disabled",
  "platform_mismatch",
  "capability_mismatch",
  "snapshot_validation_failed",
] as const;

export type PublicationTargetSelectionIssueCode =
  (typeof PUBLICATION_TARGET_SELECTION_ISSUE_CODES)[number];

export type PublicationTargetSelectionIssue = Readonly<{
  code: PublicationTargetSelectionIssueCode;
  path: string;
  message: string;
  capabilityIssues?: readonly PublicationTargetCapabilityEvaluationIssue[];
  snapshotErrors?: readonly PublicationTargetValidationError[];
}>;

export type PublicationTargetCandidate = Readonly<{
  target: PublicationTargetDefinition;
  requestedPlatform: PublicationTargetPlatform;
  selectable: boolean;
  issues: readonly PublicationTargetSelectionIssue[];
  capabilityEvaluation: PublicationTargetCapabilityEvaluation;
  computedOnly: true;
  authoritative: false;
  grantsPublishingPermission: false;
  publishesNothing: true;
  schedulesNothing: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
}>;

export type PublicationTargetSelectionResult = Readonly<{
  candidates: readonly PublicationTargetCandidate[];
  selectableCandidates: readonly PublicationTargetCandidate[];
  issues: readonly PublicationTargetSelectionIssue[];
  computedOnly: true;
  authoritative: false;
  grantsPublishingPermission: false;
  publishesNothing: true;
  schedulesNothing: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
}>;

export type PublicationTargetSnapshotBuildResult = Readonly<
  | {
      ok: true;
      snapshots: readonly PublicationTargetSelectionSnapshot[];
      issues: readonly [];
      computedOnly: true;
      authoritative: false;
      grantsPublishingPermission: false;
      publishesNothing: true;
      schedulesNothing: true;
      recordsNoMetrics: true;
      performsNoLearning: true;
    }
  | {
      ok: false;
      snapshots: readonly PublicationTargetSelectionSnapshot[];
      issues: readonly PublicationTargetSelectionIssue[];
      computedOnly: true;
      authoritative: false;
      grantsPublishingPermission: false;
      publishesNothing: true;
      schedulesNothing: true;
      recordsNoMetrics: true;
      performsNoLearning: true;
    }
>;

export type PublicationTargetSelectionManifest = Readonly<{
  content: Readonly<{
    caption: string | null;
    mediaType: string | null;
  }>;
  assets: Readonly<{
    approvedImageUrl: string | null;
    generatedImageUrl: string | null;
    mediaUrl: string | null;
    sourceImageUrl: string | null;
    selected: readonly Readonly<{ isRejected: boolean }>[];
    approved: readonly Readonly<{ isRejected: boolean }>[];
  }>;
  destinations: Readonly<{
    platforms: readonly string[];
  }>;
}>;

export type PublicationTargetSelectionInput = Readonly<{
  manifest: PublicationTargetSelectionManifest;
  configuredTargets: readonly PublicationTargetDefinition[];
}>;

export function selectPublicationTargetCandidates(
  input: PublicationTargetSelectionInput,
): PublicationTargetSelectionResult {
  const requestedPlatforms = destinationPlatforms(input.manifest);
  const media = mediaShapeFromManifest(input.manifest);
  const copy = copyShapeFromManifest(input.manifest);
  const issues: PublicationTargetSelectionIssue[] = [];

  if (requestedPlatforms.length === 0) {
    issues.push(
      selectionIssue({
        code: "destination_hint_missing",
        path: "manifest.destinations.platforms",
        message: "Publication target selection requires at least one destination hint.",
      }),
    );
  }

  const candidates = input.configuredTargets
    .flatMap((target) =>
      requestedPlatforms.map((requestedPlatform) =>
        buildCandidate({
          target,
          requestedPlatform,
          media,
          copy,
        }),
      ),
    )
    .sort(compareCandidates);
  const selectableCandidates = candidates.filter((candidate) => candidate.selectable);

  return {
    candidates,
    selectableCandidates,
    issues,
    computedOnly: true,
    authoritative: false,
    grantsPublishingPermission: false,
    publishesNothing: true,
    schedulesNothing: true,
    recordsNoMetrics: true,
    performsNoLearning: true,
  };
}

export function buildPublicationTargetSelectionSnapshots(
  candidates: readonly PublicationTargetCandidate[],
  references: PublicationTargetSelectionSnapshot["references"] = {},
): PublicationTargetSnapshotBuildResult {
  const snapshots: PublicationTargetSelectionSnapshot[] = [];
  const issues: PublicationTargetSelectionIssue[] = [];

  for (const candidate of [...candidates].filter((item) => item.selectable).sort(compareCandidates)) {
    const snapshot = buildPublicationTargetSelectionSnapshot(candidate.target, references);
    const validation = validatePublicationTargetSelectionSnapshot(snapshot);

    if (!validation.ok) {
      issues.push(
        selectionIssue({
          code: "snapshot_validation_failed",
          path: `snapshots.${candidate.target.targetId}`,
          message: "Publication target selection snapshot failed validation.",
          snapshotErrors: validation.errors,
        }),
      );
      continue;
    }

    snapshots.push(snapshot);
  }

  return {
    ok: issues.length === 0,
    snapshots,
    issues,
    computedOnly: true,
    authoritative: false,
    grantsPublishingPermission: false,
    publishesNothing: true,
    schedulesNothing: true,
    recordsNoMetrics: true,
    performsNoLearning: true,
  } as PublicationTargetSnapshotBuildResult;
}

function buildCandidate(input: {
  target: PublicationTargetDefinition;
  requestedPlatform: PublicationTargetPlatform;
  media: PublicationTargetMediaShape;
  copy: PublicationTargetCopyShape;
}): PublicationTargetCandidate {
  const capabilityEvaluation = evaluatePublicationTargetCapabilities(input);
  const issues = selectionIssuesFromCapabilityEvaluation(capabilityEvaluation);

  return {
    target: input.target,
    requestedPlatform: input.requestedPlatform,
    selectable: capabilityEvaluation.ok,
    issues,
    capabilityEvaluation,
    computedOnly: true,
    authoritative: false,
    grantsPublishingPermission: false,
    publishesNothing: true,
    schedulesNothing: true,
    recordsNoMetrics: true,
    performsNoLearning: true,
  };
}

function selectionIssuesFromCapabilityEvaluation(
  evaluation: PublicationTargetCapabilityEvaluation,
): readonly PublicationTargetSelectionIssue[] {
  const targetDisabled = evaluation.issues.filter((issue) => issue.code === "target_disabled");
  const platformMismatch = evaluation.issues.filter((issue) => issue.code === "platform_mismatch");
  const capabilityIssues = evaluation.issues.filter(
    (issue) => issue.code !== "target_disabled" && issue.code !== "platform_mismatch",
  );
  const issues: PublicationTargetSelectionIssue[] = [];

  if (targetDisabled.length > 0) {
    issues.push(
      selectionIssue({
        code: "target_disabled",
        path: "target.enabled",
        message: "Disabled publication targets are not selectable.",
        capabilityIssues: targetDisabled,
      }),
    );
  }

  if (platformMismatch.length > 0) {
    issues.push(
      selectionIssue({
        code: "platform_mismatch",
        path: "requestedPlatform",
        message: "Publication target platform does not match the destination hint.",
        capabilityIssues: platformMismatch,
      }),
    );
  }

  if (capabilityIssues.length > 0) {
    issues.push(
      selectionIssue({
        code: "capability_mismatch",
        path: "target.capabilities",
        message: "Publication target capabilities do not satisfy the manifest content.",
        capabilityIssues,
      }),
    );
  }

  return issues;
}

function destinationPlatforms(
  manifest: PublicationTargetSelectionManifest,
): readonly PublicationTargetPlatform[] {
  return [...new Set(manifest.destinations.platforms)]
    .filter((platform): platform is PublicationTargetPlatform =>
      isPublicationTargetPlatform(platform),
    )
    .sort();
}

function mediaShapeFromManifest(
  manifest: PublicationTargetSelectionManifest,
): PublicationTargetMediaShape {
  const mediaType = manifest.content.mediaType === "video" ? "video" : "image";
  const selectedOrApproved = [...manifest.assets.selected, ...manifest.assets.approved].filter(
    (asset) => !asset.isRejected,
  );
  const fallbackMediaAvailable = Boolean(
    manifest.assets.approvedImageUrl ||
      manifest.assets.generatedImageUrl ||
      manifest.assets.mediaUrl ||
      manifest.assets.sourceImageUrl,
  );
  const hasMedia = selectedOrApproved.length > 0 || fallbackMediaAvailable;

  return {
    mediaType,
    hasMedia,
    imageCount: mediaType === "image" && hasMedia ? 1 : 0,
    videoCount: mediaType === "video" && hasMedia ? 1 : 0,
    videoDurationSeconds: null,
    aspectRatio: null,
  };
}

function copyShapeFromManifest(
  manifest: PublicationTargetSelectionManifest,
): PublicationTargetCopyShape {
  return {
    caption: manifest.content.caption,
  };
}

function compareCandidates(
  left: PublicationTargetCandidate,
  right: PublicationTargetCandidate,
): number {
  return (
    left.requestedPlatform.localeCompare(right.requestedPlatform) ||
    left.target.displayName.localeCompare(right.target.displayName) ||
    left.target.targetId.localeCompare(right.target.targetId)
  );
}

function selectionIssue(input: {
  code: PublicationTargetSelectionIssueCode;
  path: string;
  message: string;
  capabilityIssues?: readonly PublicationTargetCapabilityEvaluationIssue[];
  snapshotErrors?: readonly PublicationTargetValidationError[];
}): PublicationTargetSelectionIssue {
  return input;
}
