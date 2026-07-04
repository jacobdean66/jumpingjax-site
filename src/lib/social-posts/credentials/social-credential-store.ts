import { createServiceRoleClient, isSupabaseServiceConfigured } from "../../supabase/admin";

import {
  validateSocialCredentialAuditEventRecord,
  validateSocialCredentialKeyVersionRecord,
  validateSocialCredentialLifecycleStateRecord,
  validateSocialCredentialPersistenceModel,
  validateSocialCredentialProviderAccountRecord,
  validateSocialCredentialVaultRecordRow,
  type SocialCredentialAuditEventRecord,
  type SocialCredentialKeyVersionRecord,
  type SocialCredentialLifecycleStateRecord,
  type SocialCredentialPersistenceError,
  type SocialCredentialPersistenceModel,
  type SocialCredentialProviderAccountRecord,
  type SocialCredentialVaultRecordRow,
} from "./social-credential-repository";

export const SOCIAL_CREDENTIAL_STORE_ERROR_CODES = [
  "validation_failed",
  "duplicate_identity",
  "not_found",
  "storage_error",
  "storage_inconsistent",
] as const;

export type SocialCredentialStoreErrorCode =
  (typeof SOCIAL_CREDENTIAL_STORE_ERROR_CODES)[number];

export type SocialCredentialStoreError = Readonly<{
  code: SocialCredentialStoreErrorCode;
  message: string;
  validationErrors?: readonly SocialCredentialPersistenceError[];
}>;

export type SocialCredentialStoreResult<T> = Readonly<
  | { ok: true; value: T }
  | { ok: false; error: SocialCredentialStoreError }
>;

export type SocialCredentialStoreStorage = Readonly<{
  loadSnapshot(): Promise<SocialCredentialPersistenceModel>;
  insertProviderAccount(
    record: SocialCredentialProviderAccountRecord,
  ): Promise<SocialCredentialProviderAccountRecord>;
  updateProviderAccount(
    record: SocialCredentialProviderAccountRecord,
  ): Promise<SocialCredentialProviderAccountRecord>;
  deleteProviderAccount(
    providerAccountId: string,
  ): Promise<SocialCredentialProviderAccountRecord>;
  insertVaultRecord(
    record: SocialCredentialVaultRecordRow,
  ): Promise<SocialCredentialVaultRecordRow>;
  updateVaultRecord(
    record: SocialCredentialVaultRecordRow,
  ): Promise<SocialCredentialVaultRecordRow>;
  deleteVaultRecord(vaultRecordId: string): Promise<SocialCredentialVaultRecordRow>;
  insertLifecycleState(
    record: SocialCredentialLifecycleStateRecord,
  ): Promise<SocialCredentialLifecycleStateRecord>;
  updateLifecycleState(
    record: SocialCredentialLifecycleStateRecord,
  ): Promise<SocialCredentialLifecycleStateRecord>;
  deleteLifecycleState(
    lifecycleStateId: string,
  ): Promise<SocialCredentialLifecycleStateRecord>;
  insertAuditEvent(
    record: SocialCredentialAuditEventRecord,
  ): Promise<SocialCredentialAuditEventRecord>;
  insertKeyVersion(
    record: SocialCredentialKeyVersionRecord,
  ): Promise<SocialCredentialKeyVersionRecord>;
  updateKeyVersion(
    record: SocialCredentialKeyVersionRecord,
  ): Promise<SocialCredentialKeyVersionRecord>;
  deleteKeyVersion(keyVersion: string): Promise<SocialCredentialKeyVersionRecord>;
}>;

const PROVIDER_ACCOUNT_SELECT =
  "provider_account_id, provider, publication_target_id, external_account_id_redacted, display_name_redacted, status, account_ref_id, created_at, references_only, contains_credentials, grants_execution_permission, executes_nothing, publishes_nothing";

const VAULT_RECORD_SELECT =
  "vault_record_id, credential_ref_id, provider, credential_kind, account_ref_id, provider_account_id, publication_target_id, encrypted_payload_ref, key_version, lifecycle_phase, superseded_at, revoked_at, created_at, metadata_only, contains_plaintext, contains_ciphertext, grants_execution_permission, executes_nothing, publishes_nothing";

const LIFECYCLE_STATE_SELECT =
  "lifecycle_state_id, credential_ref_id, account_ref_id, provider, authorization_state, lifecycle_phase, issued_at, expires_at, last_rotated_at, revoked_at, scope_fingerprint_redacted, created_at, modeled_only, references_only, contains_credentials, grants_execution_permission, executes_nothing, publishes_nothing";

const AUDIT_EVENT_SELECT =
  "audit_event_id, credential_ref_id, actor_admin_id, action, outcome, sanitized_detail, created_at, append_only, contains_secrets, grants_execution_permission, executes_nothing, publishes_nothing";

const KEY_VERSION_SELECT =
  "key_version, status, activated_at, retired_at, metadata_only, contains_key_material, grants_execution_permission, executes_nothing, publishes_nothing";

let testStorage: SocialCredentialStoreStorage | null = null;

export function configureSocialCredentialStoreTestDependencies(
  storage: SocialCredentialStoreStorage | null,
): void {
  testStorage = storage;
}

export function isSocialCredentialStoreConfigured(): boolean {
  return isSupabaseServiceConfigured();
}

export async function loadSocialCredentialSnapshot(): Promise<
  SocialCredentialStoreResult<SocialCredentialPersistenceModel>
> {
  try {
    return mapSnapshot(await storage().loadSnapshot(), "load snapshot");
  } catch (error) {
    return storageFailure(error, "Credential snapshot read failed.");
  }
}

export async function createSocialCredentialProviderAccount(
  record: SocialCredentialProviderAccountRecord,
): Promise<SocialCredentialStoreResult<SocialCredentialProviderAccountRecord>> {
  const validation = validateRecord(
    validateSocialCredentialProviderAccountRecord(record),
    "Provider account record failed validation.",
  );
  if (!validation.ok) return validation;

  const snapshot = await loadSocialCredentialSnapshot();
  if (!snapshot.ok) return snapshot;
  if (
    snapshot.value.provider_accounts.some(
      (current) => current.provider_account_id === record.provider_account_id,
    )
  ) {
    return duplicateIdentity("Provider account identity already exists.");
  }

  try {
    return mapProviderAccount(
      await storage().insertProviderAccount(record),
      "create provider account",
    );
  } catch (error) {
    return storageFailure(error, "Credential provider account write failed.");
  }
}

export async function updateSocialCredentialProviderAccount(
  record: SocialCredentialProviderAccountRecord,
): Promise<SocialCredentialStoreResult<SocialCredentialProviderAccountRecord>> {
  const validation = validateRecord(
    validateSocialCredentialProviderAccountRecord(record),
    "Provider account record failed validation.",
  );
  if (!validation.ok) return validation;

  const snapshot = await loadSocialCredentialSnapshot();
  if (!snapshot.ok) return snapshot;
  if (
    !snapshot.value.provider_accounts.some(
      (current) => current.provider_account_id === record.provider_account_id,
    )
  ) {
    return notFound("Provider account identity was not found.");
  }

  try {
    return mapProviderAccount(
      await storage().updateProviderAccount(record),
      "update provider account",
    );
  } catch (error) {
    return storageFailure(error, "Credential provider account update failed.");
  }
}

export async function deleteSocialCredentialProviderAccount(
  providerAccountId: string,
): Promise<SocialCredentialStoreResult<SocialCredentialProviderAccountRecord>> {
  const snapshot = await loadSocialCredentialSnapshot();
  if (!snapshot.ok) return snapshot;
  if (
    !snapshot.value.provider_accounts.some(
      (current) => current.provider_account_id === providerAccountId,
    )
  ) {
    return notFound("Provider account identity was not found.");
  }

  try {
    return mapProviderAccount(
      await storage().deleteProviderAccount(providerAccountId),
      "delete provider account",
    );
  } catch (error) {
    return storageFailure(error, "Credential provider account delete failed.");
  }
}

export async function createSocialCredentialVaultRecord(
  record: SocialCredentialVaultRecordRow,
): Promise<SocialCredentialStoreResult<SocialCredentialVaultRecordRow>> {
  const validation = validateRecord(
    validateSocialCredentialVaultRecordRow(record),
    "Vault record metadata failed validation.",
  );
  if (!validation.ok) return validation;

  const snapshot = await loadSocialCredentialSnapshot();
  if (!snapshot.ok) return snapshot;
  if (
    snapshot.value.vault_records.some(
      (current) => current.vault_record_id === record.vault_record_id,
    )
  ) {
    return duplicateIdentity("Vault record identity already exists.");
  }

  try {
    return mapVaultRecord(
      await storage().insertVaultRecord(record),
      "create vault record",
    );
  } catch (error) {
    return storageFailure(error, "Credential vault record write failed.");
  }
}

export async function updateSocialCredentialVaultRecord(
  record: SocialCredentialVaultRecordRow,
): Promise<SocialCredentialStoreResult<SocialCredentialVaultRecordRow>> {
  const validation = validateRecord(
    validateSocialCredentialVaultRecordRow(record),
    "Vault record metadata failed validation.",
  );
  if (!validation.ok) return validation;

  const snapshot = await loadSocialCredentialSnapshot();
  if (!snapshot.ok) return snapshot;
  if (
    !snapshot.value.vault_records.some(
      (current) => current.vault_record_id === record.vault_record_id,
    )
  ) {
    return notFound("Vault record identity was not found.");
  }

  try {
    return mapVaultRecord(
      await storage().updateVaultRecord(record),
      "update vault record",
    );
  } catch (error) {
    return storageFailure(error, "Credential vault record update failed.");
  }
}

export async function deleteSocialCredentialVaultRecord(
  vaultRecordId: string,
): Promise<SocialCredentialStoreResult<SocialCredentialVaultRecordRow>> {
  const snapshot = await loadSocialCredentialSnapshot();
  if (!snapshot.ok) return snapshot;
  if (
    !snapshot.value.vault_records.some(
      (current) => current.vault_record_id === vaultRecordId,
    )
  ) {
    return notFound("Vault record identity was not found.");
  }

  try {
    return mapVaultRecord(
      await storage().deleteVaultRecord(vaultRecordId),
      "delete vault record",
    );
  } catch (error) {
    return storageFailure(error, "Credential vault record delete failed.");
  }
}

export async function createSocialCredentialLifecycleState(
  record: SocialCredentialLifecycleStateRecord,
): Promise<SocialCredentialStoreResult<SocialCredentialLifecycleStateRecord>> {
  const validation = validateRecord(
    validateSocialCredentialLifecycleStateRecord(record),
    "Lifecycle state record failed validation.",
  );
  if (!validation.ok) return validation;

  const snapshot = await loadSocialCredentialSnapshot();
  if (!snapshot.ok) return snapshot;
  if (
    snapshot.value.lifecycle_states.some(
      (current) => current.lifecycle_state_id === record.lifecycle_state_id,
    )
  ) {
    return duplicateIdentity("Lifecycle state identity already exists.");
  }

  try {
    return mapLifecycleState(
      await storage().insertLifecycleState(record),
      "create lifecycle state",
    );
  } catch (error) {
    return storageFailure(error, "Credential lifecycle state write failed.");
  }
}

export async function updateSocialCredentialLifecycleState(
  record: SocialCredentialLifecycleStateRecord,
): Promise<SocialCredentialStoreResult<SocialCredentialLifecycleStateRecord>> {
  const validation = validateRecord(
    validateSocialCredentialLifecycleStateRecord(record),
    "Lifecycle state record failed validation.",
  );
  if (!validation.ok) return validation;

  const snapshot = await loadSocialCredentialSnapshot();
  if (!snapshot.ok) return snapshot;
  if (
    !snapshot.value.lifecycle_states.some(
      (current) => current.lifecycle_state_id === record.lifecycle_state_id,
    )
  ) {
    return notFound("Lifecycle state identity was not found.");
  }

  try {
    return mapLifecycleState(
      await storage().updateLifecycleState(record),
      "update lifecycle state",
    );
  } catch (error) {
    return storageFailure(error, "Credential lifecycle state update failed.");
  }
}

export async function deleteSocialCredentialLifecycleState(
  lifecycleStateId: string,
): Promise<SocialCredentialStoreResult<SocialCredentialLifecycleStateRecord>> {
  const snapshot = await loadSocialCredentialSnapshot();
  if (!snapshot.ok) return snapshot;
  if (
    !snapshot.value.lifecycle_states.some(
      (current) => current.lifecycle_state_id === lifecycleStateId,
    )
  ) {
    return notFound("Lifecycle state identity was not found.");
  }

  try {
    return mapLifecycleState(
      await storage().deleteLifecycleState(lifecycleStateId),
      "delete lifecycle state",
    );
  } catch (error) {
    return storageFailure(error, "Credential lifecycle state delete failed.");
  }
}

export async function appendSocialCredentialAuditEvent(
  record: SocialCredentialAuditEventRecord,
): Promise<SocialCredentialStoreResult<SocialCredentialAuditEventRecord>> {
  const validation = validateRecord(
    validateSocialCredentialAuditEventRecord(record),
    "Audit event record failed validation.",
  );
  if (!validation.ok) return validation;

  const snapshot = await loadSocialCredentialSnapshot();
  if (!snapshot.ok) return snapshot;
  if (
    snapshot.value.audit_events.some(
      (current) => current.audit_event_id === record.audit_event_id,
    )
  ) {
    return duplicateIdentity("Audit event identity already exists.");
  }

  try {
    return mapAuditEvent(
      await storage().insertAuditEvent(record),
      "append audit event",
    );
  } catch (error) {
    return storageFailure(error, "Credential audit event write failed.");
  }
}

export async function createSocialCredentialKeyVersion(
  record: SocialCredentialKeyVersionRecord,
): Promise<SocialCredentialStoreResult<SocialCredentialKeyVersionRecord>> {
  const validation = validateRecord(
    validateSocialCredentialKeyVersionRecord(record),
    "Key version record failed validation.",
  );
  if (!validation.ok) return validation;

  const snapshot = await loadSocialCredentialSnapshot();
  if (!snapshot.ok) return snapshot;
  if (
    snapshot.value.key_versions.some(
      (current) => current.key_version === record.key_version,
    )
  ) {
    return duplicateIdentity("Key version identity already exists.");
  }

  try {
    return mapKeyVersion(
      await storage().insertKeyVersion(record),
      "create key version",
    );
  } catch (error) {
    return storageFailure(error, "Credential key version write failed.");
  }
}

export async function updateSocialCredentialKeyVersion(
  record: SocialCredentialKeyVersionRecord,
): Promise<SocialCredentialStoreResult<SocialCredentialKeyVersionRecord>> {
  const validation = validateRecord(
    validateSocialCredentialKeyVersionRecord(record),
    "Key version record failed validation.",
  );
  if (!validation.ok) return validation;

  const snapshot = await loadSocialCredentialSnapshot();
  if (!snapshot.ok) return snapshot;
  if (
    !snapshot.value.key_versions.some(
      (current) => current.key_version === record.key_version,
    )
  ) {
    return notFound("Key version identity was not found.");
  }

  try {
    return mapKeyVersion(
      await storage().updateKeyVersion(record),
      "update key version",
    );
  } catch (error) {
    return storageFailure(error, "Credential key version update failed.");
  }
}

export async function deleteSocialCredentialKeyVersion(
  keyVersion: string,
): Promise<SocialCredentialStoreResult<SocialCredentialKeyVersionRecord>> {
  const snapshot = await loadSocialCredentialSnapshot();
  if (!snapshot.ok) return snapshot;
  if (
    !snapshot.value.key_versions.some(
      (current) => current.key_version === keyVersion,
    )
  ) {
    return notFound("Key version identity was not found.");
  }

  try {
    return mapKeyVersion(
      await storage().deleteKeyVersion(keyVersion),
      "delete key version",
    );
  } catch (error) {
    return storageFailure(error, "Credential key version delete failed.");
  }
}

function storage(): SocialCredentialStoreStorage {
  if (testStorage) return testStorage;
  return createSupabaseCredentialStoreStorage();
}

function createSupabaseCredentialStoreStorage(): SocialCredentialStoreStorage {
  const supabase = createServiceRoleClient();

  return {
    async loadSnapshot() {
      const [
        providerAccounts,
        vaultRecords,
        lifecycleStates,
        auditEvents,
        keyVersions,
      ] = await Promise.all([
        selectProviderAccounts(),
        selectVaultRecords(),
        selectLifecycleStates(),
        selectAuditEvents(),
        selectKeyVersions(),
      ]);

      return {
        provider_accounts: providerAccounts,
        vault_records: vaultRecords,
        lifecycle_states: lifecycleStates,
        audit_events: auditEvents,
        key_versions: keyVersions,
      };
    },
    async insertProviderAccount(record) {
      const { data, error } = await supabase
        .from("social_credential_provider_accounts")
        .insert(record)
        .select(PROVIDER_ACCOUNT_SELECT)
        .single<SocialCredentialProviderAccountRecord>();
      if (error) throw new Error(error.message);
      return data;
    },
    async updateProviderAccount(record) {
      const { data, error } = await supabase
        .from("social_credential_provider_accounts")
        .update(record)
        .eq("provider_account_id", record.provider_account_id)
        .select(PROVIDER_ACCOUNT_SELECT)
        .single<SocialCredentialProviderAccountRecord>();
      if (error) throw new Error(error.message);
      return data;
    },
    async deleteProviderAccount(providerAccountId) {
      const { data, error } = await supabase
        .from("social_credential_provider_accounts")
        .delete()
        .eq("provider_account_id", providerAccountId)
        .select(PROVIDER_ACCOUNT_SELECT)
        .single<SocialCredentialProviderAccountRecord>();
      if (error) throw new Error(error.message);
      return data;
    },
    async insertVaultRecord(record) {
      const { data, error } = await supabase
        .from("social_credential_vault_records")
        .insert(record)
        .select(VAULT_RECORD_SELECT)
        .single<SocialCredentialVaultRecordRow>();
      if (error) throw new Error(error.message);
      return data;
    },
    async updateVaultRecord(record) {
      const { data, error } = await supabase
        .from("social_credential_vault_records")
        .update(record)
        .eq("vault_record_id", record.vault_record_id)
        .select(VAULT_RECORD_SELECT)
        .single<SocialCredentialVaultRecordRow>();
      if (error) throw new Error(error.message);
      return data;
    },
    async deleteVaultRecord(vaultRecordId) {
      const { data, error } = await supabase
        .from("social_credential_vault_records")
        .delete()
        .eq("vault_record_id", vaultRecordId)
        .select(VAULT_RECORD_SELECT)
        .single<SocialCredentialVaultRecordRow>();
      if (error) throw new Error(error.message);
      return data;
    },
    async insertLifecycleState(record) {
      const { data, error } = await supabase
        .from("social_credential_lifecycle_states")
        .insert(record)
        .select(LIFECYCLE_STATE_SELECT)
        .single<SocialCredentialLifecycleStateRecord>();
      if (error) throw new Error(error.message);
      return data;
    },
    async updateLifecycleState(record) {
      const { data, error } = await supabase
        .from("social_credential_lifecycle_states")
        .update(record)
        .eq("lifecycle_state_id", record.lifecycle_state_id)
        .select(LIFECYCLE_STATE_SELECT)
        .single<SocialCredentialLifecycleStateRecord>();
      if (error) throw new Error(error.message);
      return data;
    },
    async deleteLifecycleState(lifecycleStateId) {
      const { data, error } = await supabase
        .from("social_credential_lifecycle_states")
        .delete()
        .eq("lifecycle_state_id", lifecycleStateId)
        .select(LIFECYCLE_STATE_SELECT)
        .single<SocialCredentialLifecycleStateRecord>();
      if (error) throw new Error(error.message);
      return data;
    },
    async insertAuditEvent(record) {
      const { data, error } = await supabase
        .from("social_credential_audit_events")
        .insert(record)
        .select(AUDIT_EVENT_SELECT)
        .single<SocialCredentialAuditEventRecord>();
      if (error) throw new Error(error.message);
      return data;
    },
    async insertKeyVersion(record) {
      const { data, error } = await supabase
        .from("social_credential_key_versions")
        .insert(record)
        .select(KEY_VERSION_SELECT)
        .single<SocialCredentialKeyVersionRecord>();
      if (error) throw new Error(error.message);
      return data;
    },
    async updateKeyVersion(record) {
      const { data, error } = await supabase
        .from("social_credential_key_versions")
        .update(record)
        .eq("key_version", record.key_version)
        .select(KEY_VERSION_SELECT)
        .single<SocialCredentialKeyVersionRecord>();
      if (error) throw new Error(error.message);
      return data;
    },
    async deleteKeyVersion(keyVersion) {
      const { data, error } = await supabase
        .from("social_credential_key_versions")
        .delete()
        .eq("key_version", keyVersion)
        .select(KEY_VERSION_SELECT)
        .single<SocialCredentialKeyVersionRecord>();
      if (error) throw new Error(error.message);
      return data;
    },
  };

  async function selectProviderAccounts(): Promise<SocialCredentialProviderAccountRecord[]> {
    const { data, error } = await supabase
      .from("social_credential_provider_accounts")
      .select(PROVIDER_ACCOUNT_SELECT)
      .order("created_at", { ascending: true })
      .order("provider_account_id", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as SocialCredentialProviderAccountRecord[];
  }

  async function selectVaultRecords(): Promise<SocialCredentialVaultRecordRow[]> {
    const { data, error } = await supabase
      .from("social_credential_vault_records")
      .select(VAULT_RECORD_SELECT)
      .order("created_at", { ascending: true })
      .order("vault_record_id", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as SocialCredentialVaultRecordRow[];
  }

  async function selectLifecycleStates(): Promise<SocialCredentialLifecycleStateRecord[]> {
    const { data, error } = await supabase
      .from("social_credential_lifecycle_states")
      .select(LIFECYCLE_STATE_SELECT)
      .order("created_at", { ascending: true })
      .order("lifecycle_state_id", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as SocialCredentialLifecycleStateRecord[];
  }

  async function selectAuditEvents(): Promise<SocialCredentialAuditEventRecord[]> {
    const { data, error } = await supabase
      .from("social_credential_audit_events")
      .select(AUDIT_EVENT_SELECT)
      .order("created_at", { ascending: true })
      .order("audit_event_id", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as SocialCredentialAuditEventRecord[];
  }

  async function selectKeyVersions(): Promise<SocialCredentialKeyVersionRecord[]> {
    const { data, error } = await supabase
      .from("social_credential_key_versions")
      .select(KEY_VERSION_SELECT)
      .order("activated_at", { ascending: true })
      .order("key_version", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as SocialCredentialKeyVersionRecord[];
  }
}

function mapSnapshot(
  snapshot: SocialCredentialPersistenceModel,
  operation: string,
): SocialCredentialStoreResult<SocialCredentialPersistenceModel> {
  const sorted = sortSnapshot(snapshot);
  const validation = validateSocialCredentialPersistenceModel(sorted);
  if (!validation.ok) {
    return validationFailure(
      `Credential snapshot failed validation during ${operation}.`,
      validation.errors,
    );
  }
  return { ok: true, value: immutableClone(sorted) };
}

function mapProviderAccount(
  record: SocialCredentialProviderAccountRecord,
  operation: string,
): SocialCredentialStoreResult<SocialCredentialProviderAccountRecord> {
  const validation = validateSocialCredentialProviderAccountRecord(record);
  if (!validation.ok) {
    return inconsistentFailure(
      `Credential provider account failed validation during ${operation}.`,
      validation.errors,
    );
  }
  return { ok: true, value: immutableClone(record) };
}

function mapVaultRecord(
  record: SocialCredentialVaultRecordRow,
  operation: string,
): SocialCredentialStoreResult<SocialCredentialVaultRecordRow> {
  const validation = validateSocialCredentialVaultRecordRow(record);
  if (!validation.ok) {
    return inconsistentFailure(
      `Credential vault record failed validation during ${operation}.`,
      validation.errors,
    );
  }
  return { ok: true, value: immutableClone(record) };
}

function mapLifecycleState(
  record: SocialCredentialLifecycleStateRecord,
  operation: string,
): SocialCredentialStoreResult<SocialCredentialLifecycleStateRecord> {
  const validation = validateSocialCredentialLifecycleStateRecord(record);
  if (!validation.ok) {
    return inconsistentFailure(
      `Credential lifecycle state failed validation during ${operation}.`,
      validation.errors,
    );
  }
  return { ok: true, value: immutableClone(record) };
}

function mapAuditEvent(
  record: SocialCredentialAuditEventRecord,
  operation: string,
): SocialCredentialStoreResult<SocialCredentialAuditEventRecord> {
  const validation = validateSocialCredentialAuditEventRecord(record);
  if (!validation.ok) {
    return inconsistentFailure(
      `Credential audit event failed validation during ${operation}.`,
      validation.errors,
    );
  }
  return { ok: true, value: immutableClone(record) };
}

function mapKeyVersion(
  record: SocialCredentialKeyVersionRecord,
  operation: string,
): SocialCredentialStoreResult<SocialCredentialKeyVersionRecord> {
  const validation = validateSocialCredentialKeyVersionRecord(record);
  if (!validation.ok) {
    return inconsistentFailure(
      `Credential key version failed validation during ${operation}.`,
      validation.errors,
    );
  }
  return { ok: true, value: immutableClone(record) };
}

function sortSnapshot(
  snapshot: SocialCredentialPersistenceModel,
): SocialCredentialPersistenceModel {
  return {
    provider_accounts: [...snapshot.provider_accounts].sort(
      (left, right) =>
        left.created_at.localeCompare(right.created_at) ||
        String(left.provider_account_id).localeCompare(String(right.provider_account_id)),
    ),
    vault_records: [...snapshot.vault_records].sort(
      (left, right) =>
        left.created_at.localeCompare(right.created_at) ||
        String(left.vault_record_id).localeCompare(String(right.vault_record_id)),
    ),
    lifecycle_states: [...snapshot.lifecycle_states].sort(
      (left, right) =>
        left.created_at.localeCompare(right.created_at) ||
        String(left.lifecycle_state_id).localeCompare(String(right.lifecycle_state_id)),
    ),
    audit_events: [...snapshot.audit_events].sort(
      (left, right) =>
        left.created_at.localeCompare(right.created_at) ||
        String(left.audit_event_id).localeCompare(String(right.audit_event_id)),
    ),
    key_versions: [...snapshot.key_versions].sort(
      (left, right) =>
        left.activated_at.localeCompare(right.activated_at) ||
        String(left.key_version).localeCompare(String(right.key_version)),
    ),
  };
}

function validateRecord<T>(
  validation:
    | { ok: true; errors: readonly [] }
    | { ok: false; errors: readonly SocialCredentialPersistenceError[] },
  message: string,
): SocialCredentialStoreResult<T> {
  if (validation.ok) {
    return { ok: true, value: undefined as T };
  }
  return validationFailure(message, validation.errors);
}

function duplicateIdentity(message: string): SocialCredentialStoreResult<never> {
  return { ok: false, error: storeError("duplicate_identity", message) };
}

function notFound(message: string): SocialCredentialStoreResult<never> {
  return { ok: false, error: storeError("not_found", message) };
}

function validationFailure<T>(
  message: string,
  validationErrors: readonly SocialCredentialPersistenceError[],
): SocialCredentialStoreResult<T> {
  return {
    ok: false,
    error: storeError("validation_failed", message, validationErrors),
  };
}

function inconsistentFailure<T>(
  message: string,
  validationErrors: readonly SocialCredentialPersistenceError[],
): SocialCredentialStoreResult<T> {
  return {
    ok: false,
    error: storeError("storage_inconsistent", message, validationErrors),
  };
}

function storageFailure<T>(
  error: unknown,
  fallbackMessage: string,
): SocialCredentialStoreResult<T> {
  return {
    ok: false,
    error: storeError(
      "storage_error",
      error instanceof Error ? error.message : fallbackMessage,
    ),
  };
}

function storeError(
  code: SocialCredentialStoreErrorCode,
  message: string,
  validationErrors?: readonly SocialCredentialPersistenceError[],
): SocialCredentialStoreError {
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
