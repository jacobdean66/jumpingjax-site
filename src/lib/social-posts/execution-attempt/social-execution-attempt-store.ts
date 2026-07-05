import { createServiceRoleClient, isSupabaseServiceConfigured } from "../../supabase/admin";
import type { SocialExecutionAttemptLifecycleEventRecord } from "./social-execution-attempt-lifecycle-domain";
import type { SocialExecutionAttemptRecord } from "./social-execution-attempt-domain";

export type SocialExecutionAttemptAuditEventRow = Readonly<{
  audit_event_id: string;
  attempt_id: string | null;
  attempt_identity: string | null;
  correlation_id: string | null;
  action:
    | "append_attempt"
    | "append_lifecycle"
    | "validation_failed"
    | "create_attempt"
    | "create_validation_failed";
  outcome:
    | "success"
    | "validation_failed"
    | "duplicate_identity"
    | "not_found"
    | "storage_error";
  sanitized_detail: string;
  created_at: string;
}>;

export type SocialExecutionAttemptPersistenceSnapshot = Readonly<{
  attempts: readonly SocialExecutionAttemptRecord[];
  lifecycleEvents: readonly SocialExecutionAttemptLifecycleEventRecord[];
  auditEvents: readonly SocialExecutionAttemptAuditEventRow[];
}>;

export const EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT: SocialExecutionAttemptPersistenceSnapshot =
  Object.freeze({
    attempts: [],
    lifecycleEvents: [],
    auditEvents: [],
  });

type AttemptRow = Readonly<{
  attempt_id: string;
  attempt_identity: string;
  attempt_version: string;
  authorization_id: string;
  session_id: string;
  publication_target_id: string;
  execution_intent_id: string;
  correlation_id: string;
  idempotency_key: string;
  replay_key: string;
  attempt_fingerprint: string;
  expires_at: string;
  created_at: string;
}>;

type LifecycleRow = Readonly<{
  lifecycle_event_id: string;
  lifecycle_version: string;
  attempt_id: string;
  correlation_id: string;
  lifecycle_state: string;
  created_at: string;
}>;

export type SocialExecutionAttemptStoreStorage = Readonly<{
  loadSnapshot(): Promise<SocialExecutionAttemptPersistenceSnapshot>;
  insertAttempt(record: SocialExecutionAttemptRecord): Promise<SocialExecutionAttemptRecord>;
  insertLifecycleEvent(
    record: SocialExecutionAttemptLifecycleEventRecord,
  ): Promise<SocialExecutionAttemptLifecycleEventRecord>;
  insertAuditEvent(record: SocialExecutionAttemptAuditEventRow): Promise<SocialExecutionAttemptAuditEventRow>;
}>;

let testStorage: SocialExecutionAttemptStoreStorage | null = null;

export function configureSocialExecutionAttemptStoreTestDependencies(
  storage: SocialExecutionAttemptStoreStorage | null,
): void {
  testStorage = storage;
}

export function isSocialExecutionAttemptStoreConfigured(): boolean {
  return testStorage !== null || isSupabaseServiceConfigured();
}

export async function loadSocialExecutionAttemptSnapshot(): Promise<SocialExecutionAttemptPersistenceSnapshot> {
  return storage().loadSnapshot();
}

export async function appendSocialExecutionAttemptRecord(
  record: SocialExecutionAttemptRecord,
): Promise<SocialExecutionAttemptRecord> {
  return storage().insertAttempt(record);
}

export async function appendSocialExecutionAttemptLifecycleEvent(
  record: SocialExecutionAttemptLifecycleEventRecord,
): Promise<SocialExecutionAttemptLifecycleEventRecord> {
  return storage().insertLifecycleEvent(record);
}

export async function appendSocialExecutionAttemptAuditEvent(
  record: SocialExecutionAttemptAuditEventRow,
): Promise<SocialExecutionAttemptAuditEventRow> {
  return storage().insertAuditEvent(record);
}

function storage(): SocialExecutionAttemptStoreStorage {
  return testStorage ?? createSupabaseExecutionAttemptStore();
}

function createSupabaseExecutionAttemptStore(): SocialExecutionAttemptStoreStorage {
  return {
    async loadSnapshot() {
      if (!isSupabaseServiceConfigured()) {
        return EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT;
      }

      const client = createServiceRoleClient();
      const [attempts, lifecycleEvents, auditEvents] = await Promise.all([
        client
          .from("social_execution_attempts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        client
          .from("social_execution_attempt_lifecycle_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        client
          .from("social_execution_attempt_audit_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      return {
        attempts: (attempts.data ?? []).map(mapAttemptRow),
        lifecycleEvents: (lifecycleEvents.data ?? []).map(mapLifecycleRow),
        auditEvents: (auditEvents.data ?? []) as SocialExecutionAttemptAuditEventRow[],
      };
    },

    async insertAttempt(record) {
      const client = createServiceRoleClient();
      const { error } = await client.from("social_execution_attempts").insert(mapAttemptRecord(record));
      if (error) throw new Error(error.message);
      return record;
    },

    async insertLifecycleEvent(record) {
      const client = createServiceRoleClient();
      const { error } = await client.from("social_execution_attempt_lifecycle_events").insert({
        lifecycle_event_id: record.lifecycleEventId,
        lifecycle_version: record.lifecycleVersion,
        attempt_id: record.attemptId,
        correlation_id: record.correlationId,
        lifecycle_state: record.lifecycleState,
        created_at: record.createdAt,
      });
      if (error) throw new Error(error.message);
      return record;
    },

    async insertAuditEvent(record) {
      const client = createServiceRoleClient();
      const { error } = await client.from("social_execution_attempt_audit_events").insert(record);
      if (error) throw new Error(error.message);
      return record;
    },
  };
}

function mapAttemptRecord(record: SocialExecutionAttemptRecord) {
  return {
    attempt_id: record.attemptId,
    attempt_identity: record.attemptIdentity,
    attempt_version: record.attemptVersion,
    authorization_id: record.authorizationId,
    session_id: record.sessionId,
    publication_target_id: record.publicationTargetId,
    execution_intent_id: record.executionIntentId,
    correlation_id: record.correlationId,
    idempotency_key: record.idempotencyKey,
    replay_key: record.replayKey,
    attempt_fingerprint: record.attemptFingerprint,
    expires_at: record.expiresAt,
    created_at: record.createdAt,
  };
}

function mapAttemptRow(row: AttemptRow): SocialExecutionAttemptRecord {
  return {
    attemptVersion: row.attempt_version as SocialExecutionAttemptRecord["attemptVersion"],
    attemptId: row.attempt_id,
    attemptIdentity: row.attempt_identity,
    authorizationId: row.authorization_id,
    sessionId: row.session_id,
    publicationTargetId: row.publication_target_id,
    executionIntentId: row.execution_intent_id,
    correlationId: row.correlation_id,
    idempotencyKey: row.idempotency_key,
    replayKey: row.replay_key,
    attemptFingerprint: row.attempt_fingerprint,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    appendOnly: true,
    immutable: true,
    metadataOnly: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    subordinateToAuthorization: true,
  };
}

function mapLifecycleRow(row: LifecycleRow): SocialExecutionAttemptLifecycleEventRecord {
  return {
    lifecycleVersion: row.lifecycle_version as SocialExecutionAttemptLifecycleEventRecord["lifecycleVersion"],
    lifecycleEventId: row.lifecycle_event_id,
    attemptId: row.attempt_id,
    correlationId: row.correlation_id,
    lifecycleState: row.lifecycle_state as SocialExecutionAttemptLifecycleEventRecord["lifecycleState"],
    createdAt: row.created_at,
    appendOnly: true,
    immutable: true,
    metadataOnly: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}
