import {
  PUBLICATION_LEARNING_CANDIDATE_TYPES,
  PUBLICATION_LEARNING_CONFIDENCE_LEVELS,
  PUBLICATION_LEARNING_INSIGHT_STATUSES,
  PUBLICATION_LEARNING_INSIGHT_TYPES,
  PUBLICATION_LEARNING_SOURCES,
  hydratePublicationLearningInsight,
  serializePublicationLearningInsight,
  validatePublicationLearningInsight,
  type PublicationLearningCandidateType,
  type PublicationLearningConfidenceLevel,
  type PublicationLearningInsight,
  type PublicationLearningInsightStatus,
  type PublicationLearningInsightType,
  type PublicationLearningSource,
  type PublicationLearningValidationError,
} from "./social-publication-learning";

export type { PublicationLearningInsight } from "./social-publication-learning";

type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

type UnknownRecord = Readonly<Record<string, unknown>>;

export type SocialPublicationLearningInsightId = Brand<
  string,
  "SocialPublicationLearningInsightId"
>;
export type SocialPublicationLearningEvidenceId = Brand<
  string,
  "SocialPublicationLearningEvidenceId"
>;
export type SocialPublicationLearningSocialPostId = Brand<
  string,
  "SocialPublicationLearningSocialPostId"
>;
export type SocialPublicationLearningTargetId = Brand<
  string,
  "SocialPublicationLearningTargetId"
>;
export type SocialPublicationLearningCampaignId = Brand<
  string,
  "SocialPublicationLearningCampaignId"
>;
export type SocialPublicationLearningMetricObservationId = Brand<
  string,
  "SocialPublicationLearningMetricObservationId"
>;
export type SocialPublicationLearningPublisherRequestId = Brand<
  string,
  "SocialPublicationLearningPublisherRequestId"
>;
export type SocialPublicationLearningPublisherResultId = Brand<
  string,
  "SocialPublicationLearningPublisherResultId"
>;
export type SocialPublicationLearningPublisherJobId = Brand<
  string,
  "SocialPublicationLearningPublisherJobId"
>;
export type SocialPublicationLearningScheduleId = Brand<
  string,
  "SocialPublicationLearningScheduleId"
>;
export type SocialPublicationLearningLedgerEntryId = Brand<
  string,
  "SocialPublicationLearningLedgerEntryId"
>;
export type SocialPublicationLearningManifestId = Brand<
  string,
  "SocialPublicationLearningManifestId"
>;
export type SocialPublicationLearningOwnerApprovalId = Brand<
  string,
  "SocialPublicationLearningOwnerApprovalId"
>;
export type SocialPublicationLearningApprovalId = Brand<
  string,
  "SocialPublicationLearningApprovalId"
>;
export type SocialPublicationLearningCampaignMemoryId = Brand<
  string,
  "SocialPublicationLearningCampaignMemoryId"
>;
export type SocialPublicationLearningDecisionHistoryId = Brand<
  string,
  "SocialPublicationLearningDecisionHistoryId"
>;

export const SOCIAL_PUBLICATION_LEARNING_REPOSITORY_ERROR_CODES = [
  "validation_failed",
  "identity_required",
  "identity_collision",
  "relationship_invalid",
  "serialization_invalid",
  "contract_only",
] as const;

export const SOCIAL_PUBLICATION_LEARNING_RECORD_ERROR_CODES = [
  "required_field_missing",
  "identity_not_separated",
  "relationship_invalid",
  "insight_type_invalid",
  "candidate_type_invalid",
  "insight_status_invalid",
  "confidence_invalid",
  "source_invalid",
  "timestamp_invalid",
  "reasons_invalid",
  "rationale_invalid",
  "contract_invariant_failed",
  "secret_forbidden",
  "platform_payload_forbidden",
  "network_forbidden",
  "execution_forbidden",
  "model_training_forbidden",
  "state_mutation_forbidden",
  "persistence_forbidden",
  "learning_state_forbidden",
] as const;

export type SocialPublicationLearningRepositoryErrorCode =
  (typeof SOCIAL_PUBLICATION_LEARNING_REPOSITORY_ERROR_CODES)[number];
export type SocialPublicationLearningRecordErrorCode =
  (typeof SOCIAL_PUBLICATION_LEARNING_RECORD_ERROR_CODES)[number];

export type SocialPublicationLearningRecordError = Readonly<{
  code: SocialPublicationLearningRecordErrorCode;
  path: string;
  message: string;
}>;

export type SocialPublicationLearningRepositoryError = Readonly<{
  code: SocialPublicationLearningRepositoryErrorCode;
  message: string;
  validationErrors?: readonly (
    | SocialPublicationLearningRecordError
    | PublicationLearningValidationError
  )[];
}>;

export type SocialPublicationLearningRepositoryResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: SocialPublicationLearningRepositoryError }>;

export type SocialPublicationLearningRecordValidationResult = Readonly<
  | { ok: true; errors: readonly [] }
  | { ok: false; errors: readonly SocialPublicationLearningRecordError[] }
>;

export type SocialPublicationLearningScope = Readonly<{
  social_post_id: SocialPublicationLearningSocialPostId | null;
  publication_target_id: SocialPublicationLearningTargetId | null;
  campaign_id: SocialPublicationLearningCampaignId | null;
  metric_observation_id: SocialPublicationLearningMetricObservationId | null;
  publisher_request_id: SocialPublicationLearningPublisherRequestId | null;
  publisher_result_id: SocialPublicationLearningPublisherResultId | null;
  publisher_job_id: SocialPublicationLearningPublisherJobId | null;
  schedule_id: SocialPublicationLearningScheduleId | null;
  ledger_entry_id: SocialPublicationLearningLedgerEntryId | null;
  publication_manifest_id: SocialPublicationLearningManifestId | null;
  owner_approval_id: SocialPublicationLearningOwnerApprovalId | null;
  approval_id: SocialPublicationLearningApprovalId | null;
  campaign_memory_id: SocialPublicationLearningCampaignMemoryId | null;
  decision_history_id: SocialPublicationLearningDecisionHistoryId | null;
}>;

export type SocialPublicationLearningInsightRecord = Readonly<{
  learning_insight_id: SocialPublicationLearningInsightId;
  insight_type: PublicationLearningInsightType;
  candidate_type: PublicationLearningCandidateType;
  insight_status: PublicationLearningInsightStatus;
  confidence_score: number | null;
  confidence_level: PublicationLearningConfidenceLevel | null;
  learning_source: PublicationLearningSource;
  scope: SocialPublicationLearningScope;
  evidence_id: SocialPublicationLearningEvidenceId | null;
  rationale: string;
  blocked_reason: string | null;
  rejected_reason: string | null;
  observed_at: string;
  created_at: string;
  updated_at: string;
  passive_only: true;
  candidate_only: true;
  explainable: true;
  references_only: true;
  contains_embedded_payload: false;
  performs_no_model_training: true;
  produces_no_state_mutating_recommendation: true;
  triggers_no_automation: true;
  triggers_no_scheduling: true;
  triggers_no_publishing: true;
  calls_no_external_apis: true;
  uses_no_sdks: true;
  uses_no_network: true;
  persists_nothing: true;
  exposes_no_bridge: true;
  exposes_no_admin_ui: true;
  exposes_no_api_routes: true;
  mutates_no_campaign_memory: true;
  mutates_no_decision_history: true;
  mutates_no_approval: true;
  mutates_no_ledger: true;
  mutates_no_manifest: true;
  mutates_no_targets: true;
  mutates_no_scheduler: true;
  mutates_no_publisher: true;
  mutates_no_metrics: true;
}>;

export type SocialPublicationLearningPersistenceModel = Readonly<{
  insights: readonly SocialPublicationLearningInsightRecord[];
}>;

export type SocialPublicationLearningRepositoryIdentity = Readonly<{
  learning_insight_id?: string;
  candidate_type?: string;
  insight_status?: string;
  social_post_id?: string;
  publication_target_id?: string;
  campaign_id?: string;
  metric_observation_id?: string;
  publisher_request_id?: string;
  publisher_result_id?: string;
  publisher_job_id?: string;
  schedule_id?: string;
  ledger_entry_id?: string;
  publication_manifest_id?: string;
  owner_approval_id?: string;
  approval_id?: string;
  campaign_memory_id?: string;
  decision_history_id?: string;
}>;

export type SocialPublicationLearningAppendInsightRequest = Readonly<{
  insight: SocialPublicationLearningInsightRecord;
}>;

export type SocialPublicationLearningRepositorySnapshot =
  SocialPublicationLearningPersistenceModel;

export type SocialPublicationLearningRepository = Readonly<{
  appendLearningInsight(
    request: SocialPublicationLearningAppendInsightRequest,
  ): SocialPublicationLearningRepositoryResult<SocialPublicationLearningInsightRecord>;
  getLearningRecordsByIdentity(
    identity: SocialPublicationLearningRepositoryIdentity,
  ): SocialPublicationLearningRepositoryResult<SocialPublicationLearningPersistenceModel>;
  listLearningInsights(
    identity?: SocialPublicationLearningRepositoryIdentity,
  ): SocialPublicationLearningRepositoryResult<
    readonly SocialPublicationLearningInsightRecord[]
  >;
  snapshot(): SocialPublicationLearningRepositoryResult<SocialPublicationLearningRepositorySnapshot>;
}>;

const INSIGHT_TYPE_SET = new Set<string>(PUBLICATION_LEARNING_INSIGHT_TYPES);
const CANDIDATE_TYPE_SET = new Set<string>(PUBLICATION_LEARNING_CANDIDATE_TYPES);
const STATUS_SET = new Set<string>(PUBLICATION_LEARNING_INSIGHT_STATUSES);
const CONFIDENCE_LEVEL_SET = new Set<string>(PUBLICATION_LEARNING_CONFIDENCE_LEVELS);
const SOURCE_SET = new Set<string>(PUBLICATION_LEARNING_SOURCES);

export function createReferenceSocialPublicationLearningRepository(
  model: SocialPublicationLearningPersistenceModel = { insights: [] },
): SocialPublicationLearningRepository {
  const validation = validateSocialPublicationLearningPersistenceModel(model);
  if (!validation.ok) {
    throw new Error(`Invalid learning persistence model: ${validation.errors[0]?.message ?? "unknown error"}`);
  }

  const insights = [...model.insights];

  return {
    appendLearningInsight(request) {
      const validationResult = validateSocialPublicationLearningInsightRecord(request.insight);
      if (!validationResult.ok) {
        return repositoryError("validation_failed", "Learning insight record failed validation.", validationResult.errors);
      }
      if (insights.some((record) => record.learning_insight_id === request.insight.learning_insight_id)) {
        return repositoryError("identity_collision", "Learning insight identity already exists.");
      }
      insights.push(deepFreeze({ ...request.insight, scope: { ...request.insight.scope } }));
      return { ok: true, value: request.insight };
    },
    getLearningRecordsByIdentity(identity) {
      return {
        ok: true,
        value: deepFreeze({
          insights: filterInsights(insights, identity),
        }),
      };
    },
    listLearningInsights(identity = {}) {
      return { ok: true, value: filterInsights(insights, identity) };
    },
    snapshot() {
      return { ok: true, value: deepFreeze({ insights: [...insights] }) };
    },
  };
}

export function learningInsightToRecord(
  insight: PublicationLearningInsight,
): SocialPublicationLearningRepositoryResult<SocialPublicationLearningInsightRecord> {
  const validation = validatePublicationLearningInsight(insight);
  if (!validation.ok) {
    return repositoryError("validation_failed", "Learning insight failed domain validation.", validation.errors);
  }

  const record: SocialPublicationLearningInsightRecord = {
    learning_insight_id: insight.insightId as SocialPublicationLearningInsightId,
    insight_type: insight.insightType,
    candidate_type: insight.candidateType,
    insight_status: insight.status,
    confidence_score: insight.confidenceScore,
    confidence_level: insight.confidenceLevel,
    learning_source: insight.source,
    scope: {
      social_post_id: insight.references.socialPostId as SocialPublicationLearningSocialPostId | null,
      publication_target_id: insight.references.publicationTargetId as SocialPublicationLearningTargetId | null,
      campaign_id: insight.references.campaignId as SocialPublicationLearningCampaignId | null,
      metric_observation_id: insight.references.metricObservationId as SocialPublicationLearningMetricObservationId | null,
      publisher_request_id: insight.references.publisherRequestId as SocialPublicationLearningPublisherRequestId | null,
      publisher_result_id: insight.references.publisherResultId as SocialPublicationLearningPublisherResultId | null,
      publisher_job_id: insight.references.publisherJobId as SocialPublicationLearningPublisherJobId | null,
      schedule_id: insight.references.scheduleId as SocialPublicationLearningScheduleId | null,
      ledger_entry_id: insight.references.ledgerEntryId as SocialPublicationLearningLedgerEntryId | null,
      publication_manifest_id: insight.references.publicationManifestId as SocialPublicationLearningManifestId | null,
      owner_approval_id: insight.references.ownerApprovalId as SocialPublicationLearningOwnerApprovalId | null,
      approval_id: insight.references.approvalId as SocialPublicationLearningApprovalId | null,
      campaign_memory_id: insight.references.campaignMemoryId as SocialPublicationLearningCampaignMemoryId | null,
      decision_history_id: insight.references.decisionHistoryId as SocialPublicationLearningDecisionHistoryId | null,
    },
    evidence_id: insight.evidence?.evidenceId as SocialPublicationLearningEvidenceId | null,
    rationale: insight.rationale,
    blocked_reason: insight.blockedReason,
    rejected_reason: insight.rejectedReason,
    observed_at: insight.observedAt,
    created_at: insight.createdAt,
    updated_at: insight.updatedAt,
    passive_only: true,
    candidate_only: true,
    explainable: true,
    references_only: true,
    contains_embedded_payload: false,
    performs_no_model_training: true,
    produces_no_state_mutating_recommendation: true,
    triggers_no_automation: true,
    triggers_no_scheduling: true,
    triggers_no_publishing: true,
    calls_no_external_apis: true,
    uses_no_sdks: true,
    uses_no_network: true,
    persists_nothing: true,
    exposes_no_bridge: true,
    exposes_no_admin_ui: true,
    exposes_no_api_routes: true,
    mutates_no_campaign_memory: true,
    mutates_no_decision_history: true,
    mutates_no_approval: true,
    mutates_no_ledger: true,
    mutates_no_manifest: true,
    mutates_no_targets: true,
    mutates_no_scheduler: true,
    mutates_no_publisher: true,
    mutates_no_metrics: true,
  };

  const recordValidation = validateSocialPublicationLearningInsightRecord(record);
  if (!recordValidation.ok) {
    return repositoryError("serialization_invalid", "Learning insight record failed validation.", recordValidation.errors);
  }
  return { ok: true, value: deepFreeze(record) };
}

export function learningRecordToInsight(
  record: SocialPublicationLearningInsightRecord,
): SocialPublicationLearningRepositoryResult<PublicationLearningInsight> {
  const validation = validateSocialPublicationLearningInsightRecord(record);
  if (!validation.ok) {
    return repositoryError("validation_failed", "Learning insight record failed validation.", validation.errors);
  }

  const insight = hydratePublicationLearningInsight(
    serializePublicationLearningInsight({
      insightId: record.learning_insight_id,
      insightType: record.insight_type,
      candidateType: record.candidate_type,
      status: record.insight_status,
      confidenceScore: record.confidence_score,
      confidenceLevel: record.confidence_level,
      source: record.learning_source,
      references: {
        socialPostId: record.scope.social_post_id,
        publicationTargetId: record.scope.publication_target_id,
        campaignId: record.scope.campaign_id,
        metricObservationId: record.scope.metric_observation_id,
        publisherRequestId: record.scope.publisher_request_id,
        publisherResultId: record.scope.publisher_result_id,
        publisherJobId: record.scope.publisher_job_id,
        scheduleId: record.scope.schedule_id,
        ledgerEntryId: record.scope.ledger_entry_id,
        publicationManifestId: record.scope.publication_manifest_id,
        ownerApprovalId: record.scope.owner_approval_id,
        approvalId: record.scope.approval_id,
        campaignMemoryId: record.scope.campaign_memory_id,
        decisionHistoryId: record.scope.decision_history_id,
      },
      evidence: record.evidence_id
        ? {
            evidenceId: record.evidence_id,
            evidenceKind: "manual_note",
            evidence: {},
            notes: null,
            containsPlatformPayload: false,
            containsSecrets: false,
            containsCredentials: false,
            containsModelWeights: false,
            containsTrainingData: false,
            providesRecommendation: false,
          }
        : null,
      rationale: record.rationale,
      blockedReason: record.blocked_reason,
      rejectedReason: record.rejected_reason,
      observedAt: record.observed_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      passiveOnly: true,
      candidateOnly: true,
      explainable: true,
      referencesOnly: true,
      containsEmbeddedPayload: false,
      performsNoModelTraining: true,
      producesNoStateMutatingRecommendation: true,
      triggersNoAutomation: true,
      triggersNoScheduling: true,
      triggersNoPublishing: true,
      callsNoExternalApis: true,
      usesNoSdks: true,
      usesNoNetwork: true,
      persistsNothing: true,
      exposesNoBridge: true,
      exposesNoAdminUi: true,
      exposesNoApiRoutes: true,
      mutatesNoCampaignMemory: true,
      mutatesNoDecisionHistory: true,
      mutatesNoApproval: true,
      mutatesNoLedger: true,
      mutatesNoManifest: true,
      mutatesNoTargets: true,
      mutatesNoScheduler: true,
      mutatesNoPublisher: true,
      mutatesNoMetrics: true,
    }),
  );
  return { ok: true, value: insight };
}

export function validateSocialPublicationLearningPersistenceModel(
  model: SocialPublicationLearningPersistenceModel,
): SocialPublicationLearningRecordValidationResult {
  const errors: SocialPublicationLearningRecordError[] = [];
  const seen = new Set<string>();
  model.insights.forEach((record, index) => {
    validateSocialPublicationLearningInsightRecord(record, `insights.${index}`, errors);
    validateUnique(record.learning_insight_id, `insights.${index}.learning_insight_id`, seen, errors);
  });
  return errors.length === 0
    ? { ok: true, errors: [] }
    : { ok: false, errors: deepFreeze(errors) };
}

export function validateSocialPublicationLearningInsightRecord(
  record: SocialPublicationLearningInsightRecord,
  path = "insight",
  errors: SocialPublicationLearningRecordError[] = [],
): SocialPublicationLearningRecordValidationResult {
  const value = asRecord(record);
  if (!hasText(value.learning_insight_id)) {
    errors.push(recordError("required_field_missing", `${path}.learning_insight_id`, "Learning insight id is required."));
  }
  validateEnum(value.insight_type, INSIGHT_TYPE_SET, `${path}.insight_type`, "insight_type_invalid", errors);
  validateEnum(value.candidate_type, CANDIDATE_TYPE_SET, `${path}.candidate_type`, "candidate_type_invalid", errors);
  validateEnum(value.insight_status, STATUS_SET, `${path}.insight_status`, "insight_status_invalid", errors);
  validateEnum(value.learning_source, SOURCE_SET, `${path}.learning_source`, "source_invalid", errors);
  validateConfidence(value.confidence_score, value.confidence_level, `${path}`, errors);
  validateScope(value.scope, `${path}.scope`, errors);
  validateReasons(value.insight_status, value.blocked_reason, value.rejected_reason, path, errors);
  if (!hasText(value.rationale)) {
    errors.push(recordError("rationale_invalid", `${path}.rationale`, "Learning insight rationale is required."));
  }
  validateTimestamp(value.observed_at, `${path}.observed_at`, errors);
  validateTimestamp(value.created_at, `${path}.created_at`, errors);
  validateTimestamp(value.updated_at, `${path}.updated_at`, errors);
  validateRecordInvariants(value, path, errors);
  findForbiddenRecordState(value, path, errors);

  return errors.length === 0
    ? { ok: true, errors: [] }
    : { ok: false, errors: deepFreeze(errors) };
}

function filterInsights(
  insights: readonly SocialPublicationLearningInsightRecord[],
  identity: SocialPublicationLearningRepositoryIdentity,
): readonly SocialPublicationLearningInsightRecord[] {
  return deepFreeze(
    insights.filter((record) => {
      const scope = record.scope;
      return (
        matches(identity.learning_insight_id, record.learning_insight_id) &&
        matches(identity.candidate_type, record.candidate_type) &&
        matches(identity.insight_status, record.insight_status) &&
        matches(identity.social_post_id, scope.social_post_id) &&
        matches(identity.publication_target_id, scope.publication_target_id) &&
        matches(identity.campaign_id, scope.campaign_id) &&
        matches(identity.metric_observation_id, scope.metric_observation_id) &&
        matches(identity.publisher_request_id, scope.publisher_request_id) &&
        matches(identity.publisher_result_id, scope.publisher_result_id) &&
        matches(identity.publisher_job_id, scope.publisher_job_id) &&
        matches(identity.schedule_id, scope.schedule_id) &&
        matches(identity.ledger_entry_id, scope.ledger_entry_id) &&
        matches(identity.publication_manifest_id, scope.publication_manifest_id) &&
        matches(identity.owner_approval_id, scope.owner_approval_id) &&
        matches(identity.approval_id, scope.approval_id) &&
        matches(identity.campaign_memory_id, scope.campaign_memory_id) &&
        matches(identity.decision_history_id, scope.decision_history_id)
      );
    }),
  );
}

function validateScope(
  scope: unknown,
  path: string,
  errors: SocialPublicationLearningRecordError[],
): void {
  const record = asRecord(scope);
  const fields = [
    "social_post_id",
    "publication_target_id",
    "campaign_id",
    "metric_observation_id",
    "publisher_request_id",
    "publisher_result_id",
    "publisher_job_id",
    "schedule_id",
    "ledger_entry_id",
    "publication_manifest_id",
    "owner_approval_id",
    "approval_id",
    "campaign_memory_id",
    "decision_history_id",
  ];
  let hasAnyReference = false;
  for (const key of fields) {
    const fieldValue = record[key];
    if (fieldValue !== null && fieldValue !== undefined) {
      if (!hasText(fieldValue)) {
        errors.push(recordError("relationship_invalid", `${path}.${key}`, "Optional references must be text or null."));
      } else {
        hasAnyReference = true;
      }
    }
  }
  if (!hasAnyReference) {
    errors.push(recordError("relationship_invalid", path, "A learning insight record must reference at least one prior record by id."));
  }
}

function validateConfidence(
  score: unknown,
  level: unknown,
  path: string,
  errors: SocialPublicationLearningRecordError[],
): void {
  const scorePresent = score !== null && score !== undefined;
  const levelPresent = level !== null && level !== undefined;

  if (scorePresent && (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1)) {
    errors.push(recordError("confidence_invalid", `${path}.confidence_score`, "Confidence score must be a number between 0 and 1."));
  }
  if (levelPresent && !CONFIDENCE_LEVEL_SET.has(level as string)) {
    errors.push(recordError("confidence_invalid", `${path}.confidence_level`, "Confidence level is not supported."));
  }
  if (scorePresent !== levelPresent) {
    errors.push(recordError("confidence_invalid", `${path}.confidence_level`, "Confidence score and level must both be present or both be null."));
  }
}

function validateReasons(
  status: unknown,
  blockedReason: unknown,
  rejectedReason: unknown,
  path: string,
  errors: SocialPublicationLearningRecordError[],
): void {
  if (status === "blocked") {
    if (!hasText(blockedReason)) {
      errors.push(recordError("reasons_invalid", `${path}.blocked_reason`, "Blocked insights require a blocked reason."));
    }
    if (rejectedReason !== null) {
      errors.push(recordError("reasons_invalid", `${path}.rejected_reason`, "Blocked insights must not carry a rejected reason."));
    }
    return;
  }
  if (status === "rejected") {
    if (!hasText(rejectedReason)) {
      errors.push(recordError("reasons_invalid", `${path}.rejected_reason`, "Rejected insights require a rejected reason."));
    }
    if (blockedReason !== null) {
      errors.push(recordError("reasons_invalid", `${path}.blocked_reason`, "Rejected insights must not carry a blocked reason."));
    }
    return;
  }
  if (blockedReason !== null || rejectedReason !== null) {
    errors.push(recordError("reasons_invalid", path, "Only blocked or rejected insights may carry a status reason."));
  }
}

function validateRecordInvariants(
  record: UnknownRecord,
  path: string,
  errors: SocialPublicationLearningRecordError[],
): void {
  if (
    record.passive_only !== true ||
    record.candidate_only !== true ||
    record.explainable !== true ||
    record.references_only !== true ||
    record.contains_embedded_payload !== false ||
    record.performs_no_model_training !== true ||
    record.produces_no_state_mutating_recommendation !== true ||
    record.triggers_no_automation !== true ||
    record.triggers_no_scheduling !== true ||
    record.triggers_no_publishing !== true ||
    record.calls_no_external_apis !== true ||
    record.uses_no_sdks !== true ||
    record.uses_no_network !== true ||
    record.persists_nothing !== true ||
    record.exposes_no_bridge !== true ||
    record.exposes_no_admin_ui !== true ||
    record.exposes_no_api_routes !== true ||
    record.mutates_no_campaign_memory !== true ||
    record.mutates_no_decision_history !== true ||
    record.mutates_no_approval !== true ||
    record.mutates_no_ledger !== true ||
    record.mutates_no_manifest !== true ||
    record.mutates_no_targets !== true ||
    record.mutates_no_scheduler !== true ||
    record.mutates_no_publisher !== true ||
    record.mutates_no_metrics !== true
  ) {
    errors.push(recordError("contract_invariant_failed", `${path}.contract`, "Learning insight records must remain passive, explainable, and non-mutating."));
  }
}

function validateTimestamp(
  value: unknown,
  path: string,
  errors: SocialPublicationLearningRecordError[],
): void {
  if (!hasText(value) || !Number.isFinite(Date.parse(value))) {
    errors.push(recordError("timestamp_invalid", path, "Learning record timestamp must be valid."));
  }
}

function validateEnum(
  value: unknown,
  allowed: ReadonlySet<string>,
  path: string,
  code: SocialPublicationLearningRecordErrorCode,
  errors: SocialPublicationLearningRecordError[],
): void {
  if (!hasText(value) || !allowed.has(value)) {
    errors.push(recordError(code, path, "Learning record enum value is not supported."));
  }
}

function validateUnique(
  value: unknown,
  path: string,
  seen: Set<string>,
  errors: SocialPublicationLearningRecordError[],
): void {
  if (!hasText(value)) return;
  if (seen.has(value)) {
    errors.push(recordError("identity_not_separated", path, "Learning insight identities must be unique."));
    return;
  }
  seen.add(value);
}

function findForbiddenRecordState(
  value: unknown,
  path: string,
  errors: SocialPublicationLearningRecordError[],
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findForbiddenRecordState(entry, `${path}.${index}`, errors));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`;
    if (["secret", "access_token", "api_key", "credentials", "oauth"].includes(key)) {
      errors.push(recordError("secret_forbidden", nestedPath, "Learning records must not contain secrets."));
    }
    if (["rawMetrics", "rawResponse", "platformPayload", "apiResponse"].includes(key)) {
      errors.push(recordError("platform_payload_forbidden", nestedPath, "Learning records must not contain platform payloads."));
    }
    if (["fetch", "http", "endpoint", "sdk", "client"].includes(key)) {
      errors.push(recordError("network_forbidden", nestedPath, "Learning records must not contain network or SDK state."));
    }
    if (["cron", "timer", "worker", "queue", "publish", "executionPlan"].includes(key)) {
      errors.push(recordError("execution_forbidden", nestedPath, "Learning records must not contain execution state."));
    }
    if (["modelWeights", "trainingData", "trainingJob", "fineTune", "gradient", "checkpoint"].includes(key)) {
      errors.push(recordError("model_training_forbidden", nestedPath, "Learning records must not contain model training state."));
    }
    if (["autoApply", "autoPromote", "autoPublish", "autoSchedule", "mutateCampaignMemory"].includes(key)) {
      errors.push(recordError("state_mutation_forbidden", nestedPath, "Learning records must not contain state-mutating recommendations."));
    }
    findForbiddenRecordState(nested, nestedPath, errors);
  }
}

function repositoryError<T>(
  code: SocialPublicationLearningRepositoryErrorCode,
  message: string,
  validationErrors?: readonly (
    | SocialPublicationLearningRecordError
    | PublicationLearningValidationError
  )[],
): SocialPublicationLearningRepositoryResult<T> {
  return {
    ok: false,
    error: validationErrors ? { code, message, validationErrors } : { code, message },
  };
}

function recordError(
  code: SocialPublicationLearningRecordErrorCode,
  path: string,
  message: string,
): SocialPublicationLearningRecordError {
  return { code, path, message };
}

function matches(expected: string | undefined, actual: string | null): boolean {
  return expected === undefined || expected === actual;
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
