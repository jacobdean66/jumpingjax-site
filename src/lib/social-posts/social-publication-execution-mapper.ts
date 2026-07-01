import {
  validatePublicationExecutionIntent,
  validatePublicationExecutionResult,
  type PublicationExecutionErrorCode,
  type PublicationExecutionEvidenceReference,
  type PublicationExecutionIntent,
  type PublicationExecutionResult,
  type PublicationExecutionValidationError,
} from "./social-publication-execution";
import {
  mapPublicationExecutionIntentToIntentRecord as buildIntentRecordFromDomain,
  mapPublicationExecutionResultToResultRecord as buildResultRecordFromDomain,
  type SocialPublicationExecutionIntentId,
  type SocialPublicationExecutionIntentRecord,
  type SocialPublicationExecutionRepositoryError,
  type SocialPublicationExecutionResultId,
  type SocialPublicationExecutionResultRecord,
  type SocialPublicationExecutionScope,
} from "./social-publication-execution-repository";
import type {
  SocialPublicationExecutionEvidenceId,
  SocialPublicationExecutionEvidenceRecord,
} from "./social-publication-execution-rows";

export const SOCIAL_PUBLICATION_EXECUTION_MAPPER_ERROR_CODES = [
  "domain_validation_failed",
  "persistence_validation_failed",
  "timestamp_ordering_invalid",
  "serialization_invalid",
] as const;

export type SocialPublicationExecutionMapperErrorCode =
  (typeof SOCIAL_PUBLICATION_EXECUTION_MAPPER_ERROR_CODES)[number];

export type SocialPublicationExecutionMapperError = Readonly<{
  code: SocialPublicationExecutionMapperErrorCode;
  path: string;
  message: string;
  domainErrors?: readonly PublicationExecutionValidationError[];
  persistenceErrors?: readonly SocialPublicationExecutionRepositoryError[];
}>;

export type SocialPublicationExecutionMapperResult<T> = Readonly<
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      errors: readonly SocialPublicationExecutionMapperError[];
    }
>;

export type SocialPublicationExecutionMappedIntent = Readonly<{
  sourceIntentId: string;
  jobId: string;
  intentType: PublicationExecutionIntent["intentType"];
  intent: SocialPublicationExecutionIntentRecord;
  evidence: SocialPublicationExecutionEvidenceRecord | null;
  deterministic: true;
  persisted: false;
  referencesOnly: true;
  executesNothing: true;
  publishesNothing: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
}>;

export type SocialPublicationExecutionMappedResult = Readonly<{
  sourceResultId: string;
  sourceIntentId: string;
  jobId: string;
  resultStatus: PublicationExecutionResult["status"];
  result: SocialPublicationExecutionResultRecord;
  evidence: SocialPublicationExecutionEvidenceRecord | null;
  deterministic: true;
  persisted: false;
  referencesOnly: true;
  executesNothing: true;
  publishesNothing: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
}>;

type UnknownRecord = Readonly<Record<string, unknown>>;

const FORBIDDEN_MAPPER_STATE_KEYS = new Set([
  "accessToken",
  "access_token",
  "apiEndpoint",
  "apiKey",
  "api_key",
  "apiRequest",
  "apiResponse",
  "authHeader",
  "bridge",
  "bridgePayload",
  "bucket",
  "canExecute",
  "canPublish",
  "canSchedule",
  "client",
  "clientSecret",
  "client_secret",
  "credential",
  "credentials",
  "cron",
  "cronExpression",
  "currentExecutionStatus",
  "currentPublishStatus",
  "execute",
  "executeJob",
  "executePublication",
  "executedAt",
  "executedPostId",
  "executionPlan",
  "execution_plan",
  "executionState",
  "executionStatus",
  "externalApi",
  "externalRequest",
  "externalResponse",
  "facebookClient",
  "facebookGraphApi",
  "fetch",
  "googleApi",
  "graphClient",
  "httpClient",
  "instagramClient",
  "instagramGraphApi",
  "intervalId",
  "isExecuted",
  "isPublished",
  "jobQueue",
  "learning",
  "learningSignal",
  "ledgerBridge",
  "linkedinApi",
  "mutateApproval",
  "mutateLedger",
  "mutateManifest",
  "mutatePublisher",
  "mutateScheduler",
  "mutateTarget",
  "metrics",
  "modelFeedback",
  "networkRequest",
  "oauth",
  "objectPath",
  "password",
  "postedAt",
  "publish",
  "publishPost",
  "publishResult",
  "publishStatus",
  "publishState",
  "publishToTarget",
  "publishedAt",
  "publishedPostId",
  "publisherBridge",
  "queue",
  "queueName",
  "refreshToken",
  "refresh_token",
  "requestInit",
  "routeHandler",
  "routePath",
  "runExecution",
  "schedulerBridge",
  "sdk",
  "sdkClient",
  "secret",
  "sendPost",
  "serviceRoleClient",
  "setInterval",
  "setTimeout",
  "sql",
  "sqlMutation",
  "storage",
  "storagePath",
  "supabase",
  "supabaseClient",
  "supabaseMutation",
  "tiktokApi",
  "timerId",
  "timerReference",
  "token",
  "triggerExecution",
  "upload",
  "urlToFetch",
  "webhook",
  "worker",
  "workerId",
]);

export function validatePublicationExecutionIntentForPersistenceMapping(
  intent: unknown,
): SocialPublicationExecutionMapperResult<PublicationExecutionIntent> {
  const errors: SocialPublicationExecutionMapperError[] = [];

  const domainValidation = safeValidatePublicationExecutionIntent(intent);
  if (!domainValidation.ok) {
    errors.push(
      ...domainValidation.errors.map((error) =>
        mapperError("domain_validation_failed", error.path, error.message, [error]),
      ),
    );
  }

  if (!isRecord(intent)) {
    return { ok: false, errors };
  }

  const candidate = intent as PublicationExecutionIntent;
  rejectForbiddenMapperState(candidate, "intent", errors);

  if (
    hasText(candidate.createdAt) &&
    hasText(candidate.updatedAt) &&
    Number.isFinite(Date.parse(candidate.createdAt)) &&
    Number.isFinite(Date.parse(candidate.updatedAt)) &&
    Date.parse(candidate.updatedAt) < Date.parse(candidate.createdAt)
  ) {
    errors.push(
      mapperError(
        "timestamp_ordering_invalid",
        "updatedAt",
        "Publication execution intent updatedAt must not precede createdAt.",
      ),
    );
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: immutableClone(candidate) };
}

export function validatePublicationExecutionResultForPersistenceMapping(
  result: unknown,
): SocialPublicationExecutionMapperResult<PublicationExecutionResult> {
  const errors: SocialPublicationExecutionMapperError[] = [];

  const domainValidation = safeValidatePublicationExecutionResult(result);
  if (!domainValidation.ok) {
    errors.push(
      ...domainValidation.errors.map((error) =>
        mapperError("domain_validation_failed", error.path, error.message, [error]),
      ),
    );
  }

  if (!isRecord(result)) {
    return { ok: false, errors };
  }

  const candidate = result as PublicationExecutionResult;
  rejectForbiddenMapperState(candidate, "result", errors);

  if (
    hasText(candidate.createdAt) &&
    hasText(candidate.updatedAt) &&
    Number.isFinite(Date.parse(candidate.createdAt)) &&
    Number.isFinite(Date.parse(candidate.updatedAt)) &&
    Date.parse(candidate.updatedAt) < Date.parse(candidate.createdAt)
  ) {
    errors.push(
      mapperError(
        "timestamp_ordering_invalid",
        "updatedAt",
        "Publication execution result updatedAt must not precede createdAt.",
      ),
    );
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: immutableClone(candidate) };
}

function safeValidatePublicationExecutionIntent(
  intent: unknown,
):
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly PublicationExecutionValidationError[] } {
  try {
    return validatePublicationExecutionIntent(intent as PublicationExecutionIntent);
  } catch {
    return {
      ok: false,
      errors: [
        {
          code: "secret_forbidden" as PublicationExecutionErrorCode,
          path: "intent",
          message: "Publication execution intent must be safe, acyclic data.",
        },
      ],
    };
  }
}

function safeValidatePublicationExecutionResult(
  result: unknown,
):
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly PublicationExecutionValidationError[] } {
  try {
    return validatePublicationExecutionResult(result as PublicationExecutionResult);
  } catch {
    return {
      ok: false,
      errors: [
        {
          code: "secret_forbidden" as PublicationExecutionErrorCode,
          path: "result",
          message: "Publication execution result must be safe, acyclic data.",
        },
      ],
    };
  }
}

export function mapPublicationExecutionIntentToIntentRecord(
  intent: PublicationExecutionIntent,
): SocialPublicationExecutionMapperResult<SocialPublicationExecutionIntentRecord> {
  const validation = validatePublicationExecutionIntentForPersistenceMapping(intent);
  if (!validation.ok) return validation;

  const repositoryResult = buildIntentRecordFromDomain(validation.value);
  if (!repositoryResult.ok) {
    return {
      ok: false,
      errors: [
        mapperError(
          "persistence_validation_failed",
          "intent",
          "Mapped execution intent persistence record failed validation.",
          undefined,
          [repositoryResult.error],
        ),
      ],
    };
  }

  return { ok: true, value: immutableClone(repositoryResult.value) };
}

export function mapPublicationExecutionResultToResultRecord(
  result: PublicationExecutionResult,
): SocialPublicationExecutionMapperResult<SocialPublicationExecutionResultRecord> {
  const validation = validatePublicationExecutionResultForPersistenceMapping(result);
  if (!validation.ok) return validation;

  const repositoryResult = buildResultRecordFromDomain(validation.value);
  if (!repositoryResult.ok) {
    return {
      ok: false,
      errors: [
        mapperError(
          "persistence_validation_failed",
          "result",
          "Mapped execution result persistence record failed validation.",
          undefined,
          [repositoryResult.error],
        ),
      ],
    };
  }

  return { ok: true, value: immutableClone(repositoryResult.value) };
}

export function mapPublicationExecutionIntentToPersistenceMapping(
  intent: PublicationExecutionIntent,
): SocialPublicationExecutionMapperResult<SocialPublicationExecutionMappedIntent> {
  const validation = validatePublicationExecutionIntentForPersistenceMapping(intent);
  if (!validation.ok) return validation;

  const recordResult = mapPublicationExecutionIntentToIntentRecord(validation.value);
  if (!recordResult.ok) return recordResult;

  const scope = scopeFromReferences(validation.value.job.references);
  const evidence = validation.value.evidence
    ? evidenceRecordFromDomain(
        validation.value.evidence,
        deterministicEvidenceId(`intent:${validation.value.intentId}`),
        recordResult.value.execution_intent_id,
        null,
        scope,
        validation.value.createdAt,
      )
    : null;

  return {
    ok: true,
    value: immutableClone({
      sourceIntentId: intent.intentId,
      jobId: intent.job.jobId,
      intentType: intent.intentType,
      intent: recordResult.value,
      evidence,
      deterministic: true,
      persisted: false,
      referencesOnly: true,
      executesNothing: true,
      publishesNothing: true,
      recordsNoMetrics: true,
      performsNoLearning: true,
    }),
  };
}

export function mapPublicationExecutionResultToPersistenceMapping(
  result: PublicationExecutionResult,
): SocialPublicationExecutionMapperResult<SocialPublicationExecutionMappedResult> {
  const validation = validatePublicationExecutionResultForPersistenceMapping(result);
  if (!validation.ok) return validation;

  const recordResult = mapPublicationExecutionResultToResultRecord(validation.value);
  if (!recordResult.ok) return recordResult;

  const scope = scopeFromReferences(validation.value.job.references);
  const evidence = validation.value.evidence
    ? evidenceRecordFromDomain(
        validation.value.evidence,
        deterministicEvidenceId(`result:${validation.value.resultId}`),
        recordResult.value.execution_intent_id,
        recordResult.value.execution_result_id,
        scope,
        validation.value.createdAt,
      )
    : null;

  return {
    ok: true,
    value: immutableClone({
      sourceResultId: result.resultId,
      sourceIntentId: result.intentId,
      jobId: result.job.jobId,
      resultStatus: result.status,
      result: recordResult.value,
      evidence,
      deterministic: true,
      persisted: false,
      referencesOnly: true,
      executesNothing: true,
      publishesNothing: true,
      recordsNoMetrics: true,
      performsNoLearning: true,
    }),
  };
}

export function previewPublicationExecutionIntentPersistenceMapping(
  intent: PublicationExecutionIntent,
): SocialPublicationExecutionMapperResult<SocialPublicationExecutionMappedIntent> {
  return mapPublicationExecutionIntentToPersistenceMapping(intent);
}

export function previewPublicationExecutionResultPersistenceMapping(
  result: PublicationExecutionResult,
): SocialPublicationExecutionMapperResult<SocialPublicationExecutionMappedResult> {
  return mapPublicationExecutionResultToPersistenceMapping(result);
}

export function publicationExecutionMappedIntentsEqual(
  left: SocialPublicationExecutionMappedIntent,
  right: SocialPublicationExecutionMappedIntent,
): boolean {
  return stableStringify(sortMappedIntent(left)) === stableStringify(sortMappedIntent(right));
}

export function publicationExecutionMappedResultsEqual(
  left: SocialPublicationExecutionMappedResult,
  right: SocialPublicationExecutionMappedResult,
): boolean {
  return stableStringify(sortMappedResult(left)) === stableStringify(sortMappedResult(right));
}

export function serializePublicationExecutionMappedIntent(
  mapped: SocialPublicationExecutionMappedIntent,
): string {
  return stableStringify(sortMappedIntent(mapped));
}

export function serializePublicationExecutionMappedResult(
  mapped: SocialPublicationExecutionMappedResult,
): string {
  return stableStringify(sortMappedResult(mapped));
}

export function hydratePublicationExecutionMappedIntent(
  serialized: string,
): SocialPublicationExecutionMapperResult<SocialPublicationExecutionMappedIntent> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    return {
      ok: false,
      errors: [
        mapperError(
          "serialization_invalid",
          "serialized",
          "Serialized execution mapped intent must be valid JSON.",
        ),
      ],
    };
  }

  if (!isMappedIntent(parsed)) {
    return {
      ok: false,
      errors: [
        mapperError(
          "serialization_invalid",
          "serialized",
          "Serialized execution mapped intent has an invalid shape.",
        ),
      ],
    };
  }

  return { ok: true, value: immutableClone(sortMappedIntent(parsed)) };
}

export function hydratePublicationExecutionMappedResult(
  serialized: string,
): SocialPublicationExecutionMapperResult<SocialPublicationExecutionMappedResult> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    return {
      ok: false,
      errors: [
        mapperError(
          "serialization_invalid",
          "serialized",
          "Serialized execution mapped result must be valid JSON.",
        ),
      ],
    };
  }

  if (!isMappedResult(parsed)) {
    return {
      ok: false,
      errors: [
        mapperError(
          "serialization_invalid",
          "serialized",
          "Serialized execution mapped result has an invalid shape.",
        ),
      ],
    };
  }

  return { ok: true, value: immutableClone(sortMappedResult(parsed)) };
}

function evidenceRecordFromDomain(
  evidenceReference: PublicationExecutionEvidenceReference,
  evidenceId: SocialPublicationExecutionEvidenceId,
  intentId: SocialPublicationExecutionIntentId,
  resultId: SocialPublicationExecutionResultId | null,
  scope: SocialPublicationExecutionScope,
  recordedAt: string,
): SocialPublicationExecutionEvidenceRecord {
  return {
    evidence_id: evidenceId,
    execution_intent_id: intentId,
    execution_result_id: resultId,
    evidence_kind: evidenceReference.evidenceKind,
    notes: evidenceReference.notes,
    evidence: evidenceReference.evidence,
    scope,
    recorded_at: recordedAt,
    recorded_by_actor: "model",
    recorded_source: "publication_execution_domain",
    contains_full_payload: false,
    contains_secrets: false,
    proves_execution: false,
    append_only: true,
    immutable: true,
  };
}

function scopeFromReferences(
  references: PublicationExecutionIntent["job"]["references"],
): SocialPublicationExecutionScope {
  return {
    social_post_id: references.socialPostId as SocialPublicationExecutionScope["social_post_id"],
    publication_target_id:
      references.publicationTargetId as SocialPublicationExecutionScope["publication_target_id"],
    publisher_request_id:
      references.publisherRequestId as SocialPublicationExecutionScope["publisher_request_id"],
    publisher_result_id:
      references.publisherResultId as SocialPublicationExecutionScope["publisher_result_id"],
    publisher_job_id: references.publisherJobId as SocialPublicationExecutionScope["publisher_job_id"],
    schedule_id: references.scheduleId as SocialPublicationExecutionScope["schedule_id"],
    ledger_entry_id: references.ledgerEntryId as SocialPublicationExecutionScope["ledger_entry_id"],
    publication_manifest_id:
      references.publicationManifestId as SocialPublicationExecutionScope["publication_manifest_id"],
    owner_approval_id: references.ownerApprovalId as SocialPublicationExecutionScope["owner_approval_id"],
    approval_id: references.approvalId as SocialPublicationExecutionScope["approval_id"],
    metric_observation_id:
      references.metricObservationId as SocialPublicationExecutionScope["metric_observation_id"],
    learning_insight_id:
      references.learningInsightId as SocialPublicationExecutionScope["learning_insight_id"],
    campaign_memory_id:
      references.campaignMemoryId as SocialPublicationExecutionScope["campaign_memory_id"],
    decision_history_id:
      references.decisionHistoryId as SocialPublicationExecutionScope["decision_history_id"],
  };
}

function deterministicEvidenceId(seed: string): SocialPublicationExecutionEvidenceId {
  const hex = fnv1a(`social-publication-execution-evidence:${seed}`)
    .padEnd(32, "0")
    .slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-") as SocialPublicationExecutionEvidenceId;
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  const chunks: string[] = [];

  for (let index = 0; index < 4; index += 1) {
    for (let charIndex = 0; charIndex < input.length; charIndex += 1) {
      hash ^= input.charCodeAt(charIndex) + index;
      hash = Math.imul(hash, 0x01000193);
    }
    chunks.push((hash >>> 0).toString(16).padStart(8, "0"));
  }

  return chunks.join("");
}

function mapperError(
  code: SocialPublicationExecutionMapperErrorCode,
  path: string,
  message: string,
  domainErrors?: readonly PublicationExecutionValidationError[],
  persistenceErrors?: readonly SocialPublicationExecutionRepositoryError[],
): SocialPublicationExecutionMapperError {
  return { code, path, message, domainErrors, persistenceErrors };
}

function rejectForbiddenMapperState(
  value: unknown,
  path: string,
  errors: SocialPublicationExecutionMapperError[],
  seen = new WeakSet<object>(),
): void {
  if (!value || typeof value !== "object") return;

  if (seen.has(value)) {
    errors.push(
      mapperError(
        "domain_validation_failed",
        path,
        "Publication execution mapper input must be acyclic.",
      ),
    );
    return;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      rejectForbiddenMapperState(item, `${path}.${index}`, errors, seen),
    );
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_MAPPER_STATE_KEYS.has(key)) {
      errors.push(
        mapperError(
          "domain_validation_failed",
          childPath,
          "Publication execution mapper input contains forbidden execution state.",
        ),
      );
    }
    rejectForbiddenMapperState(child, childPath, errors, seen);
  }
}

function sortMappedIntent(
  mapped: SocialPublicationExecutionMappedIntent,
): SocialPublicationExecutionMappedIntent {
  return {
    sourceIntentId: mapped.sourceIntentId,
    jobId: mapped.jobId,
    intentType: mapped.intentType,
    intent: mapped.intent,
    evidence: mapped.evidence,
    deterministic: mapped.deterministic,
    persisted: mapped.persisted,
    referencesOnly: mapped.referencesOnly,
    executesNothing: mapped.executesNothing,
    publishesNothing: mapped.publishesNothing,
    recordsNoMetrics: mapped.recordsNoMetrics,
    performsNoLearning: mapped.performsNoLearning,
  };
}

function sortMappedResult(
  mapped: SocialPublicationExecutionMappedResult,
): SocialPublicationExecutionMappedResult {
  return {
    sourceResultId: mapped.sourceResultId,
    sourceIntentId: mapped.sourceIntentId,
    jobId: mapped.jobId,
    resultStatus: mapped.resultStatus,
    result: mapped.result,
    evidence: mapped.evidence,
    deterministic: mapped.deterministic,
    persisted: mapped.persisted,
    referencesOnly: mapped.referencesOnly,
    executesNothing: mapped.executesNothing,
    publishesNothing: mapped.publishesNothing,
    recordsNoMetrics: mapped.recordsNoMetrics,
    performsNoLearning: mapped.performsNoLearning,
  };
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((output, key) => {
      output[key] = stableValue(value[key]);
      return output;
    }, {});
}

function immutableClone<T>(value: T): T {
  return deepFreeze(JSON.parse(JSON.stringify(value)) as T);
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function isMappedIntent(value: unknown): value is SocialPublicationExecutionMappedIntent {
  if (!isRecord(value)) return false;

  return (
    typeof value.sourceIntentId === "string" &&
    typeof value.jobId === "string" &&
    typeof value.intentType === "string" &&
    isRecord(value.intent) &&
    (value.evidence === null || isRecord(value.evidence)) &&
    value.deterministic === true &&
    value.persisted === false &&
    value.referencesOnly === true &&
    value.executesNothing === true &&
    value.publishesNothing === true &&
    value.recordsNoMetrics === true &&
    value.performsNoLearning === true
  );
}

function isMappedResult(value: unknown): value is SocialPublicationExecutionMappedResult {
  if (!isRecord(value)) return false;

  return (
    typeof value.sourceResultId === "string" &&
    typeof value.sourceIntentId === "string" &&
    typeof value.jobId === "string" &&
    typeof value.resultStatus === "string" &&
    isRecord(value.result) &&
    (value.evidence === null || isRecord(value.evidence)) &&
    value.deterministic === true &&
    value.persisted === false &&
    value.referencesOnly === true &&
    value.executesNothing === true &&
    value.publishesNothing === true &&
    value.recordsNoMetrics === true &&
    value.performsNoLearning === true
  );
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
