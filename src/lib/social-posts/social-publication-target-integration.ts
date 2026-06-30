import type {
  PublicationTargetCandidate,
  PublicationTargetSelectionIssue,
  PublicationTargetSelectionResult,
} from "./social-publication-target-selection";
import type {
  PublicationTargetCapability,
  PublicationTargetPlatform,
  PublicationTargetSelectionSnapshot,
  PublicationTargetType,
} from "./social-publication-targets";

export type PublicationTargetIntegrationIssue = Readonly<{
  targetId: string | null;
  platform: PublicationTargetPlatform | null;
  code: string;
  path: string;
  message: string;
  nonAuthoritative: true;
}>;

export type PublicationTargetIntegrationTarget = Readonly<{
  targetId: string;
  platform: PublicationTargetPlatform;
  targetType: PublicationTargetType;
  displayName: string;
  externalId: string;
  capabilitySummary: PublicationTargetCapability;
  selected: boolean;
  computedOnly: true;
  authoritative: false;
  grantsPublishingPermission: false;
  notPublicationPermission: true;
  publishesNothing: true;
  schedulesNothing: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
}>;

export type PublicationTargetIntegrationSummary = Readonly<{
  available: boolean;
  targets: readonly PublicationTargetIntegrationTarget[];
  issues: readonly PublicationTargetIntegrationIssue[];
  candidateCount: number;
  selectedTargetCount: number;
  computedOnly: true;
  authoritative: false;
  grantsPublishingPermission: false;
  notPublicationPermission: true;
  publishesNothing: true;
  schedulesNothing: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
  implementsScheduler: false;
  implementsLedger: false;
  recordsAttempts: false;
  recordsOutcomes: false;
}>;

export type PublicationTargetIntegrationInput = Readonly<{
  selection: PublicationTargetSelectionResult | null;
  snapshots: readonly PublicationTargetSelectionSnapshot[];
}>;

export type PublicationTargetIntegrationResult = Readonly<{
  ok: true;
  summary: PublicationTargetIntegrationSummary;
}>;

export function buildPublicationTargetIntegrationSummary(
  input: PublicationTargetIntegrationInput,
): PublicationTargetIntegrationResult {
  if (!input.selection) {
    return {
      ok: true,
      summary: buildPublicationTargetIntegrationUnavailable(),
    };
  }

  const targets = input.snapshots.map(integrationTargetFromSnapshot);
  const issues = [
    ...input.selection.issues.map((issue) => integrationIssueFromSelectionIssue(null, issue)),
    ...input.selection.candidates.flatMap((candidate) =>
      candidate.selectable
        ? []
        : candidate.issues.map((issue) =>
            integrationIssueFromSelectionIssue(candidate, issue),
          ),
    ),
  ];

  return {
    ok: true,
    summary: integrationSummary({
      available: targets.length > 0,
      targets,
      issues,
      candidateCount: input.selection.candidates.length,
      selectedTargetCount: targets.length,
    }),
  };
}

export function buildPublicationTargetIntegrationUnavailable(): PublicationTargetIntegrationSummary {
  return integrationSummary({
    available: false,
    targets: [],
    issues: [],
    candidateCount: 0,
    selectedTargetCount: 0,
  });
}

function integrationTargetFromSnapshot(
  snapshot: PublicationTargetSelectionSnapshot,
): PublicationTargetIntegrationTarget {
  return {
    targetId: snapshot.targetId,
    platform: snapshot.platform,
    targetType: snapshot.targetType,
    displayName: snapshot.displayName,
    externalId: snapshot.externalId,
    capabilitySummary: snapshot.capabilitySummary,
    selected: true,
    computedOnly: true,
    authoritative: false,
    grantsPublishingPermission: false,
    notPublicationPermission: true,
    publishesNothing: true,
    schedulesNothing: true,
    recordsNoMetrics: true,
    performsNoLearning: true,
  };
}

function integrationIssueFromSelectionIssue(
  candidate: PublicationTargetCandidate | null,
  issue: PublicationTargetSelectionIssue,
): PublicationTargetIntegrationIssue {
  return {
    targetId: candidate?.target.targetId ?? null,
    platform: candidate?.target.platform ?? null,
    code: issue.code,
    path: issue.path,
    message: issue.message,
    nonAuthoritative: true,
  };
}

function integrationSummary(input: {
  available: boolean;
  targets: readonly PublicationTargetIntegrationTarget[];
  issues: readonly PublicationTargetIntegrationIssue[];
  candidateCount: number;
  selectedTargetCount: number;
}): PublicationTargetIntegrationSummary {
  return {
    available: input.available,
    targets: input.targets,
    issues: input.issues,
    candidateCount: input.candidateCount,
    selectedTargetCount: input.selectedTargetCount,
    computedOnly: true,
    authoritative: false,
    grantsPublishingPermission: false,
    notPublicationPermission: true,
    publishesNothing: true,
    schedulesNothing: true,
    recordsNoMetrics: true,
    performsNoLearning: true,
    implementsScheduler: false,
    implementsLedger: false,
    recordsAttempts: false,
    recordsOutcomes: false,
  };
}
