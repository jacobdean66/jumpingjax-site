import {
  validateSocialPublicationPublisherPersistenceModel,
  type SocialPublicationPublisherPersistenceModel,
  type SocialPublicationPublisherRequestRecord,
  type SocialPublicationPublisherResultRecord,
} from "./social-publication-publisher-repository";

export const SOCIAL_PUBLICATION_PUBLISHER_REPLAY_DIAGNOSTIC_CODES = [
  "persistence_validation_failed",
  "missing_authority",
] as const;

export type SocialPublicationPublisherReplayDiagnosticCode =
  (typeof SOCIAL_PUBLICATION_PUBLISHER_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialPublicationPublisherReplayDiagnostic = Readonly<{
  code: SocialPublicationPublisherReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "error" | "warning";
}>;

export type SocialPublicationPublisherJobProjection = Readonly<{
  publisherJobId: string;
  publisherRequestId: string;
  publisherResultId: string | null;
  state: "pending" | "blocked" | "completed" | "failed";
  channelId: string;
  channelPlatform: SocialPublicationPublisherRequestRecord["channel_platform"];
  channelType: SocialPublicationPublisherRequestRecord["channel_type"];
  socialPostId: string;
  publicationTargetId: string;
  publicationManifestId: string | null;
  scheduleId: string | null;
  ledgerEntryId: string | null;
  publicationAttemptId: string | null;
  ownerApprovalId: string | null;
  missingAuthority: readonly string[];
  sufficientAuthorityEvidence: boolean;
  updatedAt: string;
  computedOnly: true;
  authoritative: false;
  grantsPublishingPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPublicationPublisherReplaySummary = Readonly<{
  totalJobCount: number;
  pendingJobCount: number;
  blockedJobCount: number;
  completedJobCount: number;
  failedJobCount: number;
  missingAuthorityJobCount: number;
  sufficientAuthorityEvidenceJobCount: number;
  diagnosticCount: number;
  errorCount: number;
  computedOnly: true;
  authoritative: false;
  grantsPublishingPermission: false;
  executesNothing: true;
  publishesNothing: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
}>;

export type SocialPublicationPublisherReadModel = Readonly<{
  pendingJobs: readonly SocialPublicationPublisherJobProjection[];
  blockedJobs: readonly SocialPublicationPublisherJobProjection[];
  completedJobs: readonly SocialPublicationPublisherJobProjection[];
  failedJobs: readonly SocialPublicationPublisherJobProjection[];
  jobsMissingAuthority: readonly SocialPublicationPublisherJobProjection[];
  jobsWithSufficientAuthorityEvidence: readonly SocialPublicationPublisherJobProjection[];
  diagnostics: readonly SocialPublicationPublisherReplayDiagnostic[];
  summary: SocialPublicationPublisherReplaySummary;
  replayIntegrity: Readonly<{
    valid: boolean;
    deterministic: true;
    source: "publication_publisher_replay";
    computedOnly: true;
    authoritative: false;
  }>;
  computedOnly: true;
  authoritative: false;
  grantsPublishingPermission: false;
  executesNothing: true;
  publishesNothing: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
}>;

export type SocialPublicationPublisherReplayResult = Readonly<{
  ok: true;
  value: SocialPublicationPublisherReadModel;
}>;

export function replaySocialPublicationPublisher(
  model: SocialPublicationPublisherPersistenceModel,
): SocialPublicationPublisherReplayResult {
  const diagnostics: SocialPublicationPublisherReplayDiagnostic[] = [];
  const validation = validateSocialPublicationPublisherPersistenceModel(model);
  if (!validation.ok) {
    for (const validationError of validation.errors) {
      diagnostics.push({
        code: "persistence_validation_failed",
        path: validationError.path,
        message: validationError.message,
        severity: "error",
      });
    }
  }

  const resultsByRequest = new Map<string, SocialPublicationPublisherResultRecord>();
  for (const result of model.results) {
    if (!resultsByRequest.has(result.publisher_request_id)) {
      resultsByRequest.set(result.publisher_request_id, result);
    }
  }

  const projections = validation.ok
    ? sortProjections(
        model.requests.map((request, index) => {
          const result = resultsByRequest.get(request.publisher_request_id) ?? null;
          const projection = projectPublisherRequest(request, result);
          if (projection.missingAuthority.length > 0) {
            diagnostics.push({
              code: "missing_authority",
              path: `requests.${index}.authority`,
              message: `Publisher job is missing authority evidence: ${projection.missingAuthority.join(", ")}`,
              severity: "warning",
            });
          }
          return projection;
        }),
      )
    : [];

  const pendingJobs = projections.filter((job) => job.state === "pending");
  const blockedJobs = projections.filter((job) => job.state === "blocked");
  const completedJobs = projections.filter((job) => job.state === "completed");
  const failedJobs = projections.filter((job) => job.state === "failed");
  const jobsMissingAuthority = projections.filter((job) => job.missingAuthority.length > 0);
  const jobsWithSufficientAuthorityEvidence = projections.filter(
    (job) => job.sufficientAuthorityEvidence,
  );
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error")
    .length;

  return {
    ok: true,
    value: deepFreeze({
      pendingJobs,
      blockedJobs,
      completedJobs,
      failedJobs,
      jobsMissingAuthority,
      jobsWithSufficientAuthorityEvidence,
      diagnostics,
      summary: {
        totalJobCount: projections.length,
        pendingJobCount: pendingJobs.length,
        blockedJobCount: blockedJobs.length,
        completedJobCount: completedJobs.length,
        failedJobCount: failedJobs.length,
        missingAuthorityJobCount: jobsMissingAuthority.length,
        sufficientAuthorityEvidenceJobCount: jobsWithSufficientAuthorityEvidence.length,
        diagnosticCount: diagnostics.length,
        errorCount,
        computedOnly: true,
        authoritative: false,
        grantsPublishingPermission: false,
        executesNothing: true,
        publishesNothing: true,
        recordsNoMetrics: true,
        performsNoLearning: true,
      },
      replayIntegrity: {
        valid: errorCount === 0,
        deterministic: true,
        source: "publication_publisher_replay",
        computedOnly: true,
        authoritative: false,
      },
      computedOnly: true,
      authoritative: false,
      grantsPublishingPermission: false,
      executesNothing: true,
      publishesNothing: true,
      recordsNoMetrics: true,
      performsNoLearning: true,
    }),
  };
}

export function missingAuthorityForPublisherRequest(
  request: SocialPublicationPublisherRequestRecord,
): readonly string[] {
  const missing: string[] = [];
  if (!request.owner_approval_satisfied || !request.scope.owner_approval_id) {
    missing.push("owner_approval");
  }
  if (!request.scope.publication_target_id) missing.push("publication_target");
  if (!request.scope.schedule_id) missing.push("scheduler_intent");
  if (!request.scope.ledger_entry_id) missing.push("ledger_evidence");
  if (!request.scope.publication_manifest_id) missing.push("publication_manifest");
  return missing;
}

function projectPublisherRequest(
  request: SocialPublicationPublisherRequestRecord,
  result: SocialPublicationPublisherResultRecord | null,
): SocialPublicationPublisherJobProjection {
  const missingAuthority = missingAuthorityForPublisherRequest(request);
  const state = result
    ? result.result_status === "prepared"
      ? "completed"
      : "failed"
    : missingAuthority.length > 0
      ? "blocked"
      : "pending";

  return {
    publisherJobId: request.publisher_job_id,
    publisherRequestId: request.publisher_request_id,
    publisherResultId: result?.publisher_result_id ?? null,
    state,
    channelId: request.channel_id,
    channelPlatform: request.channel_platform,
    channelType: request.channel_type,
    socialPostId: request.scope.social_post_id,
    publicationTargetId: request.scope.publication_target_id,
    publicationManifestId: request.scope.publication_manifest_id,
    scheduleId: request.scope.schedule_id,
    ledgerEntryId: request.scope.ledger_entry_id,
    publicationAttemptId: request.scope.publication_attempt_id,
    ownerApprovalId: request.scope.owner_approval_id,
    missingAuthority,
    sufficientAuthorityEvidence: missingAuthority.length === 0,
    updatedAt: result?.updated_at ?? request.updated_at,
    computedOnly: true,
    authoritative: false,
    grantsPublishingPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function sortProjections(
  projections: readonly SocialPublicationPublisherJobProjection[],
): SocialPublicationPublisherJobProjection[] {
  return [...projections].sort(
    (left, right) =>
      left.updatedAt.localeCompare(right.updatedAt) ||
      left.publisherJobId.localeCompare(right.publisherJobId),
  );
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }

  return Object.freeze(value);
}
