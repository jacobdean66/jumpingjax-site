import { createServiceRoleClient, isSupabaseServiceConfigured } from "../supabase/admin";

import {
  mapSocialPublicationPublisherEvidenceRecordToRow,
  mapSocialPublicationPublisherEvidenceRowToRecord,
  mapSocialPublicationPublisherRequestRecordToRow,
  mapSocialPublicationPublisherRequestRowToRecord,
  mapSocialPublicationPublisherResultRecordToRow,
  mapSocialPublicationPublisherResultRowToRecord,
  mapSocialPublicationPublisherRowsToPersistenceModel,
  validateSocialPublicationPublisherEvidenceRow,
  validateSocialPublicationPublisherRequestRow,
  validateSocialPublicationPublisherResultRow,
  type SocialPublicationPublisherEvidenceRecord,
  type SocialPublicationPublisherEvidenceRow,
  type SocialPublicationPublisherRequestRow,
  type SocialPublicationPublisherResultRow,
  type SocialPublicationPublisherRowError,
  type SocialPublicationPublisherRowsModel,
  type SocialPublicationPublisherRowsPersistenceModel,
} from "./social-publication-publisher-rows";
import type {
  SocialPublicationPublisherMappedRequest,
  SocialPublicationPublisherMappedResult,
} from "./social-publication-publisher-mapper";
import {
  validateSocialPublicationPublisherRequestRecord,
  validateSocialPublicationPublisherResultRecord,
  type SocialPublicationPublisherRecordError,
  type SocialPublicationPublisherRequestRecord,
  type SocialPublicationPublisherResultRecord,
} from "./social-publication-publisher-repository";

export const SOCIAL_PUBLICATION_PUBLISHER_STORE_ERROR_CODES = [
  "validation_failed",
  "duplicate_identity",
  "duplicate_idempotency_key",
  "parent_missing",
  "scope_mismatch",
  "storage_error",
  "storage_inconsistent",
] as const;

export type SocialPublicationPublisherStoreErrorCode =
  (typeof SOCIAL_PUBLICATION_PUBLISHER_STORE_ERROR_CODES)[number];

export type SocialPublicationPublisherStoreError = Readonly<{
  code: SocialPublicationPublisherStoreErrorCode;
  message: string;
  validationErrors?: readonly (
    | SocialPublicationPublisherRecordError
    | SocialPublicationPublisherRowError
  )[];
}>;

export type SocialPublicationPublisherStoreResult<T> = Readonly<
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: SocialPublicationPublisherStoreError;
    }
>;

export type SocialPublicationPublisherStoreWriteOptions = Readonly<{
  idempotencyKey?: string | null;
}>;

export type SocialPublicationPublisherReadFilter = Readonly<{
  publisherJobId?: string;
  socialPostId?: string;
  publicationTargetId?: string;
  publicationManifestId?: string;
}>;

export type SocialPublicationPublisherMappedRequestInsertResult = Readonly<{
  request: SocialPublicationPublisherRequestRecord;
  evidence: SocialPublicationPublisherEvidenceRecord | null;
}>;

export type SocialPublicationPublisherMappedResultInsertResult = Readonly<{
  result: SocialPublicationPublisherResultRecord;
  evidence: SocialPublicationPublisherEvidenceRecord | null;
}>;

export type SocialPublicationPublisherStoreStorage = Readonly<{
  insertRequest(
    row: SocialPublicationPublisherRequestRow,
  ): Promise<SocialPublicationPublisherRequestRow>;
  insertResult(
    row: SocialPublicationPublisherResultRow,
  ): Promise<SocialPublicationPublisherResultRow>;
  insertEvidence(
    row: SocialPublicationPublisherEvidenceRow,
  ): Promise<SocialPublicationPublisherEvidenceRow>;
  findRequestByRequestId(
    publisherRequestId: string,
  ): Promise<SocialPublicationPublisherRequestRow | null>;
  findRequestByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialPublicationPublisherRequestRow | null>;
  findResultByResultId(
    publisherResultId: string,
  ): Promise<SocialPublicationPublisherResultRow | null>;
  findResultByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialPublicationPublisherResultRow | null>;
  findEvidenceByEvidenceId(
    evidenceId: string,
  ): Promise<SocialPublicationPublisherEvidenceRow | null>;
  findEvidenceByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialPublicationPublisherEvidenceRow | null>;
  fetchRequests(
    filter: SocialPublicationPublisherReadFilter,
  ): Promise<SocialPublicationPublisherRequestRow[]>;
  fetchResults(
    filter: SocialPublicationPublisherReadFilter,
  ): Promise<SocialPublicationPublisherResultRow[]>;
  fetchEvidence(
    filter: SocialPublicationPublisherReadFilter,
  ): Promise<SocialPublicationPublisherEvidenceRow[]>;
}>;

const REQUEST_SELECT =
  "publisher_request_id, publisher_job_id, request_type, channel_id, channel_platform, channel_type, social_post_id, publication_target_id, publication_manifest_id, schedule_id, ledger_entry_id, publication_attempt_id, owner_approval_id, approval_id, proposal_id, owner_approval_satisfied, requested_at, updated_at, recorded_by_actor, recorded_source, contract_only, model_authority_only, references_only, executes_nothing, publishes_nothing, calls_no_external_apis, uses_no_sdks, uses_no_network, starts_no_workers, starts_no_timers, creates_no_queues, exposes_no_api_routes, exposes_no_admin_ui, mutates_no_sql, mutates_no_storage, mutates_no_lower_layers, records_no_metrics, performs_no_learning, append_only, immutable, idempotency_key";

const RESULT_SELECT =
  "publisher_result_id, publisher_request_id, publisher_job_id, result_type, result_status, channel_id, channel_platform, channel_type, social_post_id, publication_target_id, publication_manifest_id, schedule_id, ledger_entry_id, publication_attempt_id, owner_approval_id, approval_id, proposal_id, result_code, error_code, recorded_at, updated_at, recorded_by_actor, recorded_source, contract_only, model_authority_only, references_only, executes_nothing, publishes_nothing, calls_no_external_apis, uses_no_sdks, uses_no_network, persists_nothing, mutates_no_lower_layers, current_publish_status_authority, records_no_metrics, performs_no_learning, append_only, immutable, idempotency_key";

const EVIDENCE_SELECT =
  "evidence_id, publisher_request_id, publisher_result_id, evidence_kind, notes, evidence, social_post_id, publication_target_id, publication_manifest_id, schedule_id, ledger_entry_id, publication_attempt_id, owner_approval_id, approval_id, proposal_id, recorded_at, recorded_by_actor, recorded_source, contains_full_payload, contains_full_response, contains_secrets, proves_execution, append_only, immutable, idempotency_key";

let testStorage: SocialPublicationPublisherStoreStorage | null = null;

export function configureSocialPublicationPublisherStoreTestDependencies(
  storage: SocialPublicationPublisherStoreStorage | null,
): void {
  testStorage = storage;
}

export function isSocialPublicationPublisherStoreConfigured(): boolean {
  return isSupabaseServiceConfigured();
}

export async function createSocialPublicationPublisherRequest(
  record: SocialPublicationPublisherRequestRecord,
  options: SocialPublicationPublisherStoreWriteOptions = {},
): Promise<SocialPublicationPublisherStoreResult<SocialPublicationPublisherRequestRecord>> {
  const recordValidation = validateSocialPublicationPublisherRequestRecord(record);
  if (!recordValidation.ok) {
    return validationFailure(
      "Publisher request record failed validation.",
      recordValidation.errors,
    );
  }

  const rowResult = mapSocialPublicationPublisherRequestRecordToRow(record, {
    idempotency_key: options.idempotencyKey ?? null,
  });
  if (!rowResult.ok) {
    return validationFailure("Publisher request row failed validation.", rowResult.errors);
  }

  try {
    const duplicate = await findRequestDuplicate(rowResult.value);
    if (duplicate) return duplicate;

    return mapStoredRequestRow(
      await storage().insertRequest(rowResult.value),
      "create request",
    );
  } catch (error) {
    return storageFailure(error, "Publisher request write failed.");
  }
}

export async function appendSocialPublicationPublisherResult(
  record: SocialPublicationPublisherResultRecord,
  options: SocialPublicationPublisherStoreWriteOptions = {},
): Promise<SocialPublicationPublisherStoreResult<SocialPublicationPublisherResultRecord>> {
  const recordValidation = validateSocialPublicationPublisherResultRecord(record);
  if (!recordValidation.ok) {
    return validationFailure(
      "Publisher result record failed validation.",
      recordValidation.errors,
    );
  }

  const rowResult = mapSocialPublicationPublisherResultRecordToRow(record, {
    idempotency_key: options.idempotencyKey ?? null,
  });
  if (!rowResult.ok) {
    return validationFailure("Publisher result row failed validation.", rowResult.errors);
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
    return storageFailure(error, "Publisher result write failed.");
  }
}

export async function insertSocialPublicationPublisherEvidence(
  record: SocialPublicationPublisherEvidenceRecord,
  options: SocialPublicationPublisherStoreWriteOptions = {},
): Promise<SocialPublicationPublisherStoreResult<SocialPublicationPublisherEvidenceRecord>> {
  const rowResult = mapSocialPublicationPublisherEvidenceRecordToRow(record, {
    idempotency_key: options.idempotencyKey ?? null,
  });
  if (!rowResult.ok) {
    return validationFailure("Publisher evidence row failed validation.", rowResult.errors);
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
    return storageFailure(error, "Publisher evidence write failed.");
  }
}

export async function insertSocialPublicationPublisherMappedRequest(
  mapped: SocialPublicationPublisherMappedRequest,
  options: SocialPublicationPublisherStoreWriteOptions = {},
): Promise<SocialPublicationPublisherStoreResult<SocialPublicationPublisherMappedRequestInsertResult>> {
  const requestResult = await createSocialPublicationPublisherRequest(mapped.request, options);
  if (!requestResult.ok) return requestResult;

  if (!mapped.evidence) {
    return { ok: true, value: immutableClone({ request: requestResult.value, evidence: null }) };
  }

  const evidenceResult = await insertSocialPublicationPublisherEvidence(
    mapped.evidence,
    options,
  );
  if (!evidenceResult.ok) return evidenceResult;

  return {
    ok: true,
    value: immutableClone({ request: requestResult.value, evidence: evidenceResult.value }),
  };
}

export async function insertSocialPublicationPublisherMappedResult(
  mapped: SocialPublicationPublisherMappedResult,
  options: SocialPublicationPublisherStoreWriteOptions = {},
): Promise<SocialPublicationPublisherStoreResult<SocialPublicationPublisherMappedResultInsertResult>> {
  const resultResult = await appendSocialPublicationPublisherResult(mapped.result, options);
  if (!resultResult.ok) return resultResult;

  if (!mapped.evidence) {
    return { ok: true, value: immutableClone({ result: resultResult.value, evidence: null }) };
  }

  const evidenceResult = await insertSocialPublicationPublisherEvidence(
    mapped.evidence,
    options,
  );
  if (!evidenceResult.ok) return evidenceResult;

  return {
    ok: true,
    value: immutableClone({ result: resultResult.value, evidence: evidenceResult.value }),
  };
}

export async function fetchSocialPublicationPublisherRequestRows(
  filter: SocialPublicationPublisherReadFilter = {},
): Promise<SocialPublicationPublisherStoreResult<readonly SocialPublicationPublisherRequestRow[]>> {
  try {
    return mapStoredRequestRows(await storage().fetchRequests(filter), "fetch requests");
  } catch (error) {
    return storageFailure(error, "Publisher request read failed.");
  }
}

export async function fetchSocialPublicationPublisherResultRows(
  filter: SocialPublicationPublisherReadFilter = {},
): Promise<SocialPublicationPublisherStoreResult<readonly SocialPublicationPublisherResultRow[]>> {
  try {
    return mapStoredResultRows(await storage().fetchResults(filter), "fetch results");
  } catch (error) {
    return storageFailure(error, "Publisher result read failed.");
  }
}

export async function fetchSocialPublicationPublisherEvidenceRows(
  filter: SocialPublicationPublisherReadFilter = {},
): Promise<SocialPublicationPublisherStoreResult<readonly SocialPublicationPublisherEvidenceRow[]>> {
  try {
    return mapStoredEvidenceRows(await storage().fetchEvidence(filter), "fetch evidence");
  } catch (error) {
    return storageFailure(error, "Publisher evidence read failed.");
  }
}

export async function fetchSocialPublicationPublisherRows(
  filter: SocialPublicationPublisherReadFilter = {},
): Promise<SocialPublicationPublisherStoreResult<SocialPublicationPublisherRowsModel>> {
  try {
    const rows = {
      requests: await storage().fetchRequests(filter),
      results: await storage().fetchResults(filter),
      evidence: await storage().fetchEvidence(filter),
    };
    return mapStoredRowsModel(rows, "fetch publisher rows");
  } catch (error) {
    return storageFailure(error, "Publisher read failed.");
  }
}

export async function fetchSocialPublicationPublisherRecords(
  filter: SocialPublicationPublisherReadFilter = {},
): Promise<SocialPublicationPublisherStoreResult<SocialPublicationPublisherRowsPersistenceModel>> {
  const rows = await fetchSocialPublicationPublisherRows(filter);
  if (!rows.ok) return rows;

  const mapped = mapSocialPublicationPublisherRowsToPersistenceModel(rows.value);
  if (!mapped.ok) {
    return validationFailure(
      "Publisher rows failed persistence mapping during read.",
      mapped.errors,
    );
  }

  return { ok: true, value: mapped.value };
}

export function fetchSocialPublicationPublisherRowsByPost(
  socialPostId: string,
): Promise<SocialPublicationPublisherStoreResult<SocialPublicationPublisherRowsModel>> {
  return fetchSocialPublicationPublisherRows({ socialPostId });
}

export function fetchSocialPublicationPublisherRowsByPublicationTarget(
  publicationTargetId: string,
): Promise<SocialPublicationPublisherStoreResult<SocialPublicationPublisherRowsModel>> {
  return fetchSocialPublicationPublisherRows({ publicationTargetId });
}

export function fetchSocialPublicationPublisherRowsByManifest(
  publicationManifestId: string,
): Promise<SocialPublicationPublisherStoreResult<SocialPublicationPublisherRowsModel>> {
  return fetchSocialPublicationPublisherRows({ publicationManifestId });
}

export function fetchSocialPublicationPublisherRowsByJob(
  publisherJobId: string,
): Promise<SocialPublicationPublisherStoreResult<SocialPublicationPublisherRowsModel>> {
  return fetchSocialPublicationPublisherRows({ publisherJobId });
}

export function fetchSocialPublicationPublisherRecordsByPost(
  socialPostId: string,
): Promise<SocialPublicationPublisherStoreResult<SocialPublicationPublisherRowsPersistenceModel>> {
  return fetchSocialPublicationPublisherRecords({ socialPostId });
}

export function fetchSocialPublicationPublisherRecordsByPublicationTarget(
  publicationTargetId: string,
): Promise<SocialPublicationPublisherStoreResult<SocialPublicationPublisherRowsPersistenceModel>> {
  return fetchSocialPublicationPublisherRecords({ publicationTargetId });
}

export function fetchSocialPublicationPublisherRecordsByManifest(
  publicationManifestId: string,
): Promise<SocialPublicationPublisherStoreResult<SocialPublicationPublisherRowsPersistenceModel>> {
  return fetchSocialPublicationPublisherRecords({ publicationManifestId });
}

export function fetchSocialPublicationPublisherRecordsByJob(
  publisherJobId: string,
): Promise<SocialPublicationPublisherStoreResult<SocialPublicationPublisherRowsPersistenceModel>> {
  return fetchSocialPublicationPublisherRecords({ publisherJobId });
}

export async function fetchSocialPublicationPublisherRequestRecordByRequestId(
  publisherRequestId: string,
): Promise<SocialPublicationPublisherStoreResult<SocialPublicationPublisherRequestRecord | null>> {
  try {
    const row = await storage().findRequestByRequestId(publisherRequestId);
    if (!row) return { ok: true, value: null };

    return mapStoredRequestRow(row, "fetch request by id");
  } catch (error) {
    return storageFailure(error, "Publisher request lookup failed.");
  }
}

function storage(): SocialPublicationPublisherStoreStorage {
  if (testStorage) return testStorage;
  return createSupabasePublisherStoreStorage();
}

function createSupabasePublisherStoreStorage(): SocialPublicationPublisherStoreStorage {
  const supabase = createServiceRoleClient();

  return {
    async insertRequest(row) {
      const { data, error } = await supabase
        .from("social_publication_publisher_requests")
        .insert(row)
        .select(REQUEST_SELECT)
        .single<SocialPublicationPublisherRequestRow>();

      if (error) throw new Error(error.message);
      return data;
    },
    async insertResult(row) {
      const { data, error } = await supabase
        .from("social_publication_publisher_results")
        .insert(row)
        .select(RESULT_SELECT)
        .single<SocialPublicationPublisherResultRow>();

      if (error) throw new Error(error.message);
      return data;
    },
    async insertEvidence(row) {
      const { data, error } = await supabase
        .from("social_publication_publisher_evidence")
        .insert(row)
        .select(EVIDENCE_SELECT)
        .single<SocialPublicationPublisherEvidenceRow>();

      if (error) throw new Error(error.message);
      return data;
    },
    findRequestByRequestId(publisherRequestId) {
      return maybeSingleRequest("publisher_request_id", publisherRequestId);
    },
    findRequestByIdempotencyKey(idempotencyKey) {
      return maybeSingleRequest("idempotency_key", idempotencyKey);
    },
    findResultByResultId(publisherResultId) {
      return maybeSingleResult("publisher_result_id", publisherResultId);
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
    fetchRequests(filter) {
      return applyRequestReadFilter(filter);
    },
    fetchResults(filter) {
      return applyResultReadFilter(filter);
    },
    fetchEvidence(filter) {
      return applyEvidenceReadFilter(filter);
    },
  };

  async function maybeSingleRequest(
    column: string,
    value: string,
  ): Promise<SocialPublicationPublisherRequestRow | null> {
    const { data, error } = await supabase
      .from("social_publication_publisher_requests")
      .select(REQUEST_SELECT)
      .eq(column, value)
      .maybeSingle<SocialPublicationPublisherRequestRow>();

    if (error) throw new Error(error.message);
    return data;
  }

  async function maybeSingleResult(
    column: string,
    value: string,
  ): Promise<SocialPublicationPublisherResultRow | null> {
    const { data, error } = await supabase
      .from("social_publication_publisher_results")
      .select(RESULT_SELECT)
      .eq(column, value)
      .maybeSingle<SocialPublicationPublisherResultRow>();

    if (error) throw new Error(error.message);
    return data;
  }

  async function maybeSingleEvidence(
    column: string,
    value: string,
  ): Promise<SocialPublicationPublisherEvidenceRow | null> {
    const { data, error } = await supabase
      .from("social_publication_publisher_evidence")
      .select(EVIDENCE_SELECT)
      .eq(column, value)
      .maybeSingle<SocialPublicationPublisherEvidenceRow>();

    if (error) throw new Error(error.message);
    return data;
  }

  async function applyRequestReadFilter(
    filter: SocialPublicationPublisherReadFilter,
  ): Promise<SocialPublicationPublisherRequestRow[]> {
    let query = supabase.from("social_publication_publisher_requests").select(REQUEST_SELECT);
    query = applyReadFilter(query, filter);
    if (filter.publisherJobId) query = query.eq("publisher_job_id", filter.publisherJobId);

    const { data, error } = await query
      .order("requested_at", { ascending: true })
      .order("publisher_request_id", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as SocialPublicationPublisherRequestRow[];
  }

  async function applyResultReadFilter(
    filter: SocialPublicationPublisherReadFilter,
  ): Promise<SocialPublicationPublisherResultRow[]> {
    let query = supabase.from("social_publication_publisher_results").select(RESULT_SELECT);
    query = applyReadFilter(query, filter);
    if (filter.publisherJobId) query = query.eq("publisher_job_id", filter.publisherJobId);

    const { data, error } = await query
      .order("recorded_at", { ascending: true })
      .order("publisher_result_id", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as SocialPublicationPublisherResultRow[];
  }

  async function applyEvidenceReadFilter(
    filter: SocialPublicationPublisherReadFilter,
  ): Promise<SocialPublicationPublisherEvidenceRow[]> {
    let query = supabase.from("social_publication_publisher_evidence").select(EVIDENCE_SELECT);
    query = applyReadFilter(query, filter);

    const { data, error } = await query
      .order("recorded_at", { ascending: true })
      .order("evidence_id", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as SocialPublicationPublisherEvidenceRow[];
  }
}

function applyReadFilter<TQuery extends { eq: (column: string, value: string) => TQuery }>(
  query: TQuery,
  filter: SocialPublicationPublisherReadFilter,
): TQuery {
  let nextQuery = query;
  if (filter.socialPostId) nextQuery = nextQuery.eq("social_post_id", filter.socialPostId);
  if (filter.publicationTargetId) {
    nextQuery = nextQuery.eq("publication_target_id", filter.publicationTargetId);
  }
  if (filter.publicationManifestId) {
    nextQuery = nextQuery.eq("publication_manifest_id", filter.publicationManifestId);
  }
  return nextQuery;
}

async function findRequestDuplicate(
  row: SocialPublicationPublisherRequestRow,
): Promise<SocialPublicationPublisherStoreResult<never> | null> {
  if (await storage().findRequestByRequestId(row.publisher_request_id)) {
    return duplicateIdentity("Publisher request identity already exists.");
  }
  if (
    row.idempotency_key &&
    (await storage().findRequestByIdempotencyKey(row.idempotency_key))
  ) {
    return duplicateIdempotency();
  }
  return null;
}

async function findResultDuplicate(
  row: SocialPublicationPublisherResultRow,
): Promise<SocialPublicationPublisherStoreResult<never> | null> {
  if (await storage().findResultByResultId(row.publisher_result_id)) {
    return duplicateIdentity("Publisher result identity already exists.");
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
  row: SocialPublicationPublisherEvidenceRow,
): Promise<SocialPublicationPublisherStoreResult<never> | null> {
  if (await storage().findEvidenceByEvidenceId(row.evidence_id)) {
    return duplicateIdentity("Publisher evidence identity already exists.");
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
  row: SocialPublicationPublisherResultRow,
): Promise<SocialPublicationPublisherStoreError | null> {
  const request = await storage().findRequestByRequestId(row.publisher_request_id);
  if (!request) {
    return storeError("parent_missing", "Publisher result parent request is missing.");
  }

  return requestResultShareScope(request, row)
    ? null
    : storeError("scope_mismatch", "Publisher result scope must match parent request scope.");
}

async function validateEvidenceParents(
  row: SocialPublicationPublisherEvidenceRow,
): Promise<SocialPublicationPublisherStoreError | null> {
  const request = await storage().findRequestByRequestId(row.publisher_request_id);
  if (!request) {
    return storeError("parent_missing", "Publisher evidence parent request is missing.");
  }

  if (!rowMatchesScope(row, request)) {
    return storeError(
      "scope_mismatch",
      "Publisher evidence scope must match parent request scope.",
    );
  }

  if (!row.publisher_result_id) return null;

  const result = await storage().findResultByResultId(row.publisher_result_id);
  if (!result) {
    return storeError("parent_missing", "Publisher evidence parent result is missing.");
  }

  if (result.publisher_request_id !== row.publisher_request_id) {
    return storeError(
      "scope_mismatch",
      "Publisher evidence result must belong to the same parent request.",
    );
  }

  return rowMatchesScope(row, result)
    ? null
    : storeError(
        "scope_mismatch",
        "Publisher evidence scope must match parent result scope.",
      );
}

function requestResultShareScope(
  request: SocialPublicationPublisherRequestRow,
  result: SocialPublicationPublisherResultRow,
): boolean {
  return (
    request.publisher_job_id === result.publisher_job_id &&
    request.channel_id === result.channel_id &&
    request.channel_platform === result.channel_platform &&
    request.channel_type === result.channel_type &&
    rowMatchesScope(result, request)
  );
}

type ScopeColumns = Readonly<{
  social_post_id: string;
  publication_target_id: string;
  publication_manifest_id: string | null;
  schedule_id: string | null;
  ledger_entry_id: string | null;
  publication_attempt_id: string | null;
  owner_approval_id: string | null;
  approval_id: string | null;
  proposal_id: string | null;
}>;

function rowMatchesScope(row: ScopeColumns, parent: ScopeColumns): boolean {
  return (
    row.social_post_id === parent.social_post_id &&
    row.publication_target_id === parent.publication_target_id &&
    row.publication_manifest_id === parent.publication_manifest_id &&
    row.schedule_id === parent.schedule_id &&
    row.ledger_entry_id === parent.ledger_entry_id &&
    row.publication_attempt_id === parent.publication_attempt_id &&
    row.owner_approval_id === parent.owner_approval_id &&
    row.approval_id === parent.approval_id &&
    row.proposal_id === parent.proposal_id
  );
}

function mapStoredRequestRows(
  rows: readonly SocialPublicationPublisherRequestRow[],
  operation: string,
): SocialPublicationPublisherStoreResult<readonly SocialPublicationPublisherRequestRow[]> {
  const mappedRows: SocialPublicationPublisherRequestRow[] = [];
  for (const row of rows) {
    const mapped = mapStoredRequestRowToRow(row, operation);
    if (!mapped.ok) return mapped;
    mappedRows.push(mapped.value);
  }

  return { ok: true, value: immutableClone(sortRequestRows(mappedRows)) };
}

function mapStoredResultRows(
  rows: readonly SocialPublicationPublisherResultRow[],
  operation: string,
): SocialPublicationPublisherStoreResult<readonly SocialPublicationPublisherResultRow[]> {
  const mappedRows: SocialPublicationPublisherResultRow[] = [];
  for (const row of rows) {
    const mapped = mapStoredResultRowToRow(row, operation);
    if (!mapped.ok) return mapped;
    mappedRows.push(mapped.value);
  }

  return { ok: true, value: immutableClone(sortResultRows(mappedRows)) };
}

function mapStoredEvidenceRows(
  rows: readonly SocialPublicationPublisherEvidenceRow[],
  operation: string,
): SocialPublicationPublisherStoreResult<readonly SocialPublicationPublisherEvidenceRow[]> {
  const mappedRows: SocialPublicationPublisherEvidenceRow[] = [];
  for (const row of rows) {
    const mapped = mapStoredEvidenceRowToRow(row, operation);
    if (!mapped.ok) return mapped;
    mappedRows.push(mapped.value);
  }

  return { ok: true, value: immutableClone(sortEvidenceRows(mappedRows)) };
}

function mapStoredRowsModel(
  rows: SocialPublicationPublisherRowsModel,
  operation: string,
): SocialPublicationPublisherStoreResult<SocialPublicationPublisherRowsModel> {
  const requests = mapStoredRequestRows(rows.requests, operation);
  if (!requests.ok) return requests;

  const results = mapStoredResultRows(rows.results, operation);
  if (!results.ok) return results;

  const evidence = mapStoredEvidenceRows(rows.evidence, operation);
  if (!evidence.ok) return evidence;

  return {
    ok: true,
    value: immutableClone({
      requests: requests.value,
      results: results.value,
      evidence: evidence.value,
    }),
  };
}

function mapStoredRequestRow(
  row: SocialPublicationPublisherRequestRow,
  operation: string,
): SocialPublicationPublisherStoreResult<SocialPublicationPublisherRequestRecord> {
  const rowResult = mapStoredRequestRowToRow(row, operation);
  if (!rowResult.ok) return rowResult;

  const record = mapSocialPublicationPublisherRequestRowToRecord(rowResult.value);
  if (!record.ok) {
    return validationFailure(
      `Publisher request row failed mapping during ${operation}.`,
      record.errors,
    );
  }

  return { ok: true, value: record.value };
}

function mapStoredResultRow(
  row: SocialPublicationPublisherResultRow,
  operation: string,
): SocialPublicationPublisherStoreResult<SocialPublicationPublisherResultRecord> {
  const rowResult = mapStoredResultRowToRow(row, operation);
  if (!rowResult.ok) return rowResult;

  const record = mapSocialPublicationPublisherResultRowToRecord(rowResult.value);
  if (!record.ok) {
    return validationFailure(
      `Publisher result row failed mapping during ${operation}.`,
      record.errors,
    );
  }

  return { ok: true, value: record.value };
}

function mapStoredEvidenceRow(
  row: SocialPublicationPublisherEvidenceRow,
  operation: string,
): SocialPublicationPublisherStoreResult<SocialPublicationPublisherEvidenceRecord> {
  const rowResult = mapStoredEvidenceRowToRow(row, operation);
  if (!rowResult.ok) return rowResult;

  const record = mapSocialPublicationPublisherEvidenceRowToRecord(rowResult.value);
  if (!record.ok) {
    return validationFailure(
      `Publisher evidence row failed mapping during ${operation}.`,
      record.errors,
    );
  }

  return { ok: true, value: record.value };
}

function mapStoredRequestRowToRow(
  row: SocialPublicationPublisherRequestRow,
  operation: string,
): SocialPublicationPublisherStoreResult<SocialPublicationPublisherRequestRow> {
  const validation = validateSocialPublicationPublisherRequestRow(row);
  if (!validation.ok) {
    return validationFailure(
      `Publisher request row failed validation during ${operation}.`,
      validation.errors,
    );
  }

  return { ok: true, value: immutableClone(row) };
}

function mapStoredResultRowToRow(
  row: SocialPublicationPublisherResultRow,
  operation: string,
): SocialPublicationPublisherStoreResult<SocialPublicationPublisherResultRow> {
  const validation = validateSocialPublicationPublisherResultRow(row);
  if (!validation.ok) {
    return validationFailure(
      `Publisher result row failed validation during ${operation}.`,
      validation.errors,
    );
  }

  return { ok: true, value: immutableClone(row) };
}

function mapStoredEvidenceRowToRow(
  row: SocialPublicationPublisherEvidenceRow,
  operation: string,
): SocialPublicationPublisherStoreResult<SocialPublicationPublisherEvidenceRow> {
  const validation = validateSocialPublicationPublisherEvidenceRow(row);
  if (!validation.ok) {
    return validationFailure(
      `Publisher evidence row failed validation during ${operation}.`,
      validation.errors,
    );
  }

  return { ok: true, value: immutableClone(row) };
}

function duplicateIdentity(
  message: string,
): SocialPublicationPublisherStoreResult<never> {
  return { ok: false, error: storeError("duplicate_identity", message) };
}

function duplicateIdempotency(): SocialPublicationPublisherStoreResult<never> {
  return {
    ok: false,
    error: storeError(
      "duplicate_idempotency_key",
      "Publisher idempotency key already exists.",
    ),
  };
}

function sortRequestRows(
  rows: readonly SocialPublicationPublisherRequestRow[],
): SocialPublicationPublisherRequestRow[] {
  return [...rows].sort(
    (left, right) =>
      left.requested_at.localeCompare(right.requested_at) ||
      left.publisher_request_id.localeCompare(right.publisher_request_id),
  );
}

function sortResultRows(
  rows: readonly SocialPublicationPublisherResultRow[],
): SocialPublicationPublisherResultRow[] {
  return [...rows].sort(
    (left, right) =>
      left.recorded_at.localeCompare(right.recorded_at) ||
      left.publisher_result_id.localeCompare(right.publisher_result_id),
  );
}

function sortEvidenceRows(
  rows: readonly SocialPublicationPublisherEvidenceRow[],
): SocialPublicationPublisherEvidenceRow[] {
  return [...rows].sort(
    (left, right) =>
      left.recorded_at.localeCompare(right.recorded_at) ||
      left.evidence_id.localeCompare(right.evidence_id),
  );
}

function validationFailure<T>(
  message: string,
  validationErrors: readonly (
    | SocialPublicationPublisherRecordError
    | SocialPublicationPublisherRowError
  )[],
): SocialPublicationPublisherStoreResult<T> {
  return {
    ok: false,
    error: storeError("validation_failed", message, validationErrors),
  };
}

function storageFailure<T>(
  error: unknown,
  fallbackMessage: string,
): SocialPublicationPublisherStoreResult<T> {
  return {
    ok: false,
    error: storeError(
      "storage_error",
      error instanceof Error ? error.message : fallbackMessage,
    ),
  };
}

function storeError(
  code: SocialPublicationPublisherStoreErrorCode,
  message: string,
  validationErrors?: readonly (
    | SocialPublicationPublisherRecordError
    | SocialPublicationPublisherRowError
  )[],
): SocialPublicationPublisherStoreError {
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
