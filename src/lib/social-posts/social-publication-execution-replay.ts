import {
  validateSocialPublicationExecutionPersistenceModel,
  type SocialPublicationExecutionIntentRecord,
  type SocialPublicationExecutionPersistenceModel,
  type SocialPublicationExecutionResultRecord,
} from "./social-publication-execution-repository";

export const SOCIAL_PUBLICATION_EXECUTION_REPLAY_DIAGNOSTIC_CODES = [
  "persistence_validation_failed",
  "missing_authority",
  "preflight_not_run",
] as const;

export type SocialPublicationExecutionReplayDiagnosticCode =
  (typeof SOCIAL_PUBLICATION_EXECUTION_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialPublicationExecutionReplayDiagnostic = Readonly<{
  code: SocialPublicationExecutionReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "error" | "warning";
}>;

export type SocialPublicationExecutionJobState =
  | "pending"
  | "blocked"
  | "preflight_passed"
  | "failed"
  | "completed";

export type SocialPublicationExecutionJobProjection = Readonly<{
  executionJobId: string;
  executionIntentId: string;
  executionResultId: string | null;
  state: SocialPublicationExecutionJobState;
  socialPostId: string;
  publicationTargetId: string;
  publisherRequestId: string | null;
  publisherResultId: string | null;
  publisherJobId: string | null;
  scheduleId: string | null;
  ledgerEntryId: string | null;
  publicationManifestId: string | null;
  ownerApprovalId: string | null;
  preflightStatus: string | null;
  preflightBlockReasons: readonly string[];
  resultBlockReasons: readonly string[];
  missingAuthority: readonly string[];
  sufficientAuthorityEvidence: boolean;
  updatedAt: string;
  computedOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPublicationExecutionReplaySummary = Readonly<{
  totalJobCount: number;
  pendingJobCount: number;
  blockedJobCount: number;
  preflightPassedJobCount: number;
  failedJobCount: number;
  completedJobCount: number;
  missingAuthorityJobCount: number;
  sufficientAuthorityEvidenceJobCount: number;
  diagnosticCount: number;
  errorCount: number;
  computedOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
}>;

export type SocialPublicationExecutionReadModel = Readonly<{
  pendingJobs: readonly SocialPublicationExecutionJobProjection[];
  blockedJobs: readonly SocialPublicationExecutionJobProjection[];
  preflightPassedJobs: readonly SocialPublicationExecutionJobProjection[];
  failedJobs: readonly SocialPublicationExecutionJobProjection[];
  completedJobs: readonly SocialPublicationExecutionJobProjection[];
  jobsMissingAuthority: readonly SocialPublicationExecutionJobProjection[];
  jobsWithSufficientAuthorityEvidence: readonly SocialPublicationExecutionJobProjection[];
  diagnostics: readonly SocialPublicationExecutionReplayDiagnostic[];
  summary: SocialPublicationExecutionReplaySummary;
  replayIntegrity: Readonly<{
    valid: boolean;
    deterministic: true;
    source: "publication_execution_replay";
    computedOnly: true;
    authoritative: false;
  }>;
  computedOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
}>;

export type SocialPublicationExecutionReplayResult = Readonly<{
  ok: true;
  value: SocialPublicationExecutionReadModel;
}>;

export function replaySocialPublicationExecution(
  model: SocialPublicationExecutionPersistenceModel,
): SocialPublicationExecutionReplayResult {
  const diagnostics: SocialPublicationExecutionReplayDiagnostic[] = [];
  const validation = validateSocialPublicationExecutionPersistenceModel(model);
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

  const resultsByIntent = new Map<string, SocialPublicationExecutionResultRecord>();
  for (const result of model.results) {
    if (!resultsByIntent.has(result.execution_intent_id)) {
      resultsByIntent.set(result.execution_intent_id, result);
    }
  }

  const projections = validation.ok
    ? sortProjections(
        model.intents.map((intentRecord, index) => {
          const result = resultsByIntent.get(intentRecord.execution_intent_id) ?? null;
          const projection = projectExecutionIntent(intentRecord, result);
          if (projection.missingAuthority.length > 0) {
            diagnostics.push({
              code: "missing_authority",
              path: `intents.${index}.authority`,
              message: `Execution job is missing authority evidence: ${projection.missingAuthority.join(", ")}`,
              severity: "warning",
            });
          }
          if (!result && intentRecord.preflight_status === "not_run") {
            diagnostics.push({
              code: "preflight_not_run",
              path: `intents.${index}.preflight_status`,
              message: "Execution job has not yet been evaluated by preflight.",
              severity: "warning",
            });
          }
          return projection;
        }),
      )
    : [];

  const pendingJobs = projections.filter((job) => job.state === "pending");
  const blockedJobs = projections.filter((job) => job.state === "blocked");
  const preflightPassedJobs = projections.filter((job) => job.state === "preflight_passed");
  const failedJobs = projections.filter((job) => job.state === "failed");
  const completedJobs = projections.filter((job) => job.state === "completed");
  const jobsMissingAuthority = projections.filter((job) => job.missingAuthority.length > 0);
  const jobsWithSufficientAuthorityEvidence = projections.filter(
    (job) => job.sufficientAuthorityEvidence,
  );
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;

  return {
    ok: true,
    value: deepFreeze({
      pendingJobs,
      blockedJobs,
      preflightPassedJobs,
      failedJobs,
      completedJobs,
      jobsMissingAuthority,
      jobsWithSufficientAuthorityEvidence,
      diagnostics,
      summary: {
        totalJobCount: projections.length,
        pendingJobCount: pendingJobs.length,
        blockedJobCount: blockedJobs.length,
        preflightPassedJobCount: preflightPassedJobs.length,
        failedJobCount: failedJobs.length,
        completedJobCount: completedJobs.length,
        missingAuthorityJobCount: jobsMissingAuthority.length,
        sufficientAuthorityEvidenceJobCount: jobsWithSufficientAuthorityEvidence.length,
        diagnosticCount: diagnostics.length,
        errorCount,
        computedOnly: true,
        authoritative: false,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
        recordsNoMetrics: true,
        performsNoLearning: true,
      },
      replayIntegrity: {
        valid: errorCount === 0,
        deterministic: true,
        source: "publication_execution_replay",
        computedOnly: true,
        authoritative: false,
      },
      computedOnly: true,
      authoritative: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
      recordsNoMetrics: true,
      performsNoLearning: true,
    }),
  };
}

export function missingAuthorityForExecutionIntent(
  intent: SocialPublicationExecutionIntentRecord,
): readonly string[] {
  const missing: string[] = [];
  if (!intent.owner_approval_satisfied || !intent.scope.owner_approval_id) {
    missing.push("owner_approval");
  }
  if (!intent.publisher_authority_satisfied || !intent.scope.publisher_result_id) {
    missing.push("publisher_authority");
  }
  if (intent.preflight_status !== "passed") {
    missing.push("preflight_pass");
  }
  if (!intent.scope.publication_target_id) missing.push("publication_target");
  if (!intent.scope.schedule_id) missing.push("scheduler_intent");
  if (!intent.scope.ledger_entry_id) missing.push("ledger_evidence");
  if (!intent.scope.publication_manifest_id) missing.push("publication_manifest");
  return missing;
}

function projectExecutionIntent(
  intentRecord: SocialPublicationExecutionIntentRecord,
  result: SocialPublicationExecutionResultRecord | null,
): SocialPublicationExecutionJobProjection {
  const missingAuthority = missingAuthorityForExecutionIntent(intentRecord);
  const state = deriveJobState(intentRecord, result);

  return {
    executionJobId: intentRecord.execution_job_id,
    executionIntentId: intentRecord.execution_intent_id,
    executionResultId: result?.execution_result_id ?? null,
    state,
    socialPostId: intentRecord.scope.social_post_id,
    publicationTargetId: intentRecord.scope.publication_target_id,
    publisherRequestId: intentRecord.scope.publisher_request_id,
    publisherResultId: intentRecord.scope.publisher_result_id,
    publisherJobId: intentRecord.scope.publisher_job_id,
    scheduleId: intentRecord.scope.schedule_id,
    ledgerEntryId: intentRecord.scope.ledger_entry_id,
    publicationManifestId: intentRecord.scope.publication_manifest_id,
    ownerApprovalId: intentRecord.scope.owner_approval_id,
    preflightStatus: intentRecord.preflight_status,
    preflightBlockReasons: intentRecord.preflight_block_reasons,
    resultBlockReasons: result?.block_reasons ?? [],
    missingAuthority,
    sufficientAuthorityEvidence: missingAuthority.length === 0,
    updatedAt: result?.updated_at ?? intentRecord.updated_at,
    computedOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function deriveJobState(
  intentRecord: SocialPublicationExecutionIntentRecord,
  result: SocialPublicationExecutionResultRecord | null,
): SocialPublicationExecutionJobState {
  if (result) {
    return result.result_status;
  }

  if (intentRecord.preflight_status === "passed") return "preflight_passed";
  if (intentRecord.preflight_status === "blocked") return "blocked";
  if (intentRecord.preflight_status === "failed") return "failed";
  return "pending";
}

function sortProjections(
  projections: readonly SocialPublicationExecutionJobProjection[],
): SocialPublicationExecutionJobProjection[] {
  return [...projections].sort(
    (left, right) =>
      left.updatedAt.localeCompare(right.updatedAt) ||
      left.executionJobId.localeCompare(right.executionJobId),
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
