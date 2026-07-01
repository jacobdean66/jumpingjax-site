import { createServiceRoleClient } from "../supabase/admin";

import {
  mapSocialPublicationSchedulerScheduleRecordToRow,
  mapSocialPublicationSchedulerScheduleRowToRecord,
  validateSocialPublicationSchedulerScheduleRow,
  type SocialPublicationSchedulerRowError,
  type SocialPublicationSchedulerScheduleRow,
} from "./social-publication-scheduler-rows";
import {
  validateSocialPublicationSchedulerScheduleRecord,
  type SocialPublicationSchedulerPersistenceError,
  type SocialPublicationSchedulerScheduleRecord,
} from "./social-publication-scheduler-repository";

export const SOCIAL_PUBLICATION_SCHEDULER_STORE_ERROR_CODES = [
  "validation_failed",
  "duplicate_identity",
  "duplicate_idempotency_key",
  "parent_missing",
  "scope_mismatch",
  "ordering_invalid",
  "storage_error",
  "storage_inconsistent",
] as const;

export type SocialPublicationSchedulerStoreErrorCode =
  (typeof SOCIAL_PUBLICATION_SCHEDULER_STORE_ERROR_CODES)[number];

export type SocialPublicationSchedulerStoreError = Readonly<{
  code: SocialPublicationSchedulerStoreErrorCode;
  message: string;
  validationErrors?: readonly (
    | SocialPublicationSchedulerPersistenceError
    | SocialPublicationSchedulerRowError
  )[];
}>;

export type SocialPublicationSchedulerStoreResult<T> = Readonly<
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: SocialPublicationSchedulerStoreError;
    }
>;

export type SocialPublicationSchedulerStoreWriteOptions = Readonly<{
  idempotencyKey?: string | null;
}>;

export type SocialPublicationSchedulerReadFilter = Readonly<{
  scheduleId?: string;
  socialPostId?: string;
  publicationTargetId?: string;
  publicationManifestId?: string;
  state?: string;
}>;

export type SocialPublicationSchedulerStoreStorage = Readonly<{
  insertSchedule(
    row: SocialPublicationSchedulerScheduleRow,
  ): Promise<SocialPublicationSchedulerScheduleRow>;
  findScheduleByScheduleEntryId(
    scheduleEntryId: string,
  ): Promise<SocialPublicationSchedulerScheduleRow | null>;
  findScheduleByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialPublicationSchedulerScheduleRow | null>;
  findLatestScheduleByScheduleId(
    scheduleId: string,
  ): Promise<SocialPublicationSchedulerScheduleRow | null>;
  fetchSchedules(
    filter: SocialPublicationSchedulerReadFilter,
  ): Promise<SocialPublicationSchedulerScheduleRow[]>;
}>;

const SCHEDULE_SELECT =
  "schedule_entry_id, schedule_id, intent_type, state, social_post_id, publication_target_id, publication_manifest_id, owner_approval_id, approval_id, proposal_id, intended_publish_at, read_context, recorded_at, updated_at, recorded_by_actor, recorded_source, intent_only, immutable, grants_publishing_permission, approves_nothing, publishes_nothing, executes_nothing, schedules_intent_only, mutates_ledger, mutates_approval, mutates_manifest, mutates_targets, records_no_metrics, performs_no_learning, idempotency_key";

let testStorage: SocialPublicationSchedulerStoreStorage | null = null;

export function configureSocialPublicationSchedulerStoreTestDependencies(
  storage: SocialPublicationSchedulerStoreStorage | null,
): void {
  testStorage = storage;
}

export async function createSocialPublicationScheduleIntent(
  record: SocialPublicationSchedulerScheduleRecord,
  options: SocialPublicationSchedulerStoreWriteOptions = {},
): Promise<SocialPublicationSchedulerStoreResult<SocialPublicationSchedulerScheduleRecord>> {
  const recordValidation = validateSocialPublicationSchedulerScheduleRecord(record);
  if (!recordValidation.ok) {
    return validationFailure(
      "Publication schedule record failed validation.",
      recordValidation.errors,
    );
  }

  const rowResult = mapSocialPublicationSchedulerScheduleRecordToRow(record, {
    idempotency_key: options.idempotencyKey ?? null,
  });
  if (!rowResult.ok) {
    return validationFailure(
      "Publication schedule row failed validation.",
      rowResult.errors,
    );
  }

  try {
    const existing = await storage().findLatestScheduleByScheduleId(record.schedule_id);
    if (existing) {
      return {
        ok: false,
        error: storeError(
          "duplicate_identity",
          "Publication schedule identity already exists; use append instead of create.",
        ),
      };
    }

    const duplicate = await findScheduleDuplicate(rowResult.value);
    if (duplicate) return duplicate;

    return mapStoredScheduleRow(await storage().insertSchedule(rowResult.value), "create schedule");
  } catch (error) {
    return storageFailure(error, "Publication schedule create write failed.");
  }
}

export async function appendSocialPublicationScheduleIntent(
  record: SocialPublicationSchedulerScheduleRecord,
  options: SocialPublicationSchedulerStoreWriteOptions = {},
): Promise<SocialPublicationSchedulerStoreResult<SocialPublicationSchedulerScheduleRecord>> {
  const recordValidation = validateSocialPublicationSchedulerScheduleRecord(record);
  if (!recordValidation.ok) {
    return validationFailure(
      "Publication schedule record failed validation.",
      recordValidation.errors,
    );
  }

  const rowResult = mapSocialPublicationSchedulerScheduleRecordToRow(record, {
    idempotency_key: options.idempotencyKey ?? null,
  });
  if (!rowResult.ok) {
    return validationFailure(
      "Publication schedule row failed validation.",
      rowResult.errors,
    );
  }

  try {
    const parentError = await validateAppendParent(rowResult.value);
    if (parentError) return { ok: false, error: parentError };

    const duplicate = await findScheduleDuplicate(rowResult.value);
    if (duplicate) return duplicate;

    return mapStoredScheduleRow(await storage().insertSchedule(rowResult.value), "append schedule");
  } catch (error) {
    return storageFailure(error, "Publication schedule append write failed.");
  }
}

export async function fetchSocialPublicationScheduleRows(
  filter: SocialPublicationSchedulerReadFilter = {},
): Promise<SocialPublicationSchedulerStoreResult<readonly SocialPublicationSchedulerScheduleRow[]>> {
  try {
    return mapStoredScheduleRows(await storage().fetchSchedules(filter), "fetch schedules");
  } catch (error) {
    return storageFailure(error, "Publication schedule read failed.");
  }
}

export async function fetchSocialPublicationScheduleRecords(
  filter: SocialPublicationSchedulerReadFilter = {},
): Promise<SocialPublicationSchedulerStoreResult<readonly SocialPublicationSchedulerScheduleRecord[]>> {
  const rows = await fetchSocialPublicationScheduleRows(filter);
  if (!rows.ok) return rows;

  const records: SocialPublicationSchedulerScheduleRecord[] = [];
  for (const row of rows.value) {
    const mapped = mapSocialPublicationSchedulerScheduleRowToRecord(row);
    if (!mapped.ok) {
      return validationFailure(
        "Publication schedule row failed mapping during read.",
        mapped.errors,
      );
    }
    records.push(mapped.value);
  }

  return { ok: true, value: immutableClone(records) };
}

export function fetchSocialPublicationScheduleRowsByScheduleId(
  scheduleId: string,
): Promise<SocialPublicationSchedulerStoreResult<readonly SocialPublicationSchedulerScheduleRow[]>> {
  return fetchSocialPublicationScheduleRows({ scheduleId });
}

export function fetchSocialPublicationScheduleRowsByPost(
  socialPostId: string,
): Promise<SocialPublicationSchedulerStoreResult<readonly SocialPublicationSchedulerScheduleRow[]>> {
  return fetchSocialPublicationScheduleRows({ socialPostId });
}

export function fetchSocialPublicationScheduleRowsByPublicationTarget(
  publicationTargetId: string,
): Promise<SocialPublicationSchedulerStoreResult<readonly SocialPublicationSchedulerScheduleRow[]>> {
  return fetchSocialPublicationScheduleRows({ publicationTargetId });
}

export function fetchSocialPublicationScheduleRowsByManifest(
  publicationManifestId: string,
): Promise<SocialPublicationSchedulerStoreResult<readonly SocialPublicationSchedulerScheduleRow[]>> {
  return fetchSocialPublicationScheduleRows({ publicationManifestId });
}

export function fetchSocialPublicationScheduleRecordsByScheduleId(
  scheduleId: string,
): Promise<SocialPublicationSchedulerStoreResult<readonly SocialPublicationSchedulerScheduleRecord[]>> {
  return fetchSocialPublicationScheduleRecords({ scheduleId });
}

export function fetchSocialPublicationScheduleRecordsByPost(
  socialPostId: string,
): Promise<SocialPublicationSchedulerStoreResult<readonly SocialPublicationSchedulerScheduleRecord[]>> {
  return fetchSocialPublicationScheduleRecords({ socialPostId });
}

export function fetchSocialPublicationScheduleRecordsByPublicationTarget(
  publicationTargetId: string,
): Promise<SocialPublicationSchedulerStoreResult<readonly SocialPublicationSchedulerScheduleRecord[]>> {
  return fetchSocialPublicationScheduleRecords({ publicationTargetId });
}

export function fetchSocialPublicationScheduleRecordsByManifest(
  publicationManifestId: string,
): Promise<SocialPublicationSchedulerStoreResult<readonly SocialPublicationSchedulerScheduleRecord[]>> {
  return fetchSocialPublicationScheduleRecords({ publicationManifestId });
}

export async function fetchLatestSocialPublicationScheduleRecordByScheduleId(
  scheduleId: string,
): Promise<SocialPublicationSchedulerStoreResult<SocialPublicationSchedulerScheduleRecord | null>> {
  try {
    const row = await storage().findLatestScheduleByScheduleId(scheduleId);
    if (!row) return { ok: true, value: null };

    return mapStoredScheduleRow(row, "fetch latest schedule");
  } catch (error) {
    return storageFailure(error, "Publication schedule latest read failed.");
  }
}

function storage(): SocialPublicationSchedulerStoreStorage {
  if (testStorage) return testStorage;
  return createSupabaseSchedulerStoreStorage();
}

function createSupabaseSchedulerStoreStorage(): SocialPublicationSchedulerStoreStorage {
  const supabase = createServiceRoleClient();

  return {
    async insertSchedule(row) {
      const { data, error } = await supabase
        .from("social_publication_schedule_intents")
        .insert(row)
        .select(SCHEDULE_SELECT)
        .single<SocialPublicationSchedulerScheduleRow>();

      if (error) throw new Error(error.message);
      return data;
    },
    findScheduleByScheduleEntryId(scheduleEntryId) {
      return maybeSingleSchedule("schedule_entry_id", scheduleEntryId);
    },
    findScheduleByIdempotencyKey(idempotencyKey) {
      return maybeSingleSchedule("idempotency_key", idempotencyKey);
    },
    async findLatestScheduleByScheduleId(scheduleId) {
      const { data, error } = await supabase
        .from("social_publication_schedule_intents")
        .select(SCHEDULE_SELECT)
        .eq("schedule_id", scheduleId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle<SocialPublicationSchedulerScheduleRow>();

      if (error) throw new Error(error.message);
      return data;
    },
    fetchSchedules(filter) {
      return applyScheduleReadFilter(filter);
    },
  };

  async function maybeSingleSchedule(
    column: string,
    value: string,
  ): Promise<SocialPublicationSchedulerScheduleRow | null> {
    const { data, error } = await supabase
      .from("social_publication_schedule_intents")
      .select(SCHEDULE_SELECT)
      .eq(column, value)
      .maybeSingle<SocialPublicationSchedulerScheduleRow>();

    if (error) throw new Error(error.message);
    return data;
  }

  async function applyScheduleReadFilter(
    filter: SocialPublicationSchedulerReadFilter,
  ): Promise<SocialPublicationSchedulerScheduleRow[]> {
    let query = supabase.from("social_publication_schedule_intents").select(SCHEDULE_SELECT);
    if (filter.scheduleId) query = query.eq("schedule_id", filter.scheduleId);
    if (filter.socialPostId) query = query.eq("social_post_id", filter.socialPostId);
    if (filter.publicationTargetId) {
      query = query.eq("publication_target_id", filter.publicationTargetId);
    }
    if (filter.publicationManifestId) {
      query = query.eq("publication_manifest_id", filter.publicationManifestId);
    }
    if (filter.state) query = query.eq("state", filter.state);

    const { data, error } = await query
      .order("intended_publish_at", { ascending: true })
      .order("recorded_at", { ascending: true })
      .order("schedule_entry_id", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as SocialPublicationSchedulerScheduleRow[];
  }
}

async function findScheduleDuplicate(
  row: SocialPublicationSchedulerScheduleRow,
): Promise<SocialPublicationSchedulerStoreResult<never> | null> {
  if (await storage().findScheduleByScheduleEntryId(row.schedule_entry_id)) {
    return {
      ok: false,
      error: storeError(
        "duplicate_identity",
        "Publication schedule entry identity already exists.",
      ),
    };
  }
  if (
    row.idempotency_key &&
    (await storage().findScheduleByIdempotencyKey(row.idempotency_key))
  ) {
    return {
      ok: false,
      error: storeError(
        "duplicate_idempotency_key",
        "Publication schedule idempotency key already exists.",
      ),
    };
  }
  return null;
}

async function validateAppendParent(
  row: SocialPublicationSchedulerScheduleRow,
): Promise<SocialPublicationSchedulerStoreError | null> {
  const latest = await storage().findLatestScheduleByScheduleId(row.schedule_id);
  if (!latest) {
    return storeError(
      "parent_missing",
      "Publication schedule append requires an existing schedule identity.",
    );
  }

  if (!scheduleRowsShareScope(latest, row)) {
    return storeError(
      "scope_mismatch",
      "Publication schedule append scope must match the schedule's prior scope.",
    );
  }

  if (Date.parse(row.recorded_at) < Date.parse(latest.recorded_at)) {
    return storeError(
      "ordering_invalid",
      "Publication schedule append must not record before the latest known state.",
    );
  }

  return null;
}

function scheduleRowsShareScope(
  left: SocialPublicationSchedulerScheduleRow,
  right: SocialPublicationSchedulerScheduleRow,
): boolean {
  return (
    left.social_post_id === right.social_post_id &&
    left.publication_target_id === right.publication_target_id &&
    left.intent_type === right.intent_type
  );
}

function mapStoredScheduleRows(
  rows: readonly SocialPublicationSchedulerScheduleRow[],
  operation: string,
): SocialPublicationSchedulerStoreResult<readonly SocialPublicationSchedulerScheduleRow[]> {
  const mappedRows: SocialPublicationSchedulerScheduleRow[] = [];
  for (const row of rows) {
    const mapped = mapStoredScheduleRowToRow(row, operation);
    if (!mapped.ok) return mapped;
    mappedRows.push(mapped.value);
  }

  return { ok: true, value: immutableClone(sortScheduleRows(mappedRows)) };
}

function mapStoredScheduleRow(
  row: SocialPublicationSchedulerScheduleRow,
  operation: string,
): SocialPublicationSchedulerStoreResult<SocialPublicationSchedulerScheduleRecord> {
  const rowResult = mapStoredScheduleRowToRow(row, operation);
  if (!rowResult.ok) return rowResult;

  const record = mapSocialPublicationSchedulerScheduleRowToRecord(rowResult.value);
  if (!record.ok) {
    return validationFailure(
      `Publication schedule row failed mapping during ${operation}.`,
      record.errors,
    );
  }

  return { ok: true, value: record.value };
}

function mapStoredScheduleRowToRow(
  row: SocialPublicationSchedulerScheduleRow,
  operation: string,
): SocialPublicationSchedulerStoreResult<SocialPublicationSchedulerScheduleRow> {
  const validation = validateSocialPublicationSchedulerScheduleRow(row);
  if (!validation.ok) {
    return validationFailure(
      `Publication schedule row failed validation during ${operation}.`,
      validation.errors,
    );
  }

  return { ok: true, value: immutableClone(row) };
}

function sortScheduleRows(
  rows: readonly SocialPublicationSchedulerScheduleRow[],
): SocialPublicationSchedulerScheduleRow[] {
  return [...rows].sort(
    (left, right) =>
      Date.parse(left.intended_publish_at) - Date.parse(right.intended_publish_at) ||
      left.recorded_at.localeCompare(right.recorded_at) ||
      left.schedule_entry_id.localeCompare(right.schedule_entry_id),
  );
}

function validationFailure<T>(
  message: string,
  validationErrors: readonly (
    | SocialPublicationSchedulerPersistenceError
    | SocialPublicationSchedulerRowError
  )[],
): SocialPublicationSchedulerStoreResult<T> {
  return {
    ok: false,
    error: storeError("validation_failed", message, validationErrors),
  };
}

function storageFailure<T>(
  error: unknown,
  fallbackMessage: string,
): SocialPublicationSchedulerStoreResult<T> {
  return {
    ok: false,
    error: storeError(
      "storage_error",
      error instanceof Error ? error.message : fallbackMessage,
    ),
  };
}

function storeError(
  code: SocialPublicationSchedulerStoreErrorCode,
  message: string,
  validationErrors?: readonly (
    | SocialPublicationSchedulerPersistenceError
    | SocialPublicationSchedulerRowError
  )[],
): SocialPublicationSchedulerStoreError {
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
