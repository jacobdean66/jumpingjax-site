import {
  validatePublicationPublisherRequest,
  validatePublicationPublisherResult,
  type PublicationPublisherErrorCode,
  type PublicationPublisherEvidenceSummary,
  type PublicationPublisherRequest,
  type PublicationPublisherResult,
  type PublicationPublisherValidationError,
} from "./social-publication-publisher";
import {
  mapPublicationPublisherRequestToRequestRecord as buildRequestRecordFromDomain,
  mapPublicationPublisherResultToResultRecord as buildResultRecordFromDomain,
  type SocialPublicationPublisherRepositoryError,
  type SocialPublicationPublisherRequestId,
  type SocialPublicationPublisherRequestRecord,
  type SocialPublicationPublisherResultId,
  type SocialPublicationPublisherResultRecord,
  type SocialPublicationPublisherScope,
} from "./social-publication-publisher-repository";
import type {
  SocialPublicationPublisherEvidenceId,
  SocialPublicationPublisherEvidenceRecord,
} from "./social-publication-publisher-rows";

export const SOCIAL_PUBLICATION_PUBLISHER_MAPPER_ERROR_CODES = [
  "domain_validation_failed",
  "persistence_validation_failed",
  "timestamp_ordering_invalid",
  "serialization_invalid",
] as const;

export type SocialPublicationPublisherMapperErrorCode =
  (typeof SOCIAL_PUBLICATION_PUBLISHER_MAPPER_ERROR_CODES)[number];

export type SocialPublicationPublisherMapperError = Readonly<{
  code: SocialPublicationPublisherMapperErrorCode;
  path: string;
  message: string;
  domainErrors?: readonly PublicationPublisherValidationError[];
  persistenceErrors?: readonly SocialPublicationPublisherRepositoryError[];
}>;

export type SocialPublicationPublisherMapperResult<T> = Readonly<
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      errors: readonly SocialPublicationPublisherMapperError[];
    }
>;

export type SocialPublicationPublisherMappedRequest = Readonly<{
  sourceRequestId: string;
  jobId: string;
  requestType: PublicationPublisherRequest["requestSummary"]["requestType"];
  request: SocialPublicationPublisherRequestRecord;
  evidence: SocialPublicationPublisherEvidenceRecord | null;
  deterministic: true;
  persisted: false;
  referencesOnly: true;
  executesNothing: true;
  publishesNothing: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
}>;

export type SocialPublicationPublisherMappedResult = Readonly<{
  sourceResultId: string;
  sourceRequestId: string;
  jobId: string;
  resultStatus: PublicationPublisherResult["resultSummary"]["status"];
  result: SocialPublicationPublisherResultRecord;
  evidence: SocialPublicationPublisherEvidenceRecord | null;
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
  "canPublish",
  "canSchedule",
  "client",
  "clientSecret",
  "client_secret",
  "credential",
  "credentials",
  "cron",
  "cronExpression",
  "currentPublishStatus",
  "executePublication",
  "executionPlan",
  "execution_plan",
  "externalApi",
  "externalRequest",
  "externalResponse",
  "facebookClient",
  "facebookGraphApi",
  "fetch",
  "graphClient",
  "httpClient",
  "instagramClient",
  "instagramGraphApi",
  "intervalId",
  "isPublished",
  "jobQueue",
  "learning",
  "learningSignal",
  "ledgerBridge",
  "mutateApproval",
  "mutateLedger",
  "mutateManifest",
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
  "queue",
  "queueName",
  "refreshToken",
  "refresh_token",
  "requestInit",
  "routeHandler",
  "routePath",
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
  "timerId",
  "timerReference",
  "token",
  "upload",
  "urlToFetch",
  "webhook",
  "worker",
  "workerId",
]);

export function validatePublicationPublisherRequestForPersistenceMapping(
  request: unknown,
): SocialPublicationPublisherMapperResult<PublicationPublisherRequest> {
  const errors: SocialPublicationPublisherMapperError[] = [];

  const domainValidation = safeValidatePublicationPublisherRequest(request);
  if (!domainValidation.ok) {
    errors.push(
      ...domainValidation.errors.map((error) =>
        mapperError("domain_validation_failed", error.path, error.message, [error]),
      ),
    );
  }

  if (!isRecord(request)) {
    return { ok: false, errors };
  }

  const candidate = request as PublicationPublisherRequest;
  rejectForbiddenMapperState(candidate, "request", errors);

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
        "Publication publisher request updatedAt must not precede createdAt.",
      ),
    );
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: immutableClone(candidate) };
}

export function validatePublicationPublisherResultForPersistenceMapping(
  result: unknown,
): SocialPublicationPublisherMapperResult<PublicationPublisherResult> {
  const errors: SocialPublicationPublisherMapperError[] = [];

  const domainValidation = safeValidatePublicationPublisherResult(result);
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

  const candidate = result as PublicationPublisherResult;
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
        "Publication publisher result updatedAt must not precede createdAt.",
      ),
    );
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: immutableClone(candidate) };
}

function safeValidatePublicationPublisherRequest(
  request: unknown,
):
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly PublicationPublisherValidationError[] } {
  try {
    return validatePublicationPublisherRequest(request as PublicationPublisherRequest);
  } catch {
    return {
      ok: false,
      errors: [
        {
          code: "secret_forbidden" as PublicationPublisherErrorCode,
          path: "request",
          message: "Publication publisher request must be safe, acyclic data.",
        },
      ],
    };
  }
}

function safeValidatePublicationPublisherResult(
  result: unknown,
):
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly PublicationPublisherValidationError[] } {
  try {
    return validatePublicationPublisherResult(result as PublicationPublisherResult);
  } catch {
    return {
      ok: false,
      errors: [
        {
          code: "secret_forbidden" as PublicationPublisherErrorCode,
          path: "result",
          message: "Publication publisher result must be safe, acyclic data.",
        },
      ],
    };
  }
}

export function mapPublicationPublisherRequestToRequestRecord(
  request: PublicationPublisherRequest,
): SocialPublicationPublisherMapperResult<SocialPublicationPublisherRequestRecord> {
  const validation = validatePublicationPublisherRequestForPersistenceMapping(request);
  if (!validation.ok) return validation;

  const repositoryResult = buildRequestRecordFromDomain(validation.value);
  if (!repositoryResult.ok) {
    return {
      ok: false,
      errors: [
        mapperError(
          "persistence_validation_failed",
          "request",
          "Mapped publisher request persistence record failed validation.",
          undefined,
          [repositoryResult.error],
        ),
      ],
    };
  }

  return { ok: true, value: immutableClone(repositoryResult.value) };
}

export function mapPublicationPublisherResultToResultRecord(
  result: PublicationPublisherResult,
): SocialPublicationPublisherMapperResult<SocialPublicationPublisherResultRecord> {
  const validation = validatePublicationPublisherResultForPersistenceMapping(result);
  if (!validation.ok) return validation;

  const repositoryResult = buildResultRecordFromDomain(validation.value);
  if (!repositoryResult.ok) {
    return {
      ok: false,
      errors: [
        mapperError(
          "persistence_validation_failed",
          "result",
          "Mapped publisher result persistence record failed validation.",
          undefined,
          [repositoryResult.error],
        ),
      ],
    };
  }

  return { ok: true, value: immutableClone(repositoryResult.value) };
}

export function mapPublicationPublisherRequestToPersistenceMapping(
  request: PublicationPublisherRequest,
): SocialPublicationPublisherMapperResult<SocialPublicationPublisherMappedRequest> {
  const validation = validatePublicationPublisherRequestForPersistenceMapping(request);
  if (!validation.ok) return validation;

  const recordResult = mapPublicationPublisherRequestToRequestRecord(validation.value);
  if (!recordResult.ok) return recordResult;

  const scope = scopeFromReferences(validation.value.job.references);
  const evidence = validation.value.evidenceSummary
    ? evidenceRecordFromDomain(
        validation.value.evidenceSummary,
        deterministicEvidenceId(`request:${validation.value.requestId}`),
        recordResult.value.publisher_request_id,
        null,
        scope,
        validation.value.createdAt,
      )
    : null;

  return {
    ok: true,
    value: immutableClone({
      sourceRequestId: request.requestId,
      jobId: request.job.jobId,
      requestType: request.requestSummary.requestType,
      request: recordResult.value,
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

export function mapPublicationPublisherResultToPersistenceMapping(
  result: PublicationPublisherResult,
): SocialPublicationPublisherMapperResult<SocialPublicationPublisherMappedResult> {
  const validation = validatePublicationPublisherResultForPersistenceMapping(result);
  if (!validation.ok) return validation;

  const recordResult = mapPublicationPublisherResultToResultRecord(validation.value);
  if (!recordResult.ok) return recordResult;

  const scope = scopeFromReferences(validation.value.job.references);
  const evidence = validation.value.evidenceSummary
    ? evidenceRecordFromDomain(
        validation.value.evidenceSummary,
        deterministicEvidenceId(`result:${validation.value.resultId}`),
        recordResult.value.publisher_request_id,
        recordResult.value.publisher_result_id,
        scope,
        validation.value.createdAt,
      )
    : null;

  return {
    ok: true,
    value: immutableClone({
      sourceResultId: result.resultId,
      sourceRequestId: result.requestId,
      jobId: result.job.jobId,
      resultStatus: result.resultSummary.status,
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

export function previewPublicationPublisherRequestPersistenceMapping(
  request: PublicationPublisherRequest,
): SocialPublicationPublisherMapperResult<SocialPublicationPublisherMappedRequest> {
  return mapPublicationPublisherRequestToPersistenceMapping(request);
}

export function previewPublicationPublisherResultPersistenceMapping(
  result: PublicationPublisherResult,
): SocialPublicationPublisherMapperResult<SocialPublicationPublisherMappedResult> {
  return mapPublicationPublisherResultToPersistenceMapping(result);
}

export function publicationPublisherMappedRequestsEqual(
  left: SocialPublicationPublisherMappedRequest,
  right: SocialPublicationPublisherMappedRequest,
): boolean {
  return stableStringify(sortMappedRequest(left)) === stableStringify(sortMappedRequest(right));
}

export function publicationPublisherMappedResultsEqual(
  left: SocialPublicationPublisherMappedResult,
  right: SocialPublicationPublisherMappedResult,
): boolean {
  return stableStringify(sortMappedResult(left)) === stableStringify(sortMappedResult(right));
}

export function serializePublicationPublisherMappedRequest(
  mapped: SocialPublicationPublisherMappedRequest,
): string {
  return stableStringify(sortMappedRequest(mapped));
}

export function serializePublicationPublisherMappedResult(
  mapped: SocialPublicationPublisherMappedResult,
): string {
  return stableStringify(sortMappedResult(mapped));
}

export function hydratePublicationPublisherMappedRequest(
  serialized: string,
): SocialPublicationPublisherMapperResult<SocialPublicationPublisherMappedRequest> {
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
          "Serialized publisher mapped request must be valid JSON.",
        ),
      ],
    };
  }

  if (!isMappedRequest(parsed)) {
    return {
      ok: false,
      errors: [
        mapperError(
          "serialization_invalid",
          "serialized",
          "Serialized publisher mapped request has an invalid shape.",
        ),
      ],
    };
  }

  return { ok: true, value: immutableClone(sortMappedRequest(parsed)) };
}

export function hydratePublicationPublisherMappedResult(
  serialized: string,
): SocialPublicationPublisherMapperResult<SocialPublicationPublisherMappedResult> {
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
          "Serialized publisher mapped result must be valid JSON.",
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
          "Serialized publisher mapped result has an invalid shape.",
        ),
      ],
    };
  }

  return { ok: true, value: immutableClone(sortMappedResult(parsed)) };
}

function evidenceRecordFromDomain(
  evidenceSummary: PublicationPublisherEvidenceSummary,
  evidenceId: SocialPublicationPublisherEvidenceId,
  requestId: SocialPublicationPublisherRequestId,
  resultId: SocialPublicationPublisherResultId | null,
  scope: SocialPublicationPublisherScope,
  recordedAt: string,
): SocialPublicationPublisherEvidenceRecord {
  return {
    evidence_id: evidenceId,
    publisher_request_id: requestId,
    publisher_result_id: resultId,
    evidence_kind: evidenceSummary.evidenceKind,
    notes: evidenceSummary.notes,
    evidence: evidenceSummary.evidence,
    scope,
    recorded_at: recordedAt,
    recorded_by_actor: "publisher",
    recorded_source: "publication_publisher_domain",
    contains_full_payload: false,
    contains_full_response: false,
    contains_secrets: false,
    proves_execution: false,
    append_only: true,
    immutable: true,
  };
}

function scopeFromReferences(
  references: PublicationPublisherRequest["job"]["references"],
): SocialPublicationPublisherScope {
  return {
    social_post_id: references.socialPostId as SocialPublicationPublisherScope["social_post_id"],
    publication_target_id:
      references.publicationTargetId as SocialPublicationPublisherScope["publication_target_id"],
    publication_manifest_id:
      references.publicationManifestId as SocialPublicationPublisherScope["publication_manifest_id"],
    schedule_id: references.scheduleId as SocialPublicationPublisherScope["schedule_id"],
    ledger_entry_id:
      references.ledgerEntryId as SocialPublicationPublisherScope["ledger_entry_id"],
    publication_attempt_id:
      references.publicationAttemptId as SocialPublicationPublisherScope["publication_attempt_id"],
    owner_approval_id:
      references.ownerApprovalId as SocialPublicationPublisherScope["owner_approval_id"],
    approval_id: references.approvalId as SocialPublicationPublisherScope["approval_id"],
    proposal_id: references.proposalId as SocialPublicationPublisherScope["proposal_id"],
  };
}

function deterministicEvidenceId(seed: string): SocialPublicationPublisherEvidenceId {
  const hex = fnv1a(`social-publication-publisher-evidence:${seed}`)
    .padEnd(32, "0")
    .slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-") as SocialPublicationPublisherEvidenceId;
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
  code: SocialPublicationPublisherMapperErrorCode,
  path: string,
  message: string,
  domainErrors?: readonly PublicationPublisherValidationError[],
  persistenceErrors?: readonly SocialPublicationPublisherRepositoryError[],
): SocialPublicationPublisherMapperError {
  return { code, path, message, domainErrors, persistenceErrors };
}

function rejectForbiddenMapperState(
  value: unknown,
  path: string,
  errors: SocialPublicationPublisherMapperError[],
  seen = new WeakSet<object>(),
): void {
  if (!value || typeof value !== "object") return;

  if (seen.has(value)) {
    errors.push(
      mapperError(
        "domain_validation_failed",
        path,
        "Publication publisher mapper input must be acyclic.",
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
          "Publication publisher mapper input contains forbidden execution state.",
        ),
      );
    }
    rejectForbiddenMapperState(child, childPath, errors, seen);
  }
}

function sortMappedRequest(
  mapped: SocialPublicationPublisherMappedRequest,
): SocialPublicationPublisherMappedRequest {
  return {
    sourceRequestId: mapped.sourceRequestId,
    jobId: mapped.jobId,
    requestType: mapped.requestType,
    request: mapped.request,
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
  mapped: SocialPublicationPublisherMappedResult,
): SocialPublicationPublisherMappedResult {
  return {
    sourceResultId: mapped.sourceResultId,
    sourceRequestId: mapped.sourceRequestId,
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

function isMappedRequest(value: unknown): value is SocialPublicationPublisherMappedRequest {
  if (!isRecord(value)) return false;

  return (
    typeof value.sourceRequestId === "string" &&
    typeof value.jobId === "string" &&
    typeof value.requestType === "string" &&
    isRecord(value.request) &&
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

function isMappedResult(value: unknown): value is SocialPublicationPublisherMappedResult {
  if (!isRecord(value)) return false;

  return (
    typeof value.sourceResultId === "string" &&
    typeof value.sourceRequestId === "string" &&
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
