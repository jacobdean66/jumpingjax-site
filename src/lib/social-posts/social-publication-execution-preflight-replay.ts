import {
  evaluateSocialPublicationExecutionPreflight,
  type SocialPublicationExecutionPreflightEvaluation,
} from "./social-publication-execution-preflight";
import {
  replaySocialPublicationExecution,
  type SocialPublicationExecutionJobProjection,
} from "./social-publication-execution-replay";
import {
  validateSocialPublicationExecutionPersistenceModel,
  type SocialPublicationExecutionIntentRecord,
  type SocialPublicationExecutionPersistenceModel,
  type SocialPublicationExecutionResultRecord,
} from "./social-publication-execution-repository";

export const SOCIAL_PUBLICATION_EXECUTION_PREFLIGHT_REPLAY_DIAGNOSTIC_CODES = [
  "persistence_validation_failed",
  "preflight_reference_stale",
  "result_reference_stale",
  "result_scope_stale",
] as const;

export type SocialPublicationExecutionPreflightReplayDiagnosticCode =
  (typeof SOCIAL_PUBLICATION_EXECUTION_PREFLIGHT_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialPublicationExecutionPreflightReplayDiagnostic = Readonly<{
  code: SocialPublicationExecutionPreflightReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "error" | "warning";
}>;

export type SocialPublicationExecutionPreflightJobProjection = Readonly<{
  executionJobId: string;
  executionIntentId: string;
  executionResultId: string | null;
  replayState: SocialPublicationExecutionJobProjection["state"];
  preflightStatus: "pass" | "block";
  diagnostics: SocialPublicationExecutionPreflightEvaluation["diagnostics"];
  missingReferences: readonly string[];
  missingAuthority: readonly string[];
  blockedStates: readonly string[];
  staleReferences: readonly string[];
  unsafe: boolean;
  authorityPresent: Readonly<{
    owner: boolean;
    publisher: boolean;
  }>;
  evidencePresent: Readonly<{
    intent: boolean;
    result: boolean;
    ledger: boolean;
    preflight: boolean;
  }>;
  couldRunLater: boolean;
  updatedAt: string;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPublicationExecutionPreflightReplaySummary = Readonly<{
  totalJobCount: number;
  preflightPassJobCount: number;
  preflightBlockedJobCount: number;
  missingReferenceJobCount: number;
  authorityBlockedJobCount: number;
  staleReferenceJobCount: number;
  unsafeJobCount: number;
  diagnosticCount: number;
  errorCount: number;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPublicationExecutionPreflightReadModel = Readonly<{
  preflightPassJobs: readonly SocialPublicationExecutionPreflightJobProjection[];
  preflightBlockedJobs: readonly SocialPublicationExecutionPreflightJobProjection[];
  missingReferenceJobs: readonly SocialPublicationExecutionPreflightJobProjection[];
  authorityBlockedJobs: readonly SocialPublicationExecutionPreflightJobProjection[];
  staleReferenceJobs: readonly SocialPublicationExecutionPreflightJobProjection[];
  unsafeJobs: readonly SocialPublicationExecutionPreflightJobProjection[];
  diagnostics: readonly SocialPublicationExecutionPreflightReplayDiagnostic[];
  summary: SocialPublicationExecutionPreflightReplaySummary;
  replayIntegrity: Readonly<{
    valid: boolean;
    deterministic: true;
    source: "publication_execution_preflight_replay";
    computedOnly: true;
    authoritative: false;
  }>;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPublicationExecutionPreflightReplayResult = Readonly<{
  ok: true;
  value: SocialPublicationExecutionPreflightReadModel;
}>;

export function replaySocialPublicationExecutionPreflight(
  model: SocialPublicationExecutionPersistenceModel,
): SocialPublicationExecutionPreflightReplayResult {
  const diagnostics: SocialPublicationExecutionPreflightReplayDiagnostic[] = [];
  const readableModel = readablePersistenceModel(model);
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

  const executionReplay = readableModel
    ? replaySocialPublicationExecution(model).value
    : null;
  const replayJobsByIntent = new Map(
    executionReplay
      ? [
          ...executionReplay.pendingJobs,
          ...executionReplay.blockedJobs,
          ...executionReplay.preflightPassedJobs,
          ...executionReplay.failedJobs,
          ...executionReplay.completedJobs,
        ].map((job) => [job.executionIntentId, job])
      : [],
  );
  const resultsByIntent = new Map<string, SocialPublicationExecutionResultRecord>();
  for (const result of readableModel?.results ?? []) {
    if (!resultsByIntent.has(result.execution_intent_id)) {
      resultsByIntent.set(result.execution_intent_id, result);
    }
  }

  const projections = readableModel
    ? sortPreflightJobs(
        readableModel.intents.map((intent, index) => {
          const result = resultsByIntent.get(intent.execution_intent_id) ?? null;
          const evaluation = evaluateSocialPublicationExecutionPreflight(intent, result);
          const staleReferences = staleReferenceReasons(intent, result);
          for (const reason of staleReferences) {
            diagnostics.push(staleDiagnostic(reason, index));
          }

          const replayJob = replayJobsByIntent.get(intent.execution_intent_id);
          return projectPreflightJob(
            intent,
            result,
            evaluation,
            staleReferences,
            replayJob,
          );
        }),
      )
    : [];

  const preflightPassJobs = projections.filter(
    (job) => job.preflightStatus === "pass" && job.staleReferences.length === 0,
  );
  const preflightBlockedJobs = projections.filter(
    (job) => job.preflightStatus === "block",
  );
  const missingReferenceJobs = projections.filter(
    (job) => job.missingReferences.length > 0,
  );
  const authorityBlockedJobs = projections.filter(
    (job) => job.missingAuthority.length > 0,
  );
  const staleReferenceJobs = projections.filter(
    (job) => job.staleReferences.length > 0,
  );
  const unsafeJobs = projections.filter((job) => job.unsafe);
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;

  return {
    ok: true,
    value: deepFreeze({
      preflightPassJobs,
      preflightBlockedJobs,
      missingReferenceJobs,
      authorityBlockedJobs,
      staleReferenceJobs,
      unsafeJobs,
      diagnostics,
      summary: {
        totalJobCount: projections.length,
        preflightPassJobCount: preflightPassJobs.length,
        preflightBlockedJobCount: preflightBlockedJobs.length,
        missingReferenceJobCount: missingReferenceJobs.length,
        authorityBlockedJobCount: authorityBlockedJobs.length,
        staleReferenceJobCount: staleReferenceJobs.length,
        unsafeJobCount: unsafeJobs.length,
        diagnosticCount: diagnostics.length,
        errorCount,
        computedOnly: true,
        readOnly: true,
        authoritative: false,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
      replayIntegrity: {
        valid: errorCount === 0,
        deterministic: true,
        source: "publication_execution_preflight_replay",
        computedOnly: true,
        authoritative: false,
      },
      computedOnly: true,
      readOnly: true,
      authoritative: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    }),
  };
}

function readablePersistenceModel(
  model: SocialPublicationExecutionPersistenceModel,
): SocialPublicationExecutionPersistenceModel | null {
  const candidate = model as Readonly<{
    intents?: unknown;
    results?: unknown;
  }>;
  if (!Array.isArray(candidate.intents) || !Array.isArray(candidate.results)) {
    return null;
  }

  return {
    intents: candidate.intents as readonly SocialPublicationExecutionIntentRecord[],
    results: candidate.results as readonly SocialPublicationExecutionResultRecord[],
  };
}

function projectPreflightJob(
  intent: SocialPublicationExecutionIntentRecord,
  result: SocialPublicationExecutionResultRecord | null,
  evaluation: SocialPublicationExecutionPreflightEvaluation,
  staleReferences: readonly string[],
  replayJob: SocialPublicationExecutionJobProjection | undefined,
): SocialPublicationExecutionPreflightJobProjection {
  return {
    executionJobId: intent.execution_job_id,
    executionIntentId: intent.execution_intent_id,
    executionResultId: result?.execution_result_id ?? null,
    replayState: replayJob?.state ?? "pending",
    preflightStatus: evaluation.status,
    diagnostics: evaluation.diagnostics,
    missingReferences: evaluation.missingReferences,
    missingAuthority: evaluation.authority.missingAuthority,
    blockedStates: evaluation.blockedStates,
    staleReferences,
    unsafe: evaluation.diagnostics.some((diagnostic) => diagnostic.category === "unsafe"),
    authorityPresent: {
      owner: evaluation.authority.ownerAuthorityPresent,
      publisher: evaluation.authority.publisherAuthorityPresent,
    },
    evidencePresent: {
      intent: evaluation.evidence.intentEvidencePresent,
      result: evaluation.evidence.resultEvidencePresent,
      ledger: evaluation.evidence.ledgerEvidencePresent,
      preflight: evaluation.evidence.preflightEvidencePresent,
    },
    couldRunLater:
      evaluation.couldRunLater &&
      staleReferences.length === 0 &&
      result?.result_status !== "completed",
    updatedAt: result?.updated_at ?? intent.updated_at,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function staleReferenceReasons(
  intent: SocialPublicationExecutionIntentRecord,
  result: SocialPublicationExecutionResultRecord | null,
): readonly string[] {
  const reasons: string[] = [];
  if (
    intent.preflight_evaluated_at &&
    Date.parse(intent.preflight_evaluated_at) < Date.parse(intent.updated_at)
  ) {
    reasons.push("preflight_evaluated_before_latest_intent_update");
  }
  if (result && Date.parse(result.updated_at) < Date.parse(intent.updated_at)) {
    reasons.push("result_recorded_before_latest_intent_update");
  }
  if (result && !sameScope(intent, result)) {
    reasons.push("result_scope_differs_from_intent_scope");
  }
  return reasons;
}

function staleDiagnostic(
  reason: string,
  index: number,
): SocialPublicationExecutionPreflightReplayDiagnostic {
  const code: SocialPublicationExecutionPreflightReplayDiagnosticCode =
    reason === "preflight_evaluated_before_latest_intent_update"
      ? "preflight_reference_stale"
      : reason === "result_scope_differs_from_intent_scope"
        ? "result_scope_stale"
        : "result_reference_stale";

  return {
    code,
    path: `intents.${index}`,
    message: `Execution preflight found stale reference evidence: ${reason}.`,
    severity: "warning",
  };
}

function sameScope(
  intent: SocialPublicationExecutionIntentRecord,
  result: SocialPublicationExecutionResultRecord,
): boolean {
  return (
    intent.scope.social_post_id === result.scope.social_post_id &&
    intent.scope.publication_target_id === result.scope.publication_target_id &&
    intent.scope.publisher_request_id === result.scope.publisher_request_id &&
    intent.scope.publisher_result_id === result.scope.publisher_result_id &&
    intent.scope.publisher_job_id === result.scope.publisher_job_id &&
    intent.scope.schedule_id === result.scope.schedule_id &&
    intent.scope.ledger_entry_id === result.scope.ledger_entry_id &&
    intent.scope.publication_manifest_id === result.scope.publication_manifest_id &&
    intent.scope.owner_approval_id === result.scope.owner_approval_id &&
    intent.scope.approval_id === result.scope.approval_id &&
    intent.scope.metric_observation_id === result.scope.metric_observation_id &&
    intent.scope.learning_insight_id === result.scope.learning_insight_id &&
    intent.scope.campaign_memory_id === result.scope.campaign_memory_id &&
    intent.scope.decision_history_id === result.scope.decision_history_id
  );
}

function sortPreflightJobs(
  jobs: readonly SocialPublicationExecutionPreflightJobProjection[],
): SocialPublicationExecutionPreflightJobProjection[] {
  return [...jobs].sort(
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
