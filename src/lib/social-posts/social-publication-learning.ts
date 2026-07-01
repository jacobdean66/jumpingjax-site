export const PUBLICATION_LEARNING_INSIGHT_TYPES = [
  "publication_learning_insight",
] as const;

export const PUBLICATION_LEARNING_CANDIDATE_TYPES = [
  "content_pattern",
  "timing_pattern",
  "channel_pattern",
  "audience_pattern",
  "underperformance_signal",
  "overperformance_signal",
] as const;

export const PUBLICATION_LEARNING_INSIGHT_STATUSES = [
  "candidate",
  "blocked",
  "accepted_for_review",
  "rejected",
] as const;

export const PUBLICATION_LEARNING_CONFIDENCE_LEVELS = [
  "low",
  "medium",
  "high",
] as const;

export const PUBLICATION_LEARNING_SOURCES = [
  "manual_review",
  "metrics_replay_summary",
  "decision_history_review",
  "test",
] as const;

export const PUBLICATION_LEARNING_ERROR_CODES = [
  "insight_id_required",
  "insight_type_required",
  "insight_type_unknown",
  "candidate_type_required",
  "candidate_type_unknown",
  "insight_status_required",
  "insight_status_unknown",
  "source_required",
  "source_unknown",
  "confidence_score_invalid",
  "confidence_level_invalid",
  "confidence_level_score_mismatch",
  "references_required",
  "social_post_reference_invalid",
  "target_reference_invalid",
  "campaign_reference_invalid",
  "metric_reference_invalid",
  "publisher_reference_invalid",
  "schedule_reference_invalid",
  "ledger_reference_invalid",
  "manifest_reference_invalid",
  "approval_reference_invalid",
  "campaign_memory_reference_invalid",
  "decision_history_reference_invalid",
  "rationale_required",
  "blocked_reason_required",
  "blocked_reason_forbidden",
  "rejected_reason_required",
  "rejected_reason_forbidden",
  "evidence_invalid",
  "observed_at_required",
  "observed_at_invalid",
  "created_at_required",
  "updated_at_required",
  "invariant_failed",
  "secret_forbidden",
  "platform_payload_forbidden",
  "embedded_payload_forbidden",
  "network_forbidden",
  "execution_forbidden",
  "model_training_forbidden",
  "state_mutation_forbidden",
  "persistence_forbidden",
  "bridge_forbidden",
  "admin_ui_forbidden",
  "api_route_forbidden",
] as const;

export type PublicationLearningInsightType =
  (typeof PUBLICATION_LEARNING_INSIGHT_TYPES)[number];
export type PublicationLearningCandidateType =
  (typeof PUBLICATION_LEARNING_CANDIDATE_TYPES)[number];
export type PublicationLearningInsightStatus =
  (typeof PUBLICATION_LEARNING_INSIGHT_STATUSES)[number];
export type PublicationLearningConfidenceLevel =
  (typeof PUBLICATION_LEARNING_CONFIDENCE_LEVELS)[number];
export type PublicationLearningSource =
  (typeof PUBLICATION_LEARNING_SOURCES)[number];
export type PublicationLearningErrorCode =
  (typeof PUBLICATION_LEARNING_ERROR_CODES)[number];

export type PublicationLearningValidationError = Readonly<{
  code: PublicationLearningErrorCode;
  path: string;
  message: string;
}>;

export type PublicationLearningValidationResult = Readonly<
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly PublicationLearningValidationError[] }
>;

export type PublicationLearningJsonPrimitive = string | number | boolean | null;
export type PublicationLearningJsonValue =
  | PublicationLearningJsonPrimitive
  | readonly PublicationLearningJsonValue[]
  | { readonly [key: string]: PublicationLearningJsonValue };
export type PublicationLearningJsonObject = Readonly<{
  [key: string]: PublicationLearningJsonValue;
}>;

export type PublicationLearningReferences = Readonly<{
  socialPostId: string | null;
  publicationTargetId: string | null;
  campaignId: string | null;
  metricObservationId: string | null;
  publisherRequestId: string | null;
  publisherResultId: string | null;
  publisherJobId: string | null;
  scheduleId: string | null;
  ledgerEntryId: string | null;
  publicationManifestId: string | null;
  ownerApprovalId: string | null;
  approvalId: string | null;
  campaignMemoryId: string | null;
  decisionHistoryId: string | null;
}>;

export type PublicationLearningEvidence = Readonly<{
  evidenceId: string;
  evidenceKind:
    | "metrics_summary_reference"
    | "decision_history_reference"
    | "manual_note"
    | "none";
  evidence: PublicationLearningJsonObject;
  notes: string | null;
  containsPlatformPayload: false;
  containsSecrets: false;
  containsCredentials: false;
  containsModelWeights: false;
  containsTrainingData: false;
  providesRecommendation: false;
}>;

export type PublicationLearningInsight = Readonly<{
  insightId: string;
  insightType: PublicationLearningInsightType;
  candidateType: PublicationLearningCandidateType;
  status: PublicationLearningInsightStatus;
  confidenceScore: number | null;
  confidenceLevel: PublicationLearningConfidenceLevel | null;
  source: PublicationLearningSource;
  references: PublicationLearningReferences;
  evidence: PublicationLearningEvidence | null;
  rationale: string;
  blockedReason: string | null;
  rejectedReason: string | null;
  observedAt: string;
  createdAt: string;
  updatedAt: string;
  passiveOnly: true;
  candidateOnly: true;
  explainable: true;
  referencesOnly: true;
  containsEmbeddedPayload: false;
  performsNoModelTraining: true;
  producesNoStateMutatingRecommendation: true;
  triggersNoAutomation: true;
  triggersNoScheduling: true;
  triggersNoPublishing: true;
  callsNoExternalApis: true;
  usesNoSdks: true;
  usesNoNetwork: true;
  persistsNothing: true;
  exposesNoBridge: true;
  exposesNoAdminUi: true;
  exposesNoApiRoutes: true;
  mutatesNoCampaignMemory: true;
  mutatesNoDecisionHistory: true;
  mutatesNoApproval: true;
  mutatesNoLedger: true;
  mutatesNoManifest: true;
  mutatesNoTargets: true;
  mutatesNoScheduler: true;
  mutatesNoPublisher: true;
  mutatesNoMetrics: true;
}>;

type UnknownRecord = Readonly<Record<string, unknown>>;

const INSIGHT_TYPE_SET = new Set<string>(PUBLICATION_LEARNING_INSIGHT_TYPES);
const CANDIDATE_TYPE_SET = new Set<string>(PUBLICATION_LEARNING_CANDIDATE_TYPES);
const STATUS_SET = new Set<string>(PUBLICATION_LEARNING_INSIGHT_STATUSES);
const CONFIDENCE_LEVEL_SET = new Set<string>(PUBLICATION_LEARNING_CONFIDENCE_LEVELS);
const SOURCE_SET = new Set<string>(PUBLICATION_LEARNING_SOURCES);

const FORBIDDEN_SECRET_KEYS = new Set([
  "accessToken",
  "access_token",
  "apiKey",
  "api_key",
  "clientSecret",
  "client_secret",
  "credential",
  "credentials",
  "oauth",
  "password",
  "refreshToken",
  "refresh_token",
  "secret",
  "token",
]);

const FORBIDDEN_PLATFORM_PAYLOAD_KEYS = new Set([
  "apiResponse",
  "api_response",
  "facebookPayload",
  "instagramPayload",
  "linkedinPayload",
  "platformPayload",
  "rawMetrics",
  "rawResponse",
  "tiktokPayload",
]);

const FORBIDDEN_NETWORK_KEYS = new Set([
  "analyticsSdk",
  "client",
  "endpoint",
  "externalApi",
  "fetch",
  "http",
  "sdk",
  "url",
]);

const FORBIDDEN_EXECUTION_KEYS = new Set([
  "automate",
  "automation",
  "cron",
  "execution",
  "executionPlan",
  "job",
  "publish",
  "queue",
  "retry",
  "scheduleWork",
  "timer",
  "worker",
]);

const FORBIDDEN_MODEL_TRAINING_KEYS = new Set([
  "checkpoint",
  "epoch",
  "fineTune",
  "fineTuning",
  "gradient",
  "hyperparameters",
  "modelTraining",
  "modelWeights",
  "trainingData",
  "trainingJob",
]);

const FORBIDDEN_STATE_MUTATION_KEYS = new Set([
  "autoApply",
  "autoPromote",
  "autoPublish",
  "autoSchedule",
  "forceApply",
  "mutateApproval",
  "mutateCampaignMemory",
  "mutateDecisionHistory",
  "mutateLedger",
  "stateMutation",
]);

export function validatePublicationLearningInsight(
  insight: PublicationLearningInsight,
): PublicationLearningValidationResult {
  const errors: PublicationLearningValidationError[] = [];
  const record = asRecord(insight);

  if (!hasText(record.insightId)) {
    errors.push(error("insight_id_required", "insightId", "Learning insight id is required."));
  }
  validateEnum(record.insightType, INSIGHT_TYPE_SET, "insightType", "insight_type_required", "insight_type_unknown", errors);
  validateEnum(record.candidateType, CANDIDATE_TYPE_SET, "candidateType", "candidate_type_required", "candidate_type_unknown", errors);
  validateEnum(record.status, STATUS_SET, "status", "insight_status_required", "insight_status_unknown", errors);
  validateEnum(record.source, SOURCE_SET, "source", "source_required", "source_unknown", errors);
  validateConfidence(record.confidenceScore, record.confidenceLevel, errors);
  validateReferences(record.references, "references", errors);
  validateStatusReasons(record.status, record.blockedReason, record.rejectedReason, errors);
  validateRationale(record.rationale, errors);
  validateEvidence(record.evidence, "evidence", errors);
  validateTimestamp(record.observedAt, "observedAt", "observed_at_invalid", errors);
  validateTimestamp(record.createdAt, "createdAt", "created_at_required", errors);
  validateTimestamp(record.updatedAt, "updatedAt", "updated_at_required", errors);
  validateInvariants(record, errors);
  findForbiddenState(insight, "insight", errors);

  return errors.length === 0
    ? { ok: true, errors: [] }
    : { ok: false, errors: deepFreeze(errors) };
}

export function serializePublicationLearningInsight(
  insight: PublicationLearningInsight,
): PublicationLearningJsonObject {
  const validation = validatePublicationLearningInsight(insight);
  if (!validation.ok) {
    throw new Error(`Invalid publication learning insight: ${validation.errors[0]?.message ?? "unknown error"}`);
  }
  return deepFreeze(JSON.parse(JSON.stringify(insight)) as PublicationLearningJsonObject);
}

export function hydratePublicationLearningInsight(
  value: PublicationLearningJsonObject,
): PublicationLearningInsight {
  const insight = value as unknown as PublicationLearningInsight;
  const validation = validatePublicationLearningInsight(insight);
  if (!validation.ok) {
    throw new Error(`Invalid publication learning insight: ${validation.errors[0]?.message ?? "unknown error"}`);
  }
  return deepFreeze(insight);
}

export function sortPublicationLearningInsights(
  insights: readonly PublicationLearningInsight[],
): readonly PublicationLearningInsight[] {
  return deepFreeze(
    [...insights].sort((left, right) => {
      const observed = Date.parse(left.observedAt) - Date.parse(right.observedAt);
      if (observed !== 0) return observed;
      return left.insightId.localeCompare(right.insightId);
    }),
  );
}

function validateReferences(
  references: unknown,
  path: string,
  errors: PublicationLearningValidationError[],
): void {
  const record = asRecord(references);
  const optionalFields: readonly [string, PublicationLearningErrorCode][] = [
    ["socialPostId", "social_post_reference_invalid"],
    ["publicationTargetId", "target_reference_invalid"],
    ["campaignId", "campaign_reference_invalid"],
    ["metricObservationId", "metric_reference_invalid"],
    ["publisherRequestId", "publisher_reference_invalid"],
    ["publisherResultId", "publisher_reference_invalid"],
    ["publisherJobId", "publisher_reference_invalid"],
    ["scheduleId", "schedule_reference_invalid"],
    ["ledgerEntryId", "ledger_reference_invalid"],
    ["publicationManifestId", "manifest_reference_invalid"],
    ["ownerApprovalId", "approval_reference_invalid"],
    ["approvalId", "approval_reference_invalid"],
    ["campaignMemoryId", "campaign_memory_reference_invalid"],
    ["decisionHistoryId", "decision_history_reference_invalid"],
  ];

  let hasAnyReference = false;
  for (const [field, code] of optionalFields) {
    const value = record[field];
    if (value !== null && value !== undefined) {
      if (!hasText(value)) {
        errors.push(error(code, `${path}.${field}`, "Optional references must be text or null."));
      } else {
        hasAnyReference = true;
      }
    }
  }

  if (!hasAnyReference) {
    errors.push(error("references_required", path, "A learning insight must reference at least one prior record by id."));
  }
}

function validateStatusReasons(
  status: unknown,
  blockedReason: unknown,
  rejectedReason: unknown,
  errors: PublicationLearningValidationError[],
): void {
  if (status === "blocked") {
    if (!hasText(blockedReason)) {
      errors.push(error("blocked_reason_required", "blockedReason", "Blocked insights require a blocked reason."));
    }
    if (rejectedReason !== null) {
      errors.push(error("rejected_reason_forbidden", "rejectedReason", "Blocked insights must not carry a rejected reason."));
    }
    return;
  }
  if (status === "rejected") {
    if (!hasText(rejectedReason)) {
      errors.push(error("rejected_reason_required", "rejectedReason", "Rejected insights require a rejected reason."));
    }
    if (blockedReason !== null) {
      errors.push(error("blocked_reason_forbidden", "blockedReason", "Rejected insights must not carry a blocked reason."));
    }
    return;
  }
  if (blockedReason !== null) {
    errors.push(error("blocked_reason_forbidden", "blockedReason", "Only blocked insights may carry a blocked reason."));
  }
  if (rejectedReason !== null) {
    errors.push(error("rejected_reason_forbidden", "rejectedReason", "Only rejected insights may carry a rejected reason."));
  }
}

function validateRationale(
  rationale: unknown,
  errors: PublicationLearningValidationError[],
): void {
  if (!hasText(rationale)) {
    errors.push(error("rationale_required", "rationale", "Learning insights must carry an explainable rationale."));
  }
}

function validateConfidence(
  score: unknown,
  level: unknown,
  errors: PublicationLearningValidationError[],
): void {
  const scorePresent = score !== null && score !== undefined;
  const levelPresent = level !== null && level !== undefined;

  if (scorePresent) {
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) {
      errors.push(error("confidence_score_invalid", "confidenceScore", "Confidence score must be a number between 0 and 1."));
    }
  }

  if (levelPresent && !CONFIDENCE_LEVEL_SET.has(level as string)) {
    errors.push(error("confidence_level_invalid", "confidenceLevel", "Confidence level is not supported."));
  }

  if (scorePresent !== levelPresent) {
    errors.push(error("confidence_level_invalid", "confidenceLevel", "Confidence score and confidence level must both be present or both be null."));
    return;
  }

  if (scorePresent && levelPresent && typeof score === "number" && CONFIDENCE_LEVEL_SET.has(level as string)) {
    const expected = confidenceLevelForScore(score);
    if (expected !== level) {
      errors.push(error("confidence_level_score_mismatch", "confidenceLevel", "Confidence level must match the confidence score band."));
    }
  }
}

function confidenceLevelForScore(score: number): PublicationLearningConfidenceLevel {
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

function validateEvidence(
  evidence: unknown,
  path: string,
  errors: PublicationLearningValidationError[],
): void {
  if (evidence === null) return;
  const record = asRecord(evidence);
  if (!hasText(record.evidenceId)) {
    errors.push(error("evidence_invalid", `${path}.evidenceId`, "Evidence id is required when evidence is present."));
  }
  if (
    record.containsPlatformPayload !== false ||
    record.containsSecrets !== false ||
    record.containsCredentials !== false ||
    record.containsModelWeights !== false ||
    record.containsTrainingData !== false ||
    record.providesRecommendation !== false
  ) {
    errors.push(error("evidence_invalid", path, "Learning evidence must be sanitized and must not provide a recommendation."));
  }
}

function validateInvariants(
  record: UnknownRecord,
  errors: PublicationLearningValidationError[],
): void {
  if (
    record.passiveOnly !== true ||
    record.candidateOnly !== true ||
    record.explainable !== true ||
    record.referencesOnly !== true ||
    record.containsEmbeddedPayload !== false ||
    record.performsNoModelTraining !== true ||
    record.producesNoStateMutatingRecommendation !== true ||
    record.triggersNoAutomation !== true ||
    record.triggersNoScheduling !== true ||
    record.triggersNoPublishing !== true ||
    record.callsNoExternalApis !== true ||
    record.usesNoSdks !== true ||
    record.usesNoNetwork !== true ||
    record.persistsNothing !== true ||
    record.exposesNoBridge !== true ||
    record.exposesNoAdminUi !== true ||
    record.exposesNoApiRoutes !== true ||
    record.mutatesNoCampaignMemory !== true ||
    record.mutatesNoDecisionHistory !== true ||
    record.mutatesNoApproval !== true ||
    record.mutatesNoLedger !== true ||
    record.mutatesNoManifest !== true ||
    record.mutatesNoTargets !== true ||
    record.mutatesNoScheduler !== true ||
    record.mutatesNoPublisher !== true ||
    record.mutatesNoMetrics !== true
  ) {
    errors.push(error("invariant_failed", "contract", "Learning insights must remain passive, explainable, and non-mutating."));
  }
}

function validateEnum(
  value: unknown,
  allowed: ReadonlySet<string>,
  path: string,
  requiredCode: PublicationLearningErrorCode,
  code: PublicationLearningErrorCode,
  errors: PublicationLearningValidationError[],
): void {
  if (!hasText(value)) {
    errors.push(error(requiredCode, path, "Learning enum value is required."));
    return;
  }
  if (!allowed.has(value)) {
    errors.push(error(code, path, "Learning enum value is not supported."));
  }
}

function validateTimestamp(
  value: unknown,
  path: string,
  code: PublicationLearningErrorCode,
  errors: PublicationLearningValidationError[],
): void {
  if (!hasText(value) || !Number.isFinite(Date.parse(value))) {
    errors.push(error(code, path, "Learning timestamp must be valid."));
  }
}

function findForbiddenState(
  value: unknown,
  path: string,
  errors: PublicationLearningValidationError[],
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findForbiddenState(entry, `${path}.${index}`, errors));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`;
    if (FORBIDDEN_SECRET_KEYS.has(key)) {
      errors.push(error("secret_forbidden", nestedPath, "Learning state must not contain secrets."));
    }
    if (FORBIDDEN_PLATFORM_PAYLOAD_KEYS.has(key)) {
      errors.push(error("platform_payload_forbidden", nestedPath, "Learning state must not contain platform payloads."));
    }
    if (FORBIDDEN_NETWORK_KEYS.has(key)) {
      errors.push(error("network_forbidden", nestedPath, "Learning state must not contain API clients, SDKs, URLs, or network instructions."));
    }
    if (FORBIDDEN_EXECUTION_KEYS.has(key)) {
      errors.push(error("execution_forbidden", nestedPath, "Learning state must not contain execution, publishing, scheduling, or worker instructions."));
    }
    if (FORBIDDEN_MODEL_TRAINING_KEYS.has(key)) {
      errors.push(error("model_training_forbidden", nestedPath, "Learning state must not contain model training state."));
    }
    if (FORBIDDEN_STATE_MUTATION_KEYS.has(key)) {
      errors.push(error("state_mutation_forbidden", nestedPath, "Learning state must not contain state-mutating recommendations."));
    }
    findForbiddenState(nested, nestedPath, errors);
  }
}

function error(
  code: PublicationLearningErrorCode,
  path: string,
  message: string,
): PublicationLearningValidationError {
  return { code, path, message };
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }
  return value;
}
