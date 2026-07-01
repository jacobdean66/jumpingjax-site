import { createServiceRoleClient, isSupabaseServiceConfigured } from "../supabase/admin";

import {
  mapSocialPublicationMetricEvidenceRecordToRow,
  mapSocialPublicationMetricEvidenceRowToRecord,
  mapSocialPublicationMetricObservationRecordToRow,
  mapSocialPublicationMetricObservationRowToRecord,
  mapSocialPublicationMetricRowsToRepositoryModel,
  validateSocialPublicationMetricEvidenceRow,
  validateSocialPublicationMetricObservationRow,
  type SocialPublicationMetricEvidenceRecord,
  type SocialPublicationMetricEvidenceRow,
  type SocialPublicationMetricObservationRow,
  type SocialPublicationMetricRowError,
  type SocialPublicationMetricRowsModel,
} from "./social-publication-metrics-rows";
import {
  validateSocialPublicationMetricObservationRecord,
  type SocialPublicationMetricObservationRecord,
  type SocialPublicationMetricPersistenceModel,
  type SocialPublicationMetricRecordError,
} from "./social-publication-metrics-repository";

export const SOCIAL_PUBLICATION_METRIC_STORE_ERROR_CODES = [
  "validation_failed",
  "duplicate_identity",
  "duplicate_idempotency_key",
  "parent_missing",
  "scope_mismatch",
  "storage_error",
  "storage_inconsistent",
] as const;

export type SocialPublicationMetricStoreErrorCode =
  (typeof SOCIAL_PUBLICATION_METRIC_STORE_ERROR_CODES)[number];

export type SocialPublicationMetricStoreError = Readonly<{
  code: SocialPublicationMetricStoreErrorCode;
  message: string;
  validationErrors?: readonly (
    | SocialPublicationMetricRecordError
    | SocialPublicationMetricRowError
  )[];
}>;

export type SocialPublicationMetricStoreResult<T> = Readonly<
  | { ok: true; value: T }
  | { ok: false; error: SocialPublicationMetricStoreError }
>;

export type SocialPublicationMetricStoreWriteOptions = Readonly<{
  idempotencyKey?: string | null;
}>;

export type SocialPublicationMetricReadFilter = Readonly<{
  metricObservationId?: string;
  metricName?: string;
  metricStatus?: string;
  socialPostId?: string;
  publicationTargetId?: string;
  publisherRequestId?: string;
  publisherResultId?: string;
  publisherJobId?: string;
  scheduleId?: string;
  ledgerEntryId?: string;
  publicationManifestId?: string;
  ownerApprovalId?: string;
}>;

export type SocialPublicationMetricStoreStorage = Readonly<{
  insertObservation(
    row: SocialPublicationMetricObservationRow,
  ): Promise<SocialPublicationMetricObservationRow>;
  insertEvidence(
    row: SocialPublicationMetricEvidenceRow,
  ): Promise<SocialPublicationMetricEvidenceRow>;
  findObservationByObservationId(
    metricObservationId: string,
  ): Promise<SocialPublicationMetricObservationRow | null>;
  findObservationByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialPublicationMetricObservationRow | null>;
  findEvidenceByEvidenceId(
    evidenceId: string,
  ): Promise<SocialPublicationMetricEvidenceRow | null>;
  findEvidenceByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialPublicationMetricEvidenceRow | null>;
  fetchObservations(
    filter: SocialPublicationMetricReadFilter,
  ): Promise<SocialPublicationMetricObservationRow[]>;
  fetchEvidence(
    filter: SocialPublicationMetricReadFilter,
  ): Promise<SocialPublicationMetricEvidenceRow[]>;
}>;

const OBSERVATION_SELECT =
  "metric_observation_id, observation_type, metric_name, metric_status, metric_value, aggregation_type, observation_source, social_post_id, publication_target_id, publisher_request_id, publisher_result_id, publisher_job_id, schedule_id, ledger_entry_id, publication_manifest_id, owner_approval_id, approval_id, proposal_id, evidence_id, observed_at, created_at, updated_at, recorded_by_actor, recorded_source, passive_only, observation_only, references_only, contains_platform_payload, collects_no_metrics, calls_no_external_apis, uses_no_sdks, uses_no_network, executes_nothing, publishes_nothing, schedules_nothing, mutates_no_scheduler, mutates_no_publisher, mutates_no_ledger, mutates_no_approval, mutates_no_manifest, mutates_no_targets, exposes_no_api_routes, performs_no_learning, append_only, immutable, idempotency_key";

const EVIDENCE_SELECT =
  "evidence_id, metric_observation_id, evidence_kind, notes, evidence, external_report_reference, social_post_id, publication_target_id, publisher_request_id, publisher_result_id, publisher_job_id, schedule_id, ledger_entry_id, publication_manifest_id, owner_approval_id, approval_id, proposal_id, recorded_at, recorded_by_actor, recorded_source, contains_platform_payload, contains_secrets, contains_credentials, contains_sdk_client, contains_raw_api_response, proves_collection, append_only, immutable, idempotency_key";

let testStorage: SocialPublicationMetricStoreStorage | null = null;

export function configureSocialPublicationMetricStoreTestDependencies(
  storage: SocialPublicationMetricStoreStorage | null,
): void {
  testStorage = storage;
}

export function isSocialPublicationMetricStoreConfigured(): boolean {
  return isSupabaseServiceConfigured();
}

export async function appendSocialPublicationMetricObservation(
  record: SocialPublicationMetricObservationRecord,
  options: SocialPublicationMetricStoreWriteOptions = {},
): Promise<SocialPublicationMetricStoreResult<SocialPublicationMetricObservationRecord>> {
  const recordValidation = validateSocialPublicationMetricObservationRecord(record);
  if (!recordValidation.ok) {
    return validationFailure("Metric observation record failed validation.", recordValidation.errors);
  }

  const rowResult = mapSocialPublicationMetricObservationRecordToRow(record, {
    idempotency_key: options.idempotencyKey ?? null,
  });
  if (!rowResult.ok) {
    return validationFailure("Metric observation row failed validation.", rowResult.errors);
  }

  try {
    const duplicate = await findObservationDuplicate(rowResult.value);
    if (duplicate) return duplicate;

    return mapStoredObservationRow(
      await storage().insertObservation(rowResult.value),
      "append observation",
    );
  } catch (error) {
    return storageFailure(error, "Metric observation write failed.");
  }
}

export async function insertSocialPublicationMetricEvidence(
  record: SocialPublicationMetricEvidenceRecord,
  options: SocialPublicationMetricStoreWriteOptions = {},
): Promise<SocialPublicationMetricStoreResult<SocialPublicationMetricEvidenceRecord>> {
  const rowResult = mapSocialPublicationMetricEvidenceRecordToRow(record, {
    idempotency_key: options.idempotencyKey ?? null,
  });
  if (!rowResult.ok) {
    return validationFailure("Metric evidence row failed validation.", rowResult.errors);
  }

  try {
    const parentError = await validateEvidenceParent(rowResult.value);
    if (parentError) return { ok: false, error: parentError };

    const duplicate = await findEvidenceDuplicate(rowResult.value);
    if (duplicate) return duplicate;

    return mapStoredEvidenceRow(
      await storage().insertEvidence(rowResult.value),
      "insert evidence",
    );
  } catch (error) {
    return storageFailure(error, "Metric evidence write failed.");
  }
}

export async function fetchSocialPublicationMetricRows(
  filter: SocialPublicationMetricReadFilter = {},
): Promise<SocialPublicationMetricStoreResult<SocialPublicationMetricRowsModel>> {
  try {
    const rows = {
      observations: await storage().fetchObservations(filter),
      evidence: await storage().fetchEvidence(filter),
    };
    return mapStoredRowsModel(rows, "fetch metric rows");
  } catch (error) {
    return storageFailure(error, "Metric read failed.");
  }
}

export async function fetchSocialPublicationMetricRecords(
  filter: SocialPublicationMetricReadFilter = {},
): Promise<SocialPublicationMetricStoreResult<SocialPublicationMetricPersistenceModel>> {
  const rows = await fetchSocialPublicationMetricRows(filter);
  if (!rows.ok) return rows;

  const mapped = mapSocialPublicationMetricRowsToRepositoryModel(rows.value);
  if (!mapped.ok) {
    return validationFailure(
      "Metric rows failed repository mapping during read.",
      mapped.errors,
    );
  }

  return { ok: true, value: mapped.value };
}

export async function fetchSocialPublicationMetricObservationRows(
  filter: SocialPublicationMetricReadFilter = {},
): Promise<SocialPublicationMetricStoreResult<readonly SocialPublicationMetricObservationRow[]>> {
  try {
    return mapStoredObservationRows(await storage().fetchObservations(filter), "fetch observations");
  } catch (error) {
    return storageFailure(error, "Metric observation read failed.");
  }
}

export async function fetchSocialPublicationMetricEvidenceRows(
  filter: SocialPublicationMetricReadFilter = {},
): Promise<SocialPublicationMetricStoreResult<readonly SocialPublicationMetricEvidenceRow[]>> {
  try {
    return mapStoredEvidenceRows(await storage().fetchEvidence(filter), "fetch evidence");
  } catch (error) {
    return storageFailure(error, "Metric evidence read failed.");
  }
}

function storage(): SocialPublicationMetricStoreStorage {
  if (testStorage) return testStorage;
  return createSupabaseMetricStoreStorage();
}

function createSupabaseMetricStoreStorage(): SocialPublicationMetricStoreStorage {
  const supabase = createServiceRoleClient();

  return {
    async insertObservation(row) {
      const { data, error } = await supabase
        .from("social_publication_metric_observations")
        .insert(row)
        .select(OBSERVATION_SELECT)
        .single<SocialPublicationMetricObservationRow>();
      if (error) throw new Error(error.message);
      return data;
    },
    async insertEvidence(row) {
      const { data, error } = await supabase
        .from("social_publication_metric_evidence")
        .insert(row)
        .select(EVIDENCE_SELECT)
        .single<SocialPublicationMetricEvidenceRow>();
      if (error) throw new Error(error.message);
      return data;
    },
    findObservationByObservationId(metricObservationId) {
      return maybeSingleObservation("metric_observation_id", metricObservationId);
    },
    findObservationByIdempotencyKey(idempotencyKey) {
      return maybeSingleObservation("idempotency_key", idempotencyKey);
    },
    findEvidenceByEvidenceId(evidenceId) {
      return maybeSingleEvidence("evidence_id", evidenceId);
    },
    findEvidenceByIdempotencyKey(idempotencyKey) {
      return maybeSingleEvidence("idempotency_key", idempotencyKey);
    },
    fetchObservations(filter) {
      return applyObservationReadFilter(filter);
    },
    fetchEvidence(filter) {
      return applyEvidenceReadFilter(filter);
    },
  };

  async function maybeSingleObservation(
    column: string,
    value: string,
  ): Promise<SocialPublicationMetricObservationRow | null> {
    const { data, error } = await supabase
      .from("social_publication_metric_observations")
      .select(OBSERVATION_SELECT)
      .eq(column, value)
      .maybeSingle<SocialPublicationMetricObservationRow>();
    if (error) throw new Error(error.message);
    return data;
  }

  async function maybeSingleEvidence(
    column: string,
    value: string,
  ): Promise<SocialPublicationMetricEvidenceRow | null> {
    const { data, error } = await supabase
      .from("social_publication_metric_evidence")
      .select(EVIDENCE_SELECT)
      .eq(column, value)
      .maybeSingle<SocialPublicationMetricEvidenceRow>();
    if (error) throw new Error(error.message);
    return data;
  }

  async function applyObservationReadFilter(
    filter: SocialPublicationMetricReadFilter,
  ): Promise<SocialPublicationMetricObservationRow[]> {
    let query = supabase
      .from("social_publication_metric_observations")
      .select(OBSERVATION_SELECT);
    query = applyReadFilter(query, filter);

    const { data, error } = await query
      .order("observed_at", { ascending: true })
      .order("metric_observation_id", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as SocialPublicationMetricObservationRow[];
  }

  async function applyEvidenceReadFilter(
    filter: SocialPublicationMetricReadFilter,
  ): Promise<SocialPublicationMetricEvidenceRow[]> {
    let query = supabase
      .from("social_publication_metric_evidence")
      .select(EVIDENCE_SELECT);
    query = applyReadFilter(query, filter);

    const { data, error } = await query
      .order("recorded_at", { ascending: true })
      .order("evidence_id", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as SocialPublicationMetricEvidenceRow[];
  }
}

function applyReadFilter<TQuery extends { eq: (column: string, value: string) => TQuery }>(
  query: TQuery,
  filter: SocialPublicationMetricReadFilter,
): TQuery {
  let nextQuery = query;
  if (filter.metricObservationId) {
    nextQuery = nextQuery.eq("metric_observation_id", filter.metricObservationId);
  }
  if (filter.metricName) nextQuery = nextQuery.eq("metric_name", filter.metricName);
  if (filter.metricStatus) nextQuery = nextQuery.eq("metric_status", filter.metricStatus);
  if (filter.socialPostId) nextQuery = nextQuery.eq("social_post_id", filter.socialPostId);
  if (filter.publicationTargetId) {
    nextQuery = nextQuery.eq("publication_target_id", filter.publicationTargetId);
  }
  if (filter.publisherRequestId) {
    nextQuery = nextQuery.eq("publisher_request_id", filter.publisherRequestId);
  }
  if (filter.publisherResultId) {
    nextQuery = nextQuery.eq("publisher_result_id", filter.publisherResultId);
  }
  if (filter.publisherJobId) nextQuery = nextQuery.eq("publisher_job_id", filter.publisherJobId);
  if (filter.scheduleId) nextQuery = nextQuery.eq("schedule_id", filter.scheduleId);
  if (filter.ledgerEntryId) nextQuery = nextQuery.eq("ledger_entry_id", filter.ledgerEntryId);
  if (filter.publicationManifestId) {
    nextQuery = nextQuery.eq("publication_manifest_id", filter.publicationManifestId);
  }
  if (filter.ownerApprovalId) nextQuery = nextQuery.eq("owner_approval_id", filter.ownerApprovalId);
  return nextQuery;
}

async function findObservationDuplicate(
  row: SocialPublicationMetricObservationRow,
): Promise<SocialPublicationMetricStoreResult<never> | null> {
  if (await storage().findObservationByObservationId(row.metric_observation_id)) {
    return duplicateIdentity("Metric observation identity already exists.");
  }
  if (
    row.idempotency_key &&
    (await storage().findObservationByIdempotencyKey(row.idempotency_key))
  ) {
    return duplicateIdempotency();
  }
  return null;
}

async function findEvidenceDuplicate(
  row: SocialPublicationMetricEvidenceRow,
): Promise<SocialPublicationMetricStoreResult<never> | null> {
  if (await storage().findEvidenceByEvidenceId(row.evidence_id)) {
    return duplicateIdentity("Metric evidence identity already exists.");
  }
  if (
    row.idempotency_key &&
    (await storage().findEvidenceByIdempotencyKey(row.idempotency_key))
  ) {
    return duplicateIdempotency();
  }
  return null;
}

async function validateEvidenceParent(
  row: SocialPublicationMetricEvidenceRow,
): Promise<SocialPublicationMetricStoreError | null> {
  const observation = await storage().findObservationByObservationId(
    row.metric_observation_id,
  );
  if (!observation) {
    return storeError("parent_missing", "Metric evidence parent observation is missing.");
  }
  return rowsShareScope(observation, row)
    ? null
    : storeError("scope_mismatch", "Metric evidence scope must match parent observation scope.");
}

function rowsShareScope(
  observation: SocialPublicationMetricObservationRow,
  evidence: SocialPublicationMetricEvidenceRow,
): boolean {
  return [
    "social_post_id",
    "publication_target_id",
    "publisher_request_id",
    "publisher_result_id",
    "publisher_job_id",
    "schedule_id",
    "ledger_entry_id",
    "publication_manifest_id",
    "owner_approval_id",
    "approval_id",
    "proposal_id",
  ].every((key) => observation[key as keyof typeof observation] === evidence[key as keyof typeof evidence]);
}

function mapStoredRowsModel(
  rows: SocialPublicationMetricRowsModel,
  context: string,
): SocialPublicationMetricStoreResult<SocialPublicationMetricRowsModel> {
  const observations = mapStoredObservationRows(rows.observations, context);
  if (!observations.ok) return observations;
  const evidence = mapStoredEvidenceRows(rows.evidence, context);
  if (!evidence.ok) return evidence;
  return { ok: true, value: immutableClone({ observations: observations.value, evidence: evidence.value }) };
}

function mapStoredObservationRows(
  rows: readonly SocialPublicationMetricObservationRow[],
  context: string,
): SocialPublicationMetricStoreResult<readonly SocialPublicationMetricObservationRow[]> {
  const mapped: SocialPublicationMetricObservationRow[] = [];
  for (const row of rows) {
    const result = mapStoredObservationRowToRow(row, context);
    if (!result.ok) return result;
    mapped.push(result.value);
  }
  return { ok: true, value: mapped };
}

function mapStoredEvidenceRows(
  rows: readonly SocialPublicationMetricEvidenceRow[],
  context: string,
): SocialPublicationMetricStoreResult<readonly SocialPublicationMetricEvidenceRow[]> {
  const mapped: SocialPublicationMetricEvidenceRow[] = [];
  for (const row of rows) {
    const result = mapStoredEvidenceRowToRow(row, context);
    if (!result.ok) return result;
    mapped.push(result.value);
  }
  return { ok: true, value: mapped };
}

function mapStoredObservationRow(
  row: SocialPublicationMetricObservationRow,
  context: string,
): SocialPublicationMetricStoreResult<SocialPublicationMetricObservationRecord> {
  const mapped = mapStoredObservationRowToRow(row, context);
  if (!mapped.ok) return mapped;
  const record = mapSocialPublicationMetricObservationRowToRecord(mapped.value);
  if (!record.ok) return validationFailure("Metric observation row failed record mapping.", record.errors);
  return { ok: true, value: record.value };
}

function mapStoredEvidenceRow(
  row: SocialPublicationMetricEvidenceRow,
  context: string,
): SocialPublicationMetricStoreResult<SocialPublicationMetricEvidenceRecord> {
  const mapped = mapStoredEvidenceRowToRow(row, context);
  if (!mapped.ok) return mapped;
  const record = mapSocialPublicationMetricEvidenceRowToRecord(mapped.value);
  if (!record.ok) return validationFailure("Metric evidence row failed record mapping.", record.errors);
  return { ok: true, value: record.value };
}

function mapStoredObservationRowToRow(
  row: SocialPublicationMetricObservationRow,
  context: string,
): SocialPublicationMetricStoreResult<SocialPublicationMetricObservationRow> {
  const validation = validateSocialPublicationMetricObservationRow(row);
  if (!validation.ok) {
    return validationFailure(`Stored metric observation row failed validation during ${context}.`, validation.errors);
  }
  return { ok: true, value: immutableClone(row) };
}

function mapStoredEvidenceRowToRow(
  row: SocialPublicationMetricEvidenceRow,
  context: string,
): SocialPublicationMetricStoreResult<SocialPublicationMetricEvidenceRow> {
  const validation = validateSocialPublicationMetricEvidenceRow(row);
  if (!validation.ok) {
    return validationFailure(`Stored metric evidence row failed validation during ${context}.`, validation.errors);
  }
  return { ok: true, value: immutableClone(row) };
}

function validationFailure(
  message: string,
  validationErrors: readonly (
    | SocialPublicationMetricRecordError
    | SocialPublicationMetricRowError
  )[],
): SocialPublicationMetricStoreResult<never> {
  return { ok: false, error: { code: "validation_failed", message, validationErrors } };
}

function duplicateIdentity(message: string): SocialPublicationMetricStoreResult<never> {
  return { ok: false, error: { code: "duplicate_identity", message } };
}

function duplicateIdempotency(): SocialPublicationMetricStoreResult<never> {
  return {
    ok: false,
    error: {
      code: "duplicate_idempotency_key",
      message: "Metric idempotency key already exists.",
    },
  };
}

function storageFailure(
  error: unknown,
  fallback: string,
): SocialPublicationMetricStoreResult<never> {
  return {
    ok: false,
    error: {
      code: "storage_error",
      message: error instanceof Error ? error.message : fallback,
    },
  };
}

function storeError(
  code: SocialPublicationMetricStoreErrorCode,
  message: string,
): SocialPublicationMetricStoreError {
  return { code, message };
}

function immutableClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
