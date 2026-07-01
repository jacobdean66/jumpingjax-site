import { createServiceRoleClient, isSupabaseServiceConfigured } from "../supabase/admin";

import {
  mapSocialPublicationExecutionEvidenceRecordToRow,
  mapSocialPublicationExecutionEvidenceRowToRecord,
  mapSocialPublicationExecutionIntentRecordToRow,
  mapSocialPublicationExecutionIntentRowToRecord,
  mapSocialPublicationExecutionResultRecordToRow,
  mapSocialPublicationExecutionResultRowToRecord,
  mapSocialPublicationExecutionRowsToPersistenceModel,
  validateSocialPublicationExecutionEvidenceRow,
  validateSocialPublicationExecutionIntentRow,
  validateSocialPublicationExecutionResultRow,
  type SocialPublicationExecutionEvidenceRecord,
  type SocialPublicationExecutionEvidenceRow,
  type SocialPublicationExecutionIntentRow,
  type SocialPublicationExecutionResultRow,
  type SocialPublicationExecutionRowError,
  type SocialPublicationExecutionRowsModel,
  type SocialPublicationExecutionRowsPersistenceModel,
} from "./social-publication-execution-rows";
import type {
  SocialPublicationExecutionMappedIntent,
  SocialPublicationExecutionMappedResult,
} from "./social-publication-execution-mapper";
import {
  validateSocialPublicationExecutionIntentRecord,
  validateSocialPublicationExecutionResultRecord,
  type SocialPublicationExecutionIntentRecord,
  type SocialPublicationExecutionRecordError,
  type SocialPublicationExecutionResultRecord,
} from "./social-publication-execution-repository";

export const SOCIAL_PUBLICATION_EXECUTION_STORE_ERROR_CODES = [
  "validation_failed",
  "duplicate_identity",
  "duplicate_idempotency_key",
  "parent_missing",
  "scope_mismatch",
  "storage_error",
  "storage_inconsistent",
] as const;

export type SocialPublicationExecutionStoreErrorCode =
  (typeof SOCIAL_PUBLICATION_EXECUTION_STORE_ERROR_CODES)[number];

export type SocialPublicationExecutionStoreError = Readonly<{
  code: SocialPublicationExecutionStoreErrorCode;
  message: string;
  validationErrors?: readonly (
    | SocialPublicationExecutionRecordError
    | SocialPublicationExecutionRowError
  )[];
}>;

export type SocialPublicationExecutionStoreResult<T> = Readonly<
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: SocialPublicationExecutionStoreError;
    }
>;

export type SocialPublicationExecutionStoreWriteOptions = Readonly<{
  idempotencyKey?: string | null;
}>;

export type SocialPublicationExecutionReadFilter = Readonly<{
  executionJobId?: string;
  socialPostId?: string;
  publicationTargetId?: string;
  publicationManifestId?: string;
  publisherRequestId?: string;
  scheduleId?: string;
}>;

export type SocialPublicationExecutionMappedIntentInsertResult = Readonly<{
  intent: SocialPublicationExecutionIntentRecord;
  evidence: SocialPublicationExecutionEvidenceRecord | null;
}>;

export type SocialPublicationExecutionMappedResultInsertResult = Readonly<{
  result: SocialPublicationExecutionResultRecord;
  evidence: SocialPublicationExecutionEvidenceRecord | null;
}>;

export type SocialPublicationExecutionStoreStorage = Readonly<{
  insertIntent(
    row: SocialPublicationExecutionIntentRow,
  ): Promise<SocialPublicationExecutionIntentRow>;
  insertResult(
    row: SocialPublicationExecutionResultRow,
  ): Promise<SocialPublicationExecutionResultRow>;
  insertEvidence(
    row: SocialPublicationExecutionEvidenceRow,
  ): Promise<SocialPublicationExecutionEvidenceRow>;
  findIntentByIntentId(
    executionIntentId: string,
  ): Promise<SocialPublicationExecutionIntentRow | null>;
  findIntentByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialPublicationExecutionIntentRow | null>;
  findResultByResultId(
    executionResultId: string,
  ): Promise<SocialPublicationExecutionResultRow | null>;
  findResultByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialPublicationExecutionResultRow | null>;
  findEvidenceByEvidenceId(
    evidenceId: string,
  ): Promise<SocialPublicationExecutionEvidenceRow | null>;
  findEvidenceByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialPublicationExecutionEvidenceRow | null>;
  fetchIntents(
    filter: SocialPublicationExecutionReadFilter,
  ): Promise<SocialPublicationExecutionIntentRow[]>;
  fetchResults(
    filter: SocialPublicationExecutionReadFilter,
  ): Promise<SocialPublicationExecutionResultRow[]>;
  fetchEvidence(
    filter: SocialPublicationExecutionReadFilter,
  ): Promise<SocialPublicationExecutionEvidenceRow[]>;
}>;

const INTENT_SELECT =
  "execution_intent_id, execution_job_id, intent_type, social_post_id, publication_target_id, publisher_request_id, publisher_result_id, publisher_job_id, schedule_id, ledger_entry_id, publication_manifest_id, owner_approval_id, approval_id, metric_observation_id, learning_insight_id, campaign_memory_id, decision_history_id, owner_approval_satisfied, publisher_authority_satisfied, preflight_id, preflight_status, preflight_block_reasons, preflight_evaluated_at, evidence_id, requested_at, updated_at, recorded_by_actor, recorded_source, contract_only, model_authority_only, references_only, executes_nothing, publishes_nothing, calls_no_external_apis, uses_no_sdks, uses_no_network, starts_no_workers, starts_no_timers, creates_no_queues, exposes_no_api_routes, exposes_no_admin_ui, mutates_no_sql, mutates_no_storage, mutates_no_lower_layers, records_no_metrics, performs_no_learning, grants_execution_permission, append_only, immutable, idempotency_key";

const RESULT_SELECT =
  "execution_result_id, execution_intent_id, execution_job_id, result_type, result_status, social_post_id, publication_target_id, publisher_request_id, publisher_result_id, publisher_job_id, schedule_id, ledger_entry_id, publication_manifest_id, owner_approval_id, approval_id, metric_observation_id, learning_insight_id, campaign_memory_id, decision_history_id, block_reasons, evidence_id, recorded_at, updated_at, recorded_by_actor, recorded_source, contract_only, model_authority_only, references_only, executes_nothing, publishes_nothing, calls_no_external_apis, uses_no_sdks, uses_no_network, persists_nothing, mutates_no_lower_layers, current_execution_status_authority, records_no_metrics, performs_no_learning, grants_execution_permission, append_only, immutable, idempotency_key";

const EVIDENCE_SELECT =
  "evidence_id, execution_intent_id, execution_result_id, evidence_kind, notes, evidence, social_post_id, publication_target_id, publisher_request_id, publisher_result_id, publisher_job_id, schedule_id, ledger_entry_id, publication_manifest_id, owner_approval_id, approval_id, metric_observation_id, learning_insight_id, campaign_memory_id, decision_history_id, recorded_at, recorded_by_actor, recorded_source, contains_full_payload, contains_secrets, proves_execution, append_only, immutable, idempotency_key";

let testStorage: SocialPublicationExecutionStoreStorage | null = null;

export function configureSocialPublicationExecutionStoreTestDependencies(
  storage: SocialPublicationExecutionStoreStorage | null,
): void {
  testStorage = storage;
}

export function isSocialPublicationExecutionStoreConfigured(): boolean {
  return isSupabaseServiceConfigured();
}

export async function createSocialPublicationExecutionIntent(
  record: SocialPublicationExecutionIntentRecord,
  options: SocialPublicationExecutionStoreWriteOptions = {},
): Promise<SocialPublicationExecutionStoreResult<SocialPublicationExecutionIntentRecord>> {
  const recordValidation = validateSocialPublicationExecutionIntentRecord(record);
  if (!recordValidation.ok) {
    return validationFailure(
      "Execution intent record failed validation.",
      recordValidation.errors,
    );
  }

  const rowResult = mapSocialPublicationExecutionIntentRecordToRow(record, {
    idempotency_key: options.idempotencyKey ?? null,
  });
  if (!rowResult.ok) {
    return validationFailure("Execution intent row failed validation.", rowResult.errors);
  }

  try {
    const duplicate = await findIntentDuplicate(rowResult.value);
    if (duplicate) return duplicate;

    return mapStoredIntentRow(
      await storage().insertIntent(rowResult.value),
      "create intent",
    );
  } catch (error) {
    return storageFailure(error, "Execution intent write failed.");
  }
}

export async function appendSocialPublicationExecutionResult(
  record: SocialPublicationExecutionResultRecord,
  options: SocialPublicationExecutionStoreWriteOptions = {},
): Promise<SocialPublicationExecutionStoreResult<SocialPublicationExecutionResultRecord>> {
  const recordValidation = validateSocialPublicationExecutionResultRecord(record);
  if (!recordValidation.ok) {
    return validationFailure(
      "Execution result record failed validation.",
      recordValidation.errors,
    );
  }

  const rowResult = mapSocialPublicationExecutionResultRecordToRow(record, {
    idempotency_key: options.idempotencyKey ?? null,
  });
  if (!rowResult.ok) {
    return validationFailure("Execution result row failed validation.", rowResult.errors);
  }

  try {
    const parentError = await validateResultParent(rowResult.value);
    if (parentError) return { ok: false, error: parentError };

    const duplicate = await findResultDuplicate(rowResult.value);
    if (duplicate) return duplicate;

    return mapStoredResultRow(
      await storage().insertResult(rowResult.value),
      "append result",
    );
  } catch (error) {
    return storageFailure(error, "Execution result write failed.");
  }
}

export async function insertSocialPublicationExecutionEvidence(
  record: SocialPublicationExecutionEvidenceRecord,
  options: SocialPublicationExecutionStoreWriteOptions = {},
): Promise<SocialPublicationExecutionStoreResult<SocialPublicationExecutionEvidenceRecord>> {
  const rowResult = mapSocialPublicationExecutionEvidenceRecordToRow(record, {
    idempotency_key: options.idempotencyKey ?? null,
  });
  if (!rowResult.ok) {
    return validationFailure("Execution evidence row failed validation.", rowResult.errors);
  }

  try {
    const parentError = await validateEvidenceParents(rowResult.value);
    if (parentError) return { ok: false, error: parentError };

    const duplicate = await findEvidenceDuplicate(rowResult.value);
    if (duplicate) return duplicate;

    return mapStoredEvidenceRow(
      await storage().insertEvidence(rowResult.value),
      "insert evidence",
    );
  } catch (error) {
    return storageFailure(error, "Execution evidence write failed.");
  }
}

export async function insertSocialPublicationExecutionMappedIntent(
  mapped: SocialPublicationExecutionMappedIntent,
  options: SocialPublicationExecutionStoreWriteOptions = {},
): Promise<SocialPublicationExecutionStoreResult<SocialPublicationExecutionMappedIntentInsertResult>> {
  const intentResult = await createSocialPublicationExecutionIntent(mapped.intent, options);
  if (!intentResult.ok) return intentResult;

  if (!mapped.evidence) {
    return { ok: true, value: immutableClone({ intent: intentResult.value, evidence: null }) };
  }

  const evidenceResult = await insertSocialPublicationExecutionEvidence(
    mapped.evidence,
    options,
  );
  if (!evidenceResult.ok) return evidenceResult;

  return {
    ok: true,
    value: immutableClone({ intent: intentResult.value, evidence: evidenceResult.value }),
  };
}

export async function insertSocialPublicationExecutionMappedResult(
  mapped: SocialPublicationExecutionMappedResult,
  options: SocialPublicationExecutionStoreWriteOptions = {},
): Promise<SocialPublicationExecutionStoreResult<SocialPublicationExecutionMappedResultInsertResult>> {
  const resultResult = await appendSocialPublicationExecutionResult(mapped.result, options);
  if (!resultResult.ok) return resultResult;

  if (!mapped.evidence) {
    return { ok: true, value: immutableClone({ result: resultResult.value, evidence: null }) };
  }

  const evidenceResult = await insertSocialPublicationExecutionEvidence(
    mapped.evidence,
    options,
  );
  if (!evidenceResult.ok) return evidenceResult;

  return {
    ok: true,
    value: immutableClone({ result: resultResult.value, evidence: evidenceResult.value }),
  };
}

export async function fetchSocialPublicationExecutionIntentRows(
  filter: SocialPublicationExecutionReadFilter = {},
): Promise<SocialPublicationExecutionStoreResult<readonly SocialPublicationExecutionIntentRow[]>> {
  try {
    return mapStoredIntentRows(await storage().fetchIntents(filter), "fetch intents");
  } catch (error) {
    return storageFailure(error, "Execution intent read failed.");
  }
}

export async function fetchSocialPublicationExecutionResultRows(
  filter: SocialPublicationExecutionReadFilter = {},
): Promise<SocialPublicationExecutionStoreResult<readonly SocialPublicationExecutionResultRow[]>> {
  try {
    return mapStoredResultRows(await storage().fetchResults(filter), "fetch results");
  } catch (error) {
    return storageFailure(error, "Execution result read failed.");
  }
}

export async function fetchSocialPublicationExecutionEvidenceRows(
  filter: SocialPublicationExecutionReadFilter = {},
): Promise<SocialPublicationExecutionStoreResult<readonly SocialPublicationExecutionEvidenceRow[]>> {
  try {
    return mapStoredEvidenceRows(await storage().fetchEvidence(filter), "fetch evidence");
  } catch (error) {
    return storageFailure(error, "Execution evidence read failed.");
  }
}

export async function fetchSocialPublicationExecutionRows(
  filter: SocialPublicationExecutionReadFilter = {},
): Promise<SocialPublicationExecutionStoreResult<SocialPublicationExecutionRowsModel>> {
  try {
    const rows = {
      intents: await storage().fetchIntents(filter),
      results: await storage().fetchResults(filter),
      evidence: await storage().fetchEvidence(filter),
    };
    return mapStoredRowsModel(rows, "fetch execution rows");
  } catch (error) {
    return storageFailure(error, "Execution read failed.");
  }
}

export async function fetchSocialPublicationExecutionRecords(
  filter: SocialPublicationExecutionReadFilter = {},
): Promise<SocialPublicationExecutionStoreResult<SocialPublicationExecutionRowsPersistenceModel>> {
  const rows = await fetchSocialPublicationExecutionRows(filter);
  if (!rows.ok) return rows;

  const mapped = mapSocialPublicationExecutionRowsToPersistenceModel(rows.value);
  if (!mapped.ok) {
    return validationFailure(
      "Execution rows failed persistence mapping during read.",
      mapped.errors,
    );
  }

  return { ok: true, value: mapped.value };
}

export function fetchSocialPublicationExecutionRowsByPost(
  socialPostId: string,
): Promise<SocialPublicationExecutionStoreResult<SocialPublicationExecutionRowsModel>> {
  return fetchSocialPublicationExecutionRows({ socialPostId });
}

export function fetchSocialPublicationExecutionRowsByPublicationTarget(
  publicationTargetId: string,
): Promise<SocialPublicationExecutionStoreResult<SocialPublicationExecutionRowsModel>> {
  return fetchSocialPublicationExecutionRows({ publicationTargetId });
}

export function fetchSocialPublicationExecutionRowsByManifest(
  publicationManifestId: string,
): Promise<SocialPublicationExecutionStoreResult<SocialPublicationExecutionRowsModel>> {
  return fetchSocialPublicationExecutionRows({ publicationManifestId });
}

export function fetchSocialPublicationExecutionRowsByJob(
  executionJobId: string,
): Promise<SocialPublicationExecutionStoreResult<SocialPublicationExecutionRowsModel>> {
  return fetchSocialPublicationExecutionRows({ executionJobId });
}

export function fetchSocialPublicationExecutionRecordsByPost(
  socialPostId: string,
): Promise<SocialPublicationExecutionStoreResult<SocialPublicationExecutionRowsPersistenceModel>> {
  return fetchSocialPublicationExecutionRecords({ socialPostId });
}

export function fetchSocialPublicationExecutionRecordsByPublicationTarget(
  publicationTargetId: string,
): Promise<SocialPublicationExecutionStoreResult<SocialPublicationExecutionRowsPersistenceModel>> {
  return fetchSocialPublicationExecutionRecords({ publicationTargetId });
}

export function fetchSocialPublicationExecutionRecordsByManifest(
  publicationManifestId: string,
): Promise<SocialPublicationExecutionStoreResult<SocialPublicationExecutionRowsPersistenceModel>> {
  return fetchSocialPublicationExecutionRecords({ publicationManifestId });
}

export function fetchSocialPublicationExecutionRecordsByJob(
  executionJobId: string,
): Promise<SocialPublicationExecutionStoreResult<SocialPublicationExecutionRowsPersistenceModel>> {
  return fetchSocialPublicationExecutionRecords({ executionJobId });
}

export async function fetchSocialPublicationExecutionIntentRecordByIntentId(
  executionIntentId: string,
): Promise<SocialPublicationExecutionStoreResult<SocialPublicationExecutionIntentRecord | null>> {
  try {
    const row = await storage().findIntentByIntentId(executionIntentId);
    if (!row) return { ok: true, value: null };

    return mapStoredIntentRow(row, "fetch intent by id");
  } catch (error) {
    return storageFailure(error, "Execution intent lookup failed.");
  }
}

function storage(): SocialPublicationExecutionStoreStorage {
  if (testStorage) return testStorage;
  return createSupabaseExecutionStoreStorage();
}

function createSupabaseExecutionStoreStorage(): SocialPublicationExecutionStoreStorage {
  const supabase = createServiceRoleClient();

  return {
    async insertIntent(row) {
      const { data, error } = await supabase
        .from("social_publication_execution_intents")
        .insert(row)
        .select(INTENT_SELECT)
        .single<SocialPublicationExecutionIntentRow>();

      if (error) throw new Error(error.message);
      return data;
    },
    async insertResult(row) {
      const { data, error } = await supabase
        .from("social_publication_execution_results")
        .insert(row)
        .select(RESULT_SELECT)
        .single<SocialPublicationExecutionResultRow>();

      if (error) throw new Error(error.message);
      return data;
    },
    async insertEvidence(row) {
      const { data, error } = await supabase
        .from("social_publication_execution_evidence")
        .insert(row)
        .select(EVIDENCE_SELECT)
        .single<SocialPublicationExecutionEvidenceRow>();

      if (error) throw new Error(error.message);
      return data;
    },
    findIntentByIntentId(executionIntentId) {
      return maybeSingleIntent("execution_intent_id", executionIntentId);
    },
    findIntentByIdempotencyKey(idempotencyKey) {
      return maybeSingleIntent("idempotency_key", idempotencyKey);
    },
    findResultByResultId(executionResultId) {
      return maybeSingleResult("execution_result_id", executionResultId);
    },
    findResultByIdempotencyKey(idempotencyKey) {
      return maybeSingleResult("idempotency_key", idempotencyKey);
    },
    findEvidenceByEvidenceId(evidenceId) {
      return maybeSingleEvidence("evidence_id", evidenceId);
    },
    findEvidenceByIdempotencyKey(idempotencyKey) {
      return maybeSingleEvidence("idempotency_key", idempotencyKey);
    },
    fetchIntents(filter) {
      return applyIntentReadFilter(filter);
    },
    fetchResults(filter) {
      return applyResultReadFilter(filter);
    },
    fetchEvidence(filter) {
      return applyEvidenceReadFilter(filter);
    },
  };

  async function maybeSingleIntent(
    column: string,
    value: string,
  ): Promise<SocialPublicationExecutionIntentRow | null> {
    const { data, error } = await supabase
      .from("social_publication_execution_intents")
      .select(INTENT_SELECT)
      .eq(column, value)
      .maybeSingle<SocialPublicationExecutionIntentRow>();

    if (error) throw new Error(error.message);
    return data;
  }

  async function maybeSingleResult(
    column: string,
    value: string,
  ): Promise<SocialPublicationExecutionResultRow | null> {
    const { data, error } = await supabase
      .from("social_publication_execution_results")
      .select(RESULT_SELECT)
      .eq(column, value)
      .maybeSingle<SocialPublicationExecutionResultRow>();

    if (error) throw new Error(error.message);
    return data;
  }

  async function maybeSingleEvidence(
    column: string,
    value: string,
  ): Promise<SocialPublicationExecutionEvidenceRow | null> {
    const { data, error } = await supabase
      .from("social_publication_execution_evidence")
      .select(EVIDENCE_SELECT)
      .eq(column, value)
      .maybeSingle<SocialPublicationExecutionEvidenceRow>();

    if (error) throw new Error(error.message);
    return data;
  }

  async function applyIntentReadFilter(
    filter: SocialPublicationExecutionReadFilter,
  ): Promise<SocialPublicationExecutionIntentRow[]> {
    let query = supabase.from("social_publication_execution_intents").select(INTENT_SELECT);
    query = applyReadFilter(query, filter);
    if (filter.executionJobId) query = query.eq("execution_job_id", filter.executionJobId);

    const { data, error } = await query
      .order("requested_at", { ascending: true })
      .order("execution_intent_id", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as SocialPublicationExecutionIntentRow[];
  }

  async function applyResultReadFilter(
    filter: SocialPublicationExecutionReadFilter,
  ): Promise<SocialPublicationExecutionResultRow[]> {
    let query = supabase.from("social_publication_execution_results").select(RESULT_SELECT);
    query = applyReadFilter(query, filter);
    if (filter.executionJobId) query = query.eq("execution_job_id", filter.executionJobId);

    const { data, error } = await query
      .order("recorded_at", { ascending: true })
      .order("execution_result_id", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as SocialPublicationExecutionResultRow[];
  }

  async function applyEvidenceReadFilter(
    filter: SocialPublicationExecutionReadFilter,
  ): Promise<SocialPublicationExecutionEvidenceRow[]> {
    let query = supabase.from("social_publication_execution_evidence").select(EVIDENCE_SELECT);
    query = applyReadFilter(query, filter);

    const { data, error } = await query
      .order("recorded_at", { ascending: true })
      .order("evidence_id", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as SocialPublicationExecutionEvidenceRow[];
  }
}

function applyReadFilter<TQuery extends { eq: (column: string, value: string) => TQuery }>(
  query: TQuery,
  filter: SocialPublicationExecutionReadFilter,
): TQuery {
  let nextQuery = query;
  if (filter.socialPostId) nextQuery = nextQuery.eq("social_post_id", filter.socialPostId);
  if (filter.publicationTargetId) {
    nextQuery = nextQuery.eq("publication_target_id", filter.publicationTargetId);
  }
  if (filter.publicationManifestId) {
    nextQuery = nextQuery.eq("publication_manifest_id", filter.publicationManifestId);
  }
  if (filter.publisherRequestId) {
    nextQuery = nextQuery.eq("publisher_request_id", filter.publisherRequestId);
  }
  if (filter.scheduleId) {
    nextQuery = nextQuery.eq("schedule_id", filter.scheduleId);
  }
  return nextQuery;
}

async function findIntentDuplicate(
  row: SocialPublicationExecutionIntentRow,
): Promise<SocialPublicationExecutionStoreResult<never> | null> {
  if (await storage().findIntentByIntentId(row.execution_intent_id)) {
    return duplicateIdentity("Execution intent identity already exists.");
  }
  if (
    row.idempotency_key &&
    (await storage().findIntentByIdempotencyKey(row.idempotency_key))
  ) {
    return duplicateIdempotency();
  }
  return null;
}

async function findResultDuplicate(
  row: SocialPublicationExecutionResultRow,
): Promise<SocialPublicationExecutionStoreResult<never> | null> {
  if (await storage().findResultByResultId(row.execution_result_id)) {
    return duplicateIdentity("Execution result identity already exists.");
  }
  if (
    row.idempotency_key &&
    (await storage().findResultByIdempotencyKey(row.idempotency_key))
  ) {
    return duplicateIdempotency();
  }
  return null;
}

async function findEvidenceDuplicate(
  row: SocialPublicationExecutionEvidenceRow,
): Promise<SocialPublicationExecutionStoreResult<never> | null> {
  if (await storage().findEvidenceByEvidenceId(row.evidence_id)) {
    return duplicateIdentity("Execution evidence identity already exists.");
  }
  if (
    row.idempotency_key &&
    (await storage().findEvidenceByIdempotencyKey(row.idempotency_key))
  ) {
    return duplicateIdempotency();
  }
  return null;
}

async function validateResultParent(
  row: SocialPublicationExecutionResultRow,
): Promise<SocialPublicationExecutionStoreError | null> {
  const intent = await storage().findIntentByIntentId(row.execution_intent_id);
  if (!intent) {
    return storeError("parent_missing", "Execution result parent intent is missing.");
  }

  return intentResultShareScope(intent, row)
    ? null
    : storeError("scope_mismatch", "Execution result scope must match parent intent scope.");
}

async function validateEvidenceParents(
  row: SocialPublicationExecutionEvidenceRow,
): Promise<SocialPublicationExecutionStoreError | null> {
  const intent = await storage().findIntentByIntentId(row.execution_intent_id);
  if (!intent) {
    return storeError("parent_missing", "Execution evidence parent intent is missing.");
  }

  if (!rowMatchesScope(row, intent)) {
    return storeError(
      "scope_mismatch",
      "Execution evidence scope must match parent intent scope.",
    );
  }

  if (!row.execution_result_id) return null;

  const result = await storage().findResultByResultId(row.execution_result_id);
  if (!result) {
    return storeError("parent_missing", "Execution evidence parent result is missing.");
  }

  if (result.execution_intent_id !== row.execution_intent_id) {
    return storeError(
      "scope_mismatch",
      "Execution evidence result must belong to the same parent intent.",
    );
  }

  return rowMatchesScope(row, result)
    ? null
    : storeError(
        "scope_mismatch",
        "Execution evidence scope must match parent result scope.",
      );
}

function intentResultShareScope(
  intent: SocialPublicationExecutionIntentRow,
  result: SocialPublicationExecutionResultRow,
): boolean {
  return intent.execution_job_id === result.execution_job_id && rowMatchesScope(result, intent);
}

type ScopeColumns = Readonly<{
  social_post_id: string;
  publication_target_id: string;
  publisher_request_id: string | null;
  publisher_result_id: string | null;
  publisher_job_id: string | null;
  schedule_id: string | null;
  ledger_entry_id: string | null;
  publication_manifest_id: string | null;
  owner_approval_id: string | null;
  approval_id: string | null;
  metric_observation_id: string | null;
  learning_insight_id: string | null;
  campaign_memory_id: string | null;
  decision_history_id: string | null;
}>;

function rowMatchesScope(row: ScopeColumns, parent: ScopeColumns): boolean {
  return (
    row.social_post_id === parent.social_post_id &&
    row.publication_target_id === parent.publication_target_id &&
    row.publisher_request_id === parent.publisher_request_id &&
    row.publisher_result_id === parent.publisher_result_id &&
    row.publisher_job_id === parent.publisher_job_id &&
    row.schedule_id === parent.schedule_id &&
    row.ledger_entry_id === parent.ledger_entry_id &&
    row.publication_manifest_id === parent.publication_manifest_id &&
    row.owner_approval_id === parent.owner_approval_id &&
    row.approval_id === parent.approval_id &&
    row.metric_observation_id === parent.metric_observation_id &&
    row.learning_insight_id === parent.learning_insight_id &&
    row.campaign_memory_id === parent.campaign_memory_id &&
    row.decision_history_id === parent.decision_history_id
  );
}

function mapStoredIntentRows(
  rows: readonly SocialPublicationExecutionIntentRow[],
  operation: string,
): SocialPublicationExecutionStoreResult<readonly SocialPublicationExecutionIntentRow[]> {
  const mappedRows: SocialPublicationExecutionIntentRow[] = [];
  for (const row of rows) {
    const mapped = mapStoredIntentRowToRow(row, operation);
    if (!mapped.ok) return mapped;
    mappedRows.push(mapped.value);
  }

  return { ok: true, value: immutableClone(sortIntentRows(mappedRows)) };
}

function mapStoredResultRows(
  rows: readonly SocialPublicationExecutionResultRow[],
  operation: string,
): SocialPublicationExecutionStoreResult<readonly SocialPublicationExecutionResultRow[]> {
  const mappedRows: SocialPublicationExecutionResultRow[] = [];
  for (const row of rows) {
    const mapped = mapStoredResultRowToRow(row, operation);
    if (!mapped.ok) return mapped;
    mappedRows.push(mapped.value);
  }

  return { ok: true, value: immutableClone(sortResultRows(mappedRows)) };
}

function mapStoredEvidenceRows(
  rows: readonly SocialPublicationExecutionEvidenceRow[],
  operation: string,
): SocialPublicationExecutionStoreResult<readonly SocialPublicationExecutionEvidenceRow[]> {
  const mappedRows: SocialPublicationExecutionEvidenceRow[] = [];
  for (const row of rows) {
    const mapped = mapStoredEvidenceRowToRow(row, operation);
    if (!mapped.ok) return mapped;
    mappedRows.push(mapped.value);
  }

  return { ok: true, value: immutableClone(sortEvidenceRows(mappedRows)) };
}

function mapStoredRowsModel(
  rows: SocialPublicationExecutionRowsModel,
  operation: string,
): SocialPublicationExecutionStoreResult<SocialPublicationExecutionRowsModel> {
  const intents = mapStoredIntentRows(rows.intents, operation);
  if (!intents.ok) return intents;

  const results = mapStoredResultRows(rows.results, operation);
  if (!results.ok) return results;

  const evidence = mapStoredEvidenceRows(rows.evidence, operation);
  if (!evidence.ok) return evidence;

  return {
    ok: true,
    value: immutableClone({
      intents: intents.value,
      results: results.value,
      evidence: evidence.value,
    }),
  };
}

function mapStoredIntentRow(
  row: SocialPublicationExecutionIntentRow,
  operation: string,
): SocialPublicationExecutionStoreResult<SocialPublicationExecutionIntentRecord> {
  const rowResult = mapStoredIntentRowToRow(row, operation);
  if (!rowResult.ok) return rowResult;

  const record = mapSocialPublicationExecutionIntentRowToRecord(rowResult.value);
  if (!record.ok) {
    return validationFailure(
      `Execution intent row failed mapping during ${operation}.`,
      record.errors,
    );
  }

  return { ok: true, value: record.value };
}

function mapStoredResultRow(
  row: SocialPublicationExecutionResultRow,
  operation: string,
): SocialPublicationExecutionStoreResult<SocialPublicationExecutionResultRecord> {
  const rowResult = mapStoredResultRowToRow(row, operation);
  if (!rowResult.ok) return rowResult;

  const record = mapSocialPublicationExecutionResultRowToRecord(rowResult.value);
  if (!record.ok) {
    return validationFailure(
      `Execution result row failed mapping during ${operation}.`,
      record.errors,
    );
  }

  return { ok: true, value: record.value };
}

function mapStoredEvidenceRow(
  row: SocialPublicationExecutionEvidenceRow,
  operation: string,
): SocialPublicationExecutionStoreResult<SocialPublicationExecutionEvidenceRecord> {
  const rowResult = mapStoredEvidenceRowToRow(row, operation);
  if (!rowResult.ok) return rowResult;

  const record = mapSocialPublicationExecutionEvidenceRowToRecord(rowResult.value);
  if (!record.ok) {
    return validationFailure(
      `Execution evidence row failed mapping during ${operation}.`,
      record.errors,
    );
  }

  return { ok: true, value: record.value };
}

function mapStoredIntentRowToRow(
  row: SocialPublicationExecutionIntentRow,
  operation: string,
): SocialPublicationExecutionStoreResult<SocialPublicationExecutionIntentRow> {
  const validation = validateSocialPublicationExecutionIntentRow(row);
  if (!validation.ok) {
    return validationFailure(
      `Execution intent row failed validation during ${operation}.`,
      validation.errors,
    );
  }

  return { ok: true, value: immutableClone(row) };
}

function mapStoredResultRowToRow(
  row: SocialPublicationExecutionResultRow,
  operation: string,
): SocialPublicationExecutionStoreResult<SocialPublicationExecutionResultRow> {
  const validation = validateSocialPublicationExecutionResultRow(row);
  if (!validation.ok) {
    return validationFailure(
      `Execution result row failed validation during ${operation}.`,
      validation.errors,
    );
  }

  return { ok: true, value: immutableClone(row) };
}

function mapStoredEvidenceRowToRow(
  row: SocialPublicationExecutionEvidenceRow,
  operation: string,
): SocialPublicationExecutionStoreResult<SocialPublicationExecutionEvidenceRow> {
  const validation = validateSocialPublicationExecutionEvidenceRow(row);
  if (!validation.ok) {
    return validationFailure(
      `Execution evidence row failed validation during ${operation}.`,
      validation.errors,
    );
  }

  return { ok: true, value: immutableClone(row) };
}

function duplicateIdentity(
  message: string,
): SocialPublicationExecutionStoreResult<never> {
  return { ok: false, error: storeError("duplicate_identity", message) };
}

function duplicateIdempotency(): SocialPublicationExecutionStoreResult<never> {
  return {
    ok: false,
    error: storeError(
      "duplicate_idempotency_key",
      "Execution idempotency key already exists.",
    ),
  };
}

function sortIntentRows(
  rows: readonly SocialPublicationExecutionIntentRow[],
): SocialPublicationExecutionIntentRow[] {
  return [...rows].sort(
    (left, right) =>
      left.requested_at.localeCompare(right.requested_at) ||
      left.execution_intent_id.localeCompare(right.execution_intent_id),
  );
}

function sortResultRows(
  rows: readonly SocialPublicationExecutionResultRow[],
): SocialPublicationExecutionResultRow[] {
  return [...rows].sort(
    (left, right) =>
      left.recorded_at.localeCompare(right.recorded_at) ||
      left.execution_result_id.localeCompare(right.execution_result_id),
  );
}

function sortEvidenceRows(
  rows: readonly SocialPublicationExecutionEvidenceRow[],
): SocialPublicationExecutionEvidenceRow[] {
  return [...rows].sort(
    (left, right) =>
      left.recorded_at.localeCompare(right.recorded_at) ||
      left.evidence_id.localeCompare(right.evidence_id),
  );
}

function validationFailure<T>(
  message: string,
  validationErrors: readonly (
    | SocialPublicationExecutionRecordError
    | SocialPublicationExecutionRowError
  )[],
): SocialPublicationExecutionStoreResult<T> {
  return {
    ok: false,
    error: storeError("validation_failed", message, validationErrors),
  };
}

function storageFailure<T>(
  error: unknown,
  fallbackMessage: string,
): SocialPublicationExecutionStoreResult<T> {
  return {
    ok: false,
    error: storeError(
      "storage_error",
      error instanceof Error ? error.message : fallbackMessage,
    ),
  };
}

function storeError(
  code: SocialPublicationExecutionStoreErrorCode,
  message: string,
  validationErrors?: readonly (
    | SocialPublicationExecutionRecordError
    | SocialPublicationExecutionRowError
  )[],
): SocialPublicationExecutionStoreError {
  return { code, message, validationErrors };
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
