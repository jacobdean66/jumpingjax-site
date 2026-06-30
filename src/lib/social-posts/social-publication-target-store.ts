import { createServiceRoleClient } from "../supabase/admin";

import {
  mapSocialPublicationTargetRowToDefinition,
  validateSocialPublicationTargetRow,
  type PublicationTargetJsonObject,
  type SocialPublicationTargetRow,
  type PublicationTargetPersistenceError,
} from "./social-publication-target-persistence";
import {
  validatePublicationTargetDefinition,
  type PublicationTargetDefinition,
} from "./social-publication-targets";

export const PUBLICATION_TARGET_REPOSITORY_ERROR_CODES = [
  "validation_failed",
  "not_found",
  "storage_error",
] as const;

export type PublicationTargetRepositoryErrorCode =
  (typeof PUBLICATION_TARGET_REPOSITORY_ERROR_CODES)[number];

export type PublicationTargetRepositoryError = Readonly<{
  code: PublicationTargetRepositoryErrorCode;
  message: string;
  validationErrors?: readonly PublicationTargetPersistenceError[];
}>;

export type PublicationTargetRepositoryResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: PublicationTargetRepositoryError }>;

type PublicationTargetStoreStorage = {
  insertTarget(row: SocialPublicationTargetRow): Promise<SocialPublicationTargetRow>;
  updateTarget(row: SocialPublicationTargetRow): Promise<SocialPublicationTargetRow | null>;
  getTargetById(targetId: string): Promise<SocialPublicationTargetRow | null>;
  listTargets(): Promise<SocialPublicationTargetRow[]>;
  listEnabledTargets(): Promise<SocialPublicationTargetRow[]>;
};

const TARGET_SELECT =
  "publication_target_id, platform, target_type, display_name, external_target_id, owner_managed, enabled, capabilities, media_constraints, copy_constraints, metadata, created_at, updated_at";

let testStorage: PublicationTargetStoreStorage | null = null;

export function configurePublicationTargetStoreTestDependencies(
  storage: PublicationTargetStoreStorage | null,
): void {
  testStorage = storage;
}

export async function createPublicationTarget(
  target: PublicationTargetDefinition,
): Promise<PublicationTargetRepositoryResult<PublicationTargetDefinition>> {
  const row = definitionToRow(target);
  const validationError = validateDefinitionAndRowForWrite(target, row);
  if (validationError) return { ok: false, error: validationError };

  try {
    return mapStoredRow(await storage().insertTarget(row), "create");
  } catch (error) {
    return storageFailure(error, "Publication target create failed.");
  }
}

export async function updatePublicationTarget(
  target: PublicationTargetDefinition,
): Promise<PublicationTargetRepositoryResult<PublicationTargetDefinition>> {
  const row = definitionToRow(target);
  const validationError = validateDefinitionAndRowForWrite(target, row);
  if (validationError) return { ok: false, error: validationError };

  try {
    const storedRow = await storage().updateTarget(row);
    if (!storedRow) {
      return {
        ok: false,
        error: repositoryError("not_found", "Publication target not found."),
      };
    }

    return mapStoredRow(storedRow, "update");
  } catch (error) {
    return storageFailure(error, "Publication target update failed.");
  }
}

export async function getPublicationTargetById(
  targetId: string,
): Promise<PublicationTargetRepositoryResult<PublicationTargetDefinition>> {
  try {
    const row = await storage().getTargetById(targetId);
    if (!row) {
      return {
        ok: false,
        error: repositoryError("not_found", "Publication target not found."),
      };
    }

    return mapStoredRow(row, "get");
  } catch (error) {
    return storageFailure(error, "Publication target read failed.");
  }
}

export async function listPublicationTargets(): Promise<
  PublicationTargetRepositoryResult<PublicationTargetDefinition[]>
> {
  try {
    return mapStoredRows(await storage().listTargets(), "list");
  } catch (error) {
    return storageFailure(error, "Publication target list failed.");
  }
}

export async function listEnabledPublicationTargets(): Promise<
  PublicationTargetRepositoryResult<PublicationTargetDefinition[]>
> {
  try {
    return mapStoredRows(await storage().listEnabledTargets(), "listEnabled");
  } catch (error) {
    return storageFailure(error, "Enabled publication target list failed.");
  }
}

function storage(): PublicationTargetStoreStorage {
  if (testStorage) return testStorage;
  return createSupabasePublicationTargetStorage();
}

function createSupabasePublicationTargetStorage(): PublicationTargetStoreStorage {
  const supabase = createServiceRoleClient();

  return {
    async insertTarget(row) {
      const { data, error } = await supabase
        .from("social_publication_targets")
        .insert(row)
        .select(TARGET_SELECT)
        .single<SocialPublicationTargetRow>();

      if (error) throw new Error(error.message);
      return data;
    },
    async updateTarget(row) {
      const { data, error } = await supabase
        .from("social_publication_targets")
        .update(row)
        .eq("publication_target_id", row.publication_target_id)
        .select(TARGET_SELECT)
        .maybeSingle<SocialPublicationTargetRow>();

      if (error) throw new Error(error.message);
      return data;
    },
    async getTargetById(targetId) {
      const { data, error } = await supabase
        .from("social_publication_targets")
        .select(TARGET_SELECT)
        .eq("publication_target_id", targetId)
        .maybeSingle<SocialPublicationTargetRow>();

      if (error) throw new Error(error.message);
      return data;
    },
    async listTargets() {
      const { data, error } = await supabase
        .from("social_publication_targets")
        .select(TARGET_SELECT)
        .order("platform", { ascending: true })
        .order("display_name", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as SocialPublicationTargetRow[];
    },
    async listEnabledTargets() {
      const { data, error } = await supabase
        .from("social_publication_targets")
        .select(TARGET_SELECT)
        .eq("enabled", true)
        .order("platform", { ascending: true })
        .order("display_name", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as SocialPublicationTargetRow[];
    },
  };
}

function validateDefinitionAndRowForWrite(
  target: PublicationTargetDefinition,
  row: SocialPublicationTargetRow,
): PublicationTargetRepositoryError | null {
  const definitionValidation = validatePublicationTargetDefinition(target);
  if (!definitionValidation.ok) {
    return repositoryError(
      "validation_failed",
      "Publication target definition failed validation.",
      definitionValidation.errors.map((error) => ({
        code: "domain_validation_failed" as const,
        path: error.path,
        message: error.message,
      })),
    );
  }

  const rowValidation = validateSocialPublicationTargetRow(row);
  if (!rowValidation.ok) {
    return repositoryError(
      "validation_failed",
      "Publication target row failed validation.",
      rowValidation.errors,
    );
  }

  return null;
}

function mapStoredRows(
  rows: readonly SocialPublicationTargetRow[],
  operation: string,
): PublicationTargetRepositoryResult<PublicationTargetDefinition[]> {
  const targets: PublicationTargetDefinition[] = [];

  for (const row of rows) {
    const mapped = mapStoredRow(row, operation);
    if ("error" in mapped) {
      return {
        ok: false,
        error: mapped.error,
      };
    }

    targets.push(mapped.value);
  }

  return { ok: true, value: targets };
}

function mapStoredRow(
  row: SocialPublicationTargetRow,
  operation: string,
): PublicationTargetRepositoryResult<PublicationTargetDefinition> {
  const validation = validateSocialPublicationTargetRow(row);
  if (!validation.ok) {
    return {
      ok: false,
      error: repositoryError(
        "validation_failed",
        `Publication target row failed validation during ${operation}.`,
        validation.errors,
      ),
    };
  }

  return {
    ok: true,
    value: mapSocialPublicationTargetRowToDefinition(row),
  };
}

function definitionToRow(
  target: PublicationTargetDefinition,
): SocialPublicationTargetRow {
  return {
    publication_target_id: target.targetId,
    platform: target.platform,
    target_type: target.targetType,
    display_name: target.displayName,
    external_target_id: target.externalId,
    owner_managed: target.ownerManaged,
    enabled: target.enabled,
    capabilities: target.capabilities.capabilityKinds,
    media_constraints: target.capabilities.mediaConstraints as PublicationTargetJsonObject,
    copy_constraints: target.capabilities.copyConstraints as PublicationTargetJsonObject,
    metadata: target.metadata as PublicationTargetJsonObject,
    created_at: target.createdAt ?? new Date(0).toISOString(),
    updated_at: target.updatedAt ?? new Date(0).toISOString(),
  };
}

function repositoryError(
  code: PublicationTargetRepositoryErrorCode,
  message: string,
  validationErrors?: readonly PublicationTargetPersistenceError[],
): PublicationTargetRepositoryError {
  return { code, message, validationErrors };
}

function storageFailure<T>(
  error: unknown,
  fallbackMessage: string,
): PublicationTargetRepositoryResult<T> {
  return {
    ok: false,
    error: repositoryError(
      "storage_error",
      error instanceof Error ? error.message : fallbackMessage,
    ),
  };
}
