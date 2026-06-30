import { createServiceRoleClient } from "../supabase/admin";

import {
  mapSocialPublicationLedgerAttemptRecordToRow,
  mapSocialPublicationLedgerAttemptRowToRecord,
  mapSocialPublicationLedgerEvidenceRecordToRow,
  mapSocialPublicationLedgerEvidenceRowToRecord,
  mapSocialPublicationLedgerOutcomeRecordToRow,
  mapSocialPublicationLedgerOutcomeRowToRecord,
  mapSocialPublicationLedgerRowsToPersistenceModel,
  validateSocialPublicationLedgerAttemptRow,
  validateSocialPublicationLedgerEvidenceRow,
  validateSocialPublicationLedgerOutcomeRow,
  type SocialPublicationLedgerAttemptRow,
  type SocialPublicationLedgerEvidenceRow,
  type SocialPublicationLedgerOutcomeRow,
  type SocialPublicationLedgerRowError,
  type SocialPublicationLedgerRowsModel,
} from "./social-publication-ledger-rows";
import type { SocialPublicationLedgerMappedEntry } from "./social-publication-ledger-mapper";
import {
  validateSocialPublicationLedgerAttemptRecord,
  validateSocialPublicationLedgerEvidenceRecord,
  validateSocialPublicationLedgerOutcomeRecord,
  type SocialPublicationLedgerAttemptRecord,
  type SocialPublicationLedgerEvidenceRecord,
  type SocialPublicationLedgerOutcomeRecord,
  type SocialPublicationLedgerPersistenceError,
  type SocialPublicationLedgerPersistenceModel,
} from "./social-publication-ledger-persistence";

export const SOCIAL_PUBLICATION_LEDGER_STORE_ERROR_CODES = [
  "validation_failed",
  "duplicate_identity",
  "duplicate_idempotency_key",
  "parent_missing",
  "scope_mismatch",
  "storage_error",
  "storage_inconsistent",
] as const;

export type SocialPublicationLedgerStoreErrorCode =
  (typeof SOCIAL_PUBLICATION_LEDGER_STORE_ERROR_CODES)[number];

export type SocialPublicationLedgerStoreError = Readonly<{
  code: SocialPublicationLedgerStoreErrorCode;
  message: string;
  validationErrors?: readonly (
    | SocialPublicationLedgerPersistenceError
    | SocialPublicationLedgerRowError
  )[];
}>;

export type SocialPublicationLedgerStoreResult<T> = Readonly<
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: SocialPublicationLedgerStoreError;
    }
>;

export type SocialPublicationLedgerStoreWriteOptions = Readonly<{
  idempotencyKey?: string | null;
}>;

export type SocialPublicationLedgerReadFilter = Readonly<{
  socialPostId?: string;
  publicationManifestId?: string;
  publicationTargetId?: string;
}>;

export type SocialPublicationLedgerStoreStorage = Readonly<{
  insertAttempt(
    row: SocialPublicationLedgerAttemptRow,
  ): Promise<SocialPublicationLedgerAttemptRow>;
  insertOutcome(
    row: SocialPublicationLedgerOutcomeRow,
  ): Promise<SocialPublicationLedgerOutcomeRow>;
  insertEvidence(
    row: SocialPublicationLedgerEvidenceRow,
  ): Promise<SocialPublicationLedgerEvidenceRow>;
  findAttemptByLedgerEntryId(
    ledgerEntryId: string,
  ): Promise<SocialPublicationLedgerAttemptRow | null>;
  findAttemptByPublicationAttemptId(
    publicationAttemptId: string,
  ): Promise<SocialPublicationLedgerAttemptRow | null>;
  findAttemptByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialPublicationLedgerAttemptRow | null>;
  findOutcomeByLedgerEntryId(
    ledgerEntryId: string,
  ): Promise<SocialPublicationLedgerOutcomeRow | null>;
  findOutcomeByOutcomeId(
    outcomeId: string,
  ): Promise<SocialPublicationLedgerOutcomeRow | null>;
  findOutcomeByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialPublicationLedgerOutcomeRow | null>;
  findEvidenceByEvidenceId(
    evidenceId: string,
  ): Promise<SocialPublicationLedgerEvidenceRow | null>;
  findEvidenceByLedgerEntryId(
    ledgerEntryId: string,
  ): Promise<SocialPublicationLedgerEvidenceRow | null>;
  findEvidenceByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialPublicationLedgerEvidenceRow | null>;
  fetchAttempts(
    filter: SocialPublicationLedgerReadFilter,
  ): Promise<SocialPublicationLedgerAttemptRow[]>;
  fetchOutcomes(
    filter: SocialPublicationLedgerReadFilter,
  ): Promise<SocialPublicationLedgerOutcomeRow[]>;
  fetchEvidence(
    filter: SocialPublicationLedgerReadFilter,
  ): Promise<SocialPublicationLedgerEvidenceRow[]>;
}>;

const ATTEMPT_SELECT =
  "ledger_entry_id, publication_attempt_id, attempt_sequence, event_type, social_post_id, publication_target_id, publication_manifest_id, owner_approval_id, approval_id, proposal_id, request_summary, recorded_at, recorded_by_actor, recorded_source, append_only, immutable, idempotency_key";

const OUTCOME_SELECT =
  "ledger_entry_id, outcome_id, publication_attempt_id, attempt_sequence, event_type, social_post_id, publication_target_id, publication_manifest_id, owner_approval_id, approval_id, proposal_id, result_summary, error_summary, recorded_at, recorded_by_actor, recorded_source, append_only, immutable, idempotency_key";

const EVIDENCE_SELECT =
  "evidence_id, ledger_entry_id, publication_attempt_id, outcome_id, social_post_id, publication_target_id, publication_manifest_id, owner_approval_id, approval_id, proposal_id, evidence_summary, recorded_at, recorded_by_actor, recorded_source, append_only, immutable, idempotency_key";

let testStorage: SocialPublicationLedgerStoreStorage | null = null;

export function configureSocialPublicationLedgerStoreTestDependencies(
  storage: SocialPublicationLedgerStoreStorage | null,
): void {
  testStorage = storage;
}

export async function insertPublicationLedgerAttempt(
  record: SocialPublicationLedgerAttemptRecord,
  options: SocialPublicationLedgerStoreWriteOptions = {},
): Promise<SocialPublicationLedgerStoreResult<SocialPublicationLedgerAttemptRecord>> {
  const recordValidation = validateSocialPublicationLedgerAttemptRecord(record);
  if (!recordValidation.ok) {
    return validationFailure(
      "Publication ledger attempt record failed validation.",
      recordValidation.errors,
    );
  }

  const rowResult = mapSocialPublicationLedgerAttemptRecordToRow(record, {
    idempotency_key: options.idempotencyKey ?? null,
  });
  if (!rowResult.ok) {
    return validationFailure(
      "Publication ledger attempt row failed validation.",
      rowResult.errors,
    );
  }

  try {
    const duplicate = await findAttemptDuplicate(rowResult.value);
    if (duplicate) return duplicate;

    return mapStoredAttemptRow(
      await storage().insertAttempt(rowResult.value),
      "insert attempt",
    );
  } catch (error) {
    return storageFailure(error, "Publication ledger attempt write failed.");
  }
}

export async function insertPublicationLedgerOutcome(
  record: SocialPublicationLedgerOutcomeRecord,
  options: SocialPublicationLedgerStoreWriteOptions = {},
): Promise<SocialPublicationLedgerStoreResult<SocialPublicationLedgerOutcomeRecord>> {
  const recordValidation = validateSocialPublicationLedgerOutcomeRecord(record);
  if (!recordValidation.ok) {
    return validationFailure(
      "Publication ledger outcome record failed validation.",
      recordValidation.errors,
    );
  }

  const rowResult = mapSocialPublicationLedgerOutcomeRecordToRow(record, {
    idempotency_key: options.idempotencyKey ?? null,
  });
  if (!rowResult.ok) {
    return validationFailure(
      "Publication ledger outcome row failed validation.",
      rowResult.errors,
    );
  }

  try {
    const parentError = await validateOutcomeParent(rowResult.value);
    if (parentError) return { ok: false, error: parentError };

    const duplicate = await findOutcomeDuplicate(rowResult.value);
    if (duplicate) return duplicate;

    return mapStoredOutcomeRow(
      await storage().insertOutcome(rowResult.value),
      "insert outcome",
    );
  } catch (error) {
    return storageFailure(error, "Publication ledger outcome write failed.");
  }
}

export async function insertPublicationLedgerEvidence(
  record: SocialPublicationLedgerEvidenceRecord,
  options: SocialPublicationLedgerStoreWriteOptions = {},
): Promise<SocialPublicationLedgerStoreResult<SocialPublicationLedgerEvidenceRecord>> {
  const recordValidation = validateSocialPublicationLedgerEvidenceRecord(record);
  if (!recordValidation.ok) {
    return validationFailure(
      "Publication ledger evidence record failed validation.",
      recordValidation.errors,
    );
  }

  const rowResult = mapSocialPublicationLedgerEvidenceRecordToRow(record, {
    idempotency_key: options.idempotencyKey ?? null,
  });
  if (!rowResult.ok) {
    return validationFailure(
      "Publication ledger evidence row failed validation.",
      rowResult.errors,
    );
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
    return storageFailure(error, "Publication ledger evidence write failed.");
  }
}

export async function insertPublicationLedgerMappedEntry(
  mappedEntry: SocialPublicationLedgerMappedEntry,
  options: SocialPublicationLedgerStoreWriteOptions = {},
): Promise<SocialPublicationLedgerStoreResult<SocialPublicationLedgerPersistenceModel>> {
  const attempts: SocialPublicationLedgerAttemptRecord[] = [];
  const outcomes: SocialPublicationLedgerOutcomeRecord[] = [];
  const evidence: SocialPublicationLedgerEvidenceRecord[] = [];

  if (mappedEntry.attempt) {
    const result = await insertPublicationLedgerAttempt(
      mappedEntry.attempt,
      options,
    );
    if (!result.ok) return result;
    attempts.push(result.value);
  }

  if (mappedEntry.outcome) {
    const result = await insertPublicationLedgerOutcome(
      mappedEntry.outcome,
      options,
    );
    if (!result.ok) return result;
    outcomes.push(result.value);
  }

  if (mappedEntry.evidence) {
    const result = await insertPublicationLedgerEvidence(
      mappedEntry.evidence,
      options,
    );
    if (!result.ok) return result;
    evidence.push(result.value);
  }

  return { ok: true, value: immutableClone({ attempts, outcomes, evidence }) };
}

export async function fetchPublicationLedgerAttemptRows(
  filter: SocialPublicationLedgerReadFilter = {},
): Promise<SocialPublicationLedgerStoreResult<readonly SocialPublicationLedgerAttemptRow[]>> {
  try {
    return mapStoredAttemptRows(await storage().fetchAttempts(filter), "fetch attempts");
  } catch (error) {
    return storageFailure(error, "Publication ledger attempt read failed.");
  }
}

export async function fetchPublicationLedgerOutcomeRows(
  filter: SocialPublicationLedgerReadFilter = {},
): Promise<SocialPublicationLedgerStoreResult<readonly SocialPublicationLedgerOutcomeRow[]>> {
  try {
    return mapStoredOutcomeRows(await storage().fetchOutcomes(filter), "fetch outcomes");
  } catch (error) {
    return storageFailure(error, "Publication ledger outcome read failed.");
  }
}

export async function fetchPublicationLedgerEvidenceRows(
  filter: SocialPublicationLedgerReadFilter = {},
): Promise<SocialPublicationLedgerStoreResult<readonly SocialPublicationLedgerEvidenceRow[]>> {
  try {
    return mapStoredEvidenceRows(await storage().fetchEvidence(filter), "fetch evidence");
  } catch (error) {
    return storageFailure(error, "Publication ledger evidence read failed.");
  }
}

export async function fetchPublicationLedgerRows(
  filter: SocialPublicationLedgerReadFilter = {},
): Promise<SocialPublicationLedgerStoreResult<SocialPublicationLedgerRowsModel>> {
  try {
    const rows = {
      attempts: await storage().fetchAttempts(filter),
      outcomes: await storage().fetchOutcomes(filter),
      evidence: await storage().fetchEvidence(filter),
    };
    return mapStoredRowsModel(rows, "fetch ledger rows");
  } catch (error) {
    return storageFailure(error, "Publication ledger read failed.");
  }
}

export async function fetchPublicationLedgerRecords(
  filter: SocialPublicationLedgerReadFilter = {},
): Promise<SocialPublicationLedgerStoreResult<SocialPublicationLedgerPersistenceModel>> {
  const rows = await fetchPublicationLedgerRows(filter);
  if (!rows.ok) return rows;

  const mapped = mapSocialPublicationLedgerRowsToPersistenceModel(rows.value);
  if (!mapped.ok) {
    return validationFailure(
      "Publication ledger rows failed persistence mapping during read.",
      mapped.errors,
    );
  }

  return { ok: true, value: mapped.value };
}

export function fetchPublicationLedgerRowsByPost(
  socialPostId: string,
): Promise<SocialPublicationLedgerStoreResult<SocialPublicationLedgerRowsModel>> {
  return fetchPublicationLedgerRows({ socialPostId });
}

export function fetchPublicationLedgerRowsByManifest(
  publicationManifestId: string,
): Promise<SocialPublicationLedgerStoreResult<SocialPublicationLedgerRowsModel>> {
  return fetchPublicationLedgerRows({ publicationManifestId });
}

export function fetchPublicationLedgerRowsByPublicationTarget(
  publicationTargetId: string,
): Promise<SocialPublicationLedgerStoreResult<SocialPublicationLedgerRowsModel>> {
  return fetchPublicationLedgerRows({ publicationTargetId });
}

export function fetchPublicationLedgerRecordsByPost(
  socialPostId: string,
): Promise<SocialPublicationLedgerStoreResult<SocialPublicationLedgerPersistenceModel>> {
  return fetchPublicationLedgerRecords({ socialPostId });
}

export function fetchPublicationLedgerRecordsByManifest(
  publicationManifestId: string,
): Promise<SocialPublicationLedgerStoreResult<SocialPublicationLedgerPersistenceModel>> {
  return fetchPublicationLedgerRecords({ publicationManifestId });
}

export function fetchPublicationLedgerRecordsByPublicationTarget(
  publicationTargetId: string,
): Promise<SocialPublicationLedgerStoreResult<SocialPublicationLedgerPersistenceModel>> {
  return fetchPublicationLedgerRecords({ publicationTargetId });
}

function storage(): SocialPublicationLedgerStoreStorage {
  if (testStorage) return testStorage;
  return createSupabasePublicationLedgerStoreStorage();
}

function createSupabasePublicationLedgerStoreStorage(): SocialPublicationLedgerStoreStorage {
  const supabase = createServiceRoleClient();

  return {
    async insertAttempt(row) {
      const { data, error } = await supabase
        .from("social_publication_ledger_attempts")
        .insert(row)
        .select(ATTEMPT_SELECT)
        .single<SocialPublicationLedgerAttemptRow>();

      if (error) throw new Error(error.message);
      return data;
    },
    async insertOutcome(row) {
      const { data, error } = await supabase
        .from("social_publication_ledger_outcomes")
        .insert(row)
        .select(OUTCOME_SELECT)
        .single<SocialPublicationLedgerOutcomeRow>();

      if (error) throw new Error(error.message);
      return data;
    },
    async insertEvidence(row) {
      const { data, error } = await supabase
        .from("social_publication_ledger_evidence")
        .insert(row)
        .select(EVIDENCE_SELECT)
        .single<SocialPublicationLedgerEvidenceRow>();

      if (error) throw new Error(error.message);
      return data;
    },
    findAttemptByLedgerEntryId(ledgerEntryId) {
      return maybeSingleAttempt("ledger_entry_id", ledgerEntryId);
    },
    findAttemptByPublicationAttemptId(publicationAttemptId) {
      return maybeSingleAttempt("publication_attempt_id", publicationAttemptId);
    },
    findAttemptByIdempotencyKey(idempotencyKey) {
      return maybeSingleAttempt("idempotency_key", idempotencyKey);
    },
    findOutcomeByLedgerEntryId(ledgerEntryId) {
      return maybeSingleOutcome("ledger_entry_id", ledgerEntryId);
    },
    findOutcomeByOutcomeId(outcomeId) {
      return maybeSingleOutcome("outcome_id", outcomeId);
    },
    findOutcomeByIdempotencyKey(idempotencyKey) {
      return maybeSingleOutcome("idempotency_key", idempotencyKey);
    },
    findEvidenceByEvidenceId(evidenceId) {
      return maybeSingleEvidence("evidence_id", evidenceId);
    },
    findEvidenceByLedgerEntryId(ledgerEntryId) {
      return maybeSingleEvidence("ledger_entry_id", ledgerEntryId);
    },
    findEvidenceByIdempotencyKey(idempotencyKey) {
      return maybeSingleEvidence("idempotency_key", idempotencyKey);
    },
    fetchAttempts(filter) {
      return applyAttemptReadFilter(filter);
    },
    fetchOutcomes(filter) {
      return applyOutcomeReadFilter(filter);
    },
    fetchEvidence(filter) {
      return applyEvidenceReadFilter(filter);
    },
  };

  async function maybeSingleAttempt(
    column: string,
    value: string,
  ): Promise<SocialPublicationLedgerAttemptRow | null> {
    const { data, error } = await supabase
      .from("social_publication_ledger_attempts")
      .select(ATTEMPT_SELECT)
      .eq(column, value)
      .maybeSingle<SocialPublicationLedgerAttemptRow>();

    if (error) throw new Error(error.message);
    return data;
  }

  async function maybeSingleOutcome(
    column: string,
    value: string,
  ): Promise<SocialPublicationLedgerOutcomeRow | null> {
    const { data, error } = await supabase
      .from("social_publication_ledger_outcomes")
      .select(OUTCOME_SELECT)
      .eq(column, value)
      .maybeSingle<SocialPublicationLedgerOutcomeRow>();

    if (error) throw new Error(error.message);
    return data;
  }

  async function maybeSingleEvidence(
    column: string,
    value: string,
  ): Promise<SocialPublicationLedgerEvidenceRow | null> {
    const { data, error } = await supabase
      .from("social_publication_ledger_evidence")
      .select(EVIDENCE_SELECT)
      .eq(column, value)
      .maybeSingle<SocialPublicationLedgerEvidenceRow>();

    if (error) throw new Error(error.message);
    return data;
  }

  async function applyAttemptReadFilter(
    filter: SocialPublicationLedgerReadFilter,
  ): Promise<SocialPublicationLedgerAttemptRow[]> {
    let query = supabase
      .from("social_publication_ledger_attempts")
      .select(ATTEMPT_SELECT);
    query = applyReadFilter(query, filter);
    const { data, error } = await query
      .order("attempt_sequence", { ascending: true })
      .order("recorded_at", { ascending: true })
      .order("ledger_entry_id", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as SocialPublicationLedgerAttemptRow[];
  }

  async function applyOutcomeReadFilter(
    filter: SocialPublicationLedgerReadFilter,
  ): Promise<SocialPublicationLedgerOutcomeRow[]> {
    let query = supabase
      .from("social_publication_ledger_outcomes")
      .select(OUTCOME_SELECT);
    query = applyReadFilter(query, filter);
    const { data, error } = await query
      .order("attempt_sequence", { ascending: true })
      .order("recorded_at", { ascending: true })
      .order("outcome_id", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as SocialPublicationLedgerOutcomeRow[];
  }

  async function applyEvidenceReadFilter(
    filter: SocialPublicationLedgerReadFilter,
  ): Promise<SocialPublicationLedgerEvidenceRow[]> {
    let query = supabase
      .from("social_publication_ledger_evidence")
      .select(EVIDENCE_SELECT);
    query = applyReadFilter(query, filter);
    const { data, error } = await query
      .order("recorded_at", { ascending: true })
      .order("evidence_id", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as SocialPublicationLedgerEvidenceRow[];
  }
}

function applyReadFilter<TQuery extends { eq: (column: string, value: string) => TQuery }>(
  query: TQuery,
  filter: SocialPublicationLedgerReadFilter,
): TQuery {
  let nextQuery = query;
  if (filter.socialPostId) nextQuery = nextQuery.eq("social_post_id", filter.socialPostId);
  if (filter.publicationManifestId) {
    nextQuery = nextQuery.eq(
      "publication_manifest_id",
      filter.publicationManifestId,
    );
  }
  if (filter.publicationTargetId) {
    nextQuery = nextQuery.eq("publication_target_id", filter.publicationTargetId);
  }
  return nextQuery;
}

async function findAttemptDuplicate(
  row: SocialPublicationLedgerAttemptRow,
): Promise<SocialPublicationLedgerStoreResult<never> | null> {
  if (await storage().findAttemptByLedgerEntryId(row.ledger_entry_id)) {
    return duplicateIdentity("Publication ledger attempt entry already exists.");
  }
  if (await storage().findAttemptByPublicationAttemptId(row.publication_attempt_id)) {
    return duplicateIdentity("Publication attempt identity already exists.");
  }
  if (
    row.idempotency_key &&
    (await storage().findAttemptByIdempotencyKey(row.idempotency_key))
  ) {
    return duplicateIdempotency();
  }
  return null;
}

async function findOutcomeDuplicate(
  row: SocialPublicationLedgerOutcomeRow,
): Promise<SocialPublicationLedgerStoreResult<never> | null> {
  if (await storage().findOutcomeByLedgerEntryId(row.ledger_entry_id)) {
    return duplicateIdentity("Publication ledger outcome entry already exists.");
  }
  if (await storage().findOutcomeByOutcomeId(row.outcome_id)) {
    return duplicateIdentity("Publication outcome identity already exists.");
  }
  if (
    row.idempotency_key &&
    (await storage().findOutcomeByIdempotencyKey(row.idempotency_key))
  ) {
    return duplicateIdempotency();
  }
  return null;
}

async function findEvidenceDuplicate(
  row: SocialPublicationLedgerEvidenceRow,
): Promise<SocialPublicationLedgerStoreResult<never> | null> {
  if (await storage().findEvidenceByEvidenceId(row.evidence_id)) {
    return duplicateIdentity("Publication evidence identity already exists.");
  }
  if (await storage().findEvidenceByLedgerEntryId(row.ledger_entry_id)) {
    return duplicateIdentity("Publication ledger evidence entry already exists.");
  }
  if (
    row.idempotency_key &&
    (await storage().findEvidenceByIdempotencyKey(row.idempotency_key))
  ) {
    return duplicateIdempotency();
  }
  return null;
}

async function validateOutcomeParent(
  row: SocialPublicationLedgerOutcomeRow,
): Promise<SocialPublicationLedgerStoreError | null> {
  const attempt = await storage().findAttemptByPublicationAttemptId(
    row.publication_attempt_id,
  );
  if (!attempt) {
    return storeError("parent_missing", "Publication outcome parent attempt is missing.");
  }

  return rowMatchesAttemptScope(row, attempt)
    ? null
    : storeError(
        "scope_mismatch",
        "Publication outcome scope must match parent attempt scope.",
      );
}

async function validateEvidenceParents(
  row: SocialPublicationLedgerEvidenceRow,
): Promise<SocialPublicationLedgerStoreError | null> {
  const attempt = await storage().findAttemptByPublicationAttemptId(
    row.publication_attempt_id,
  );
  if (!attempt) {
    return storeError("parent_missing", "Publication evidence parent attempt is missing.");
  }

  if (!rowMatchesAttemptScope(row, attempt)) {
    return storeError(
      "scope_mismatch",
      "Publication evidence scope must match parent attempt scope.",
    );
  }

  if (!row.outcome_id) return null;

  const outcome = await storage().findOutcomeByOutcomeId(row.outcome_id);
  if (!outcome) {
    return storeError("parent_missing", "Publication evidence parent outcome is missing.");
  }

  return rowMatchesOutcomeScope(row, outcome)
    ? null
    : storeError(
        "scope_mismatch",
        "Publication evidence scope must match parent outcome scope.",
      );
}

function rowMatchesAttemptScope(
  row: SocialPublicationLedgerOutcomeRow | SocialPublicationLedgerEvidenceRow,
  attempt: SocialPublicationLedgerAttemptRow,
): boolean {
  return (
    row.social_post_id === attempt.social_post_id &&
    row.publication_target_id === attempt.publication_target_id &&
    row.publication_manifest_id === attempt.publication_manifest_id &&
    row.owner_approval_id === attempt.owner_approval_id &&
    row.approval_id === attempt.approval_id &&
    row.proposal_id === attempt.proposal_id &&
    ("attempt_sequence" in row ? row.attempt_sequence === attempt.attempt_sequence : true)
  );
}

function rowMatchesOutcomeScope(
  row: SocialPublicationLedgerEvidenceRow,
  outcome: SocialPublicationLedgerOutcomeRow,
): boolean {
  return (
    row.publication_attempt_id === outcome.publication_attempt_id &&
    row.social_post_id === outcome.social_post_id &&
    row.publication_target_id === outcome.publication_target_id &&
    row.publication_manifest_id === outcome.publication_manifest_id &&
    row.owner_approval_id === outcome.owner_approval_id &&
    row.approval_id === outcome.approval_id &&
    row.proposal_id === outcome.proposal_id
  );
}

function mapStoredAttemptRows(
  rows: readonly SocialPublicationLedgerAttemptRow[],
  operation: string,
): SocialPublicationLedgerStoreResult<readonly SocialPublicationLedgerAttemptRow[]> {
  const mappedRows: SocialPublicationLedgerAttemptRow[] = [];
  for (const row of rows) {
    const mapped = mapStoredAttemptRowToRow(row, operation);
    if (!mapped.ok) return mapped;
    mappedRows.push(mapped.value);
  }

  return { ok: true, value: immutableClone(sortAttemptRows(mappedRows)) };
}

function mapStoredOutcomeRows(
  rows: readonly SocialPublicationLedgerOutcomeRow[],
  operation: string,
): SocialPublicationLedgerStoreResult<readonly SocialPublicationLedgerOutcomeRow[]> {
  const mappedRows: SocialPublicationLedgerOutcomeRow[] = [];
  for (const row of rows) {
    const mapped = mapStoredOutcomeRowToRow(row, operation);
    if (!mapped.ok) return mapped;
    mappedRows.push(mapped.value);
  }

  return { ok: true, value: immutableClone(sortOutcomeRows(mappedRows)) };
}

function mapStoredEvidenceRows(
  rows: readonly SocialPublicationLedgerEvidenceRow[],
  operation: string,
): SocialPublicationLedgerStoreResult<readonly SocialPublicationLedgerEvidenceRow[]> {
  const mappedRows: SocialPublicationLedgerEvidenceRow[] = [];
  for (const row of rows) {
    const mapped = mapStoredEvidenceRowToRow(row, operation);
    if (!mapped.ok) return mapped;
    mappedRows.push(mapped.value);
  }

  return { ok: true, value: immutableClone(sortEvidenceRows(mappedRows)) };
}

function mapStoredRowsModel(
  rows: SocialPublicationLedgerRowsModel,
  operation: string,
): SocialPublicationLedgerStoreResult<SocialPublicationLedgerRowsModel> {
  const attempts = mapStoredAttemptRows(rows.attempts, operation);
  if (!attempts.ok) return attempts;

  const outcomes = mapStoredOutcomeRows(rows.outcomes, operation);
  if (!outcomes.ok) return outcomes;

  const evidence = mapStoredEvidenceRows(rows.evidence, operation);
  if (!evidence.ok) return evidence;

  return {
    ok: true,
    value: immutableClone({
      attempts: attempts.value,
      outcomes: outcomes.value,
      evidence: evidence.value,
    }),
  };
}

function mapStoredAttemptRow(
  row: SocialPublicationLedgerAttemptRow,
  operation: string,
): SocialPublicationLedgerStoreResult<SocialPublicationLedgerAttemptRecord> {
  const rowResult = mapStoredAttemptRowToRow(row, operation);
  if (!rowResult.ok) return rowResult;

  const record = mapSocialPublicationLedgerAttemptRowToRecord(rowResult.value);
  if (!record.ok) {
    return validationFailure(
      `Publication ledger attempt row failed mapping during ${operation}.`,
      record.errors,
    );
  }

  return { ok: true, value: record.value };
}

function mapStoredOutcomeRow(
  row: SocialPublicationLedgerOutcomeRow,
  operation: string,
): SocialPublicationLedgerStoreResult<SocialPublicationLedgerOutcomeRecord> {
  const rowResult = mapStoredOutcomeRowToRow(row, operation);
  if (!rowResult.ok) return rowResult;

  const record = mapSocialPublicationLedgerOutcomeRowToRecord(rowResult.value);
  if (!record.ok) {
    return validationFailure(
      `Publication ledger outcome row failed mapping during ${operation}.`,
      record.errors,
    );
  }

  return { ok: true, value: record.value };
}

function mapStoredEvidenceRow(
  row: SocialPublicationLedgerEvidenceRow,
  operation: string,
): SocialPublicationLedgerStoreResult<SocialPublicationLedgerEvidenceRecord> {
  const rowResult = mapStoredEvidenceRowToRow(row, operation);
  if (!rowResult.ok) return rowResult;

  const record = mapSocialPublicationLedgerEvidenceRowToRecord(rowResult.value);
  if (!record.ok) {
    return validationFailure(
      `Publication ledger evidence row failed mapping during ${operation}.`,
      record.errors,
    );
  }

  return { ok: true, value: record.value };
}

function mapStoredAttemptRowToRow(
  row: SocialPublicationLedgerAttemptRow,
  operation: string,
): SocialPublicationLedgerStoreResult<SocialPublicationLedgerAttemptRow> {
  const validation = validateSocialPublicationLedgerAttemptRow(row);
  if (!validation.ok) {
    return validationFailure(
      `Publication ledger attempt row failed validation during ${operation}.`,
      validation.errors,
    );
  }

  return { ok: true, value: immutableClone(row) };
}

function mapStoredOutcomeRowToRow(
  row: SocialPublicationLedgerOutcomeRow,
  operation: string,
): SocialPublicationLedgerStoreResult<SocialPublicationLedgerOutcomeRow> {
  const validation = validateSocialPublicationLedgerOutcomeRow(row);
  if (!validation.ok) {
    return validationFailure(
      `Publication ledger outcome row failed validation during ${operation}.`,
      validation.errors,
    );
  }

  return { ok: true, value: immutableClone(row) };
}

function mapStoredEvidenceRowToRow(
  row: SocialPublicationLedgerEvidenceRow,
  operation: string,
): SocialPublicationLedgerStoreResult<SocialPublicationLedgerEvidenceRow> {
  const validation = validateSocialPublicationLedgerEvidenceRow(row);
  if (!validation.ok) {
    return validationFailure(
      `Publication ledger evidence row failed validation during ${operation}.`,
      validation.errors,
    );
  }

  return { ok: true, value: immutableClone(row) };
}

function duplicateIdentity(
  message: string,
): SocialPublicationLedgerStoreResult<never> {
  return { ok: false, error: storeError("duplicate_identity", message) };
}

function duplicateIdempotency(): SocialPublicationLedgerStoreResult<never> {
  return {
    ok: false,
    error: storeError(
      "duplicate_idempotency_key",
      "Publication ledger idempotency key already exists.",
    ),
  };
}

function validationFailure<T>(
  message: string,
  validationErrors: readonly (
    | SocialPublicationLedgerPersistenceError
    | SocialPublicationLedgerRowError
  )[],
): SocialPublicationLedgerStoreResult<T> {
  return {
    ok: false,
    error: storeError("validation_failed", message, validationErrors),
  };
}

function storageFailure<T>(
  error: unknown,
  fallbackMessage: string,
): SocialPublicationLedgerStoreResult<T> {
  return {
    ok: false,
    error: storeError(
      "storage_error",
      error instanceof Error ? error.message : fallbackMessage,
    ),
  };
}

function storeError(
  code: SocialPublicationLedgerStoreErrorCode,
  message: string,
  validationErrors?: readonly (
    | SocialPublicationLedgerPersistenceError
    | SocialPublicationLedgerRowError
  )[],
): SocialPublicationLedgerStoreError {
  return { code, message, validationErrors };
}

function sortAttemptRows(
  rows: readonly SocialPublicationLedgerAttemptRow[],
): SocialPublicationLedgerAttemptRow[] {
  return [...rows].sort(
    (left, right) =>
      left.attempt_sequence - right.attempt_sequence ||
      left.recorded_at.localeCompare(right.recorded_at) ||
      left.ledger_entry_id.localeCompare(right.ledger_entry_id),
  );
}

function sortOutcomeRows(
  rows: readonly SocialPublicationLedgerOutcomeRow[],
): SocialPublicationLedgerOutcomeRow[] {
  return [...rows].sort(
    (left, right) =>
      left.attempt_sequence - right.attempt_sequence ||
      left.recorded_at.localeCompare(right.recorded_at) ||
      left.outcome_id.localeCompare(right.outcome_id),
  );
}

function sortEvidenceRows(
  rows: readonly SocialPublicationLedgerEvidenceRow[],
): SocialPublicationLedgerEvidenceRow[] {
  return [...rows].sort(
    (left, right) =>
      left.recorded_at.localeCompare(right.recorded_at) ||
      left.evidence_id.localeCompare(right.evidence_id),
  );
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
