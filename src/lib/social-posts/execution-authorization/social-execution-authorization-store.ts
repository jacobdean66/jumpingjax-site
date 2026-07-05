import { createServiceRoleClient, isSupabaseServiceConfigured } from "../../supabase/admin";
import type { SocialExecutionAuthorizationCancellationRecord } from "./social-execution-authorization-domain";
import type { SocialExecutionAuthorizationIntentRecord } from "./social-execution-authorization-intent-domain";
import type { SocialExecutionAuthorizationRecord } from "./social-execution-authorization-domain";
import type { SocialExecutionRuntimeSessionRecord } from "./social-execution-runtime-session-domain";

export type SocialExecutionAuthorizationAuditEventRow = Readonly<{
  audit_event_id: string;
  authorization_id: string | null;
  authorization_identity: string | null;
  correlation_id: string | null;
  action: "authorize" | "cancel" | "authorize_validation_failed" | "cancel_validation_failed";
  outcome: "success" | "validation_failed" | "duplicate_identity" | "not_found" | "storage_error" | "owner_approval_verification_failed";
  sanitized_detail: string;
  admin_actor_id: string;
  created_at: string;
}>;

export type SocialExecutionAuthorizationPersistenceSnapshot = Readonly<{
  authorizations: readonly SocialExecutionAuthorizationRecord[];
  cancellations: readonly SocialExecutionAuthorizationCancellationRecord[];
  intents: readonly SocialExecutionAuthorizationIntentRecord[];
  sessions: readonly SocialExecutionRuntimeSessionRecord[];
  auditEvents: readonly SocialExecutionAuthorizationAuditEventRow[];
}>;

export const EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT: SocialExecutionAuthorizationPersistenceSnapshot =
  Object.freeze({
    authorizations: [],
    cancellations: [],
    intents: [],
    sessions: [],
    auditEvents: [],
  });

type AuthorizationRow = Readonly<{
  authorization_id: string;
  authorization_identity: string;
  authorization_version: string;
  scope_kind: string;
  execution_intent_id: string;
  publication_target_id: string;
  owner_approval_id: string;
  approval_id: string | null;
  social_post_id: string | null;
  authorization_state: string;
  correlation_id: string;
  authorized_at: string;
  expires_at: string;
  admin_actor_id: string;
  created_at: string;
}>;

type CancellationRow = Readonly<{
  cancellation_id: string;
  authorization_id: string;
  authorization_identity: string;
  correlation_id: string;
  cancelled_at: string;
  sanitized_detail: string;
  admin_actor_id: string;
  created_at: string;
}>;

type IntentRow = Readonly<{
  intent_record_id: string;
  intent_version: string;
  execution_intent_id: string;
  authorization_id: string | null;
  correlation_id: string;
  intent_state: string;
  publication_target_id: string;
  owner_approval_id: string;
  created_at: string;
}>;

type SessionRow = Readonly<{
  session_id: string;
  session_version: string;
  authorization_id: string;
  correlation_id: string;
  runtime_status: string;
  publication_target_id: string;
  execution_intent_id: string;
  expires_at: string;
  created_at: string;
}>;

export type SocialExecutionAuthorizationStoreStorage = Readonly<{
  loadSnapshot(): Promise<SocialExecutionAuthorizationPersistenceSnapshot>;
  insertAuthorization(record: SocialExecutionAuthorizationRecord): Promise<SocialExecutionAuthorizationRecord>;
  insertCancellation(
    record: SocialExecutionAuthorizationCancellationRecord,
  ): Promise<SocialExecutionAuthorizationCancellationRecord>;
  insertIntent(record: SocialExecutionAuthorizationIntentRecord): Promise<SocialExecutionAuthorizationIntentRecord>;
  insertSession(record: SocialExecutionRuntimeSessionRecord): Promise<SocialExecutionRuntimeSessionRecord>;
  insertAuditEvent(record: SocialExecutionAuthorizationAuditEventRow): Promise<SocialExecutionAuthorizationAuditEventRow>;
}>;

let testStorage: SocialExecutionAuthorizationStoreStorage | null = null;

export function configureSocialExecutionAuthorizationStoreTestDependencies(
  storage: SocialExecutionAuthorizationStoreStorage | null,
): void {
  testStorage = storage;
}

export function isSocialExecutionAuthorizationStoreConfigured(): boolean {
  return testStorage !== null || isSupabaseServiceConfigured();
}

export async function loadSocialExecutionAuthorizationSnapshot(): Promise<SocialExecutionAuthorizationPersistenceSnapshot> {
  return storage().loadSnapshot();
}

export async function appendSocialExecutionAuthorizationRecord(
  record: SocialExecutionAuthorizationRecord,
): Promise<SocialExecutionAuthorizationRecord> {
  return storage().insertAuthorization(record);
}

export async function appendSocialExecutionAuthorizationCancellation(
  record: SocialExecutionAuthorizationCancellationRecord,
): Promise<SocialExecutionAuthorizationCancellationRecord> {
  return storage().insertCancellation(record);
}

export async function appendSocialExecutionAuthorizationIntentRecord(
  record: SocialExecutionAuthorizationIntentRecord,
): Promise<SocialExecutionAuthorizationIntentRecord> {
  return storage().insertIntent(record);
}

export async function appendSocialExecutionRuntimeSessionRecord(
  record: SocialExecutionRuntimeSessionRecord,
): Promise<SocialExecutionRuntimeSessionRecord> {
  return storage().insertSession(record);
}

export async function appendSocialExecutionAuthorizationAuditEvent(
  record: SocialExecutionAuthorizationAuditEventRow,
): Promise<SocialExecutionAuthorizationAuditEventRow> {
  return storage().insertAuditEvent(record);
}

function storage(): SocialExecutionAuthorizationStoreStorage {
  return testStorage ?? createSupabaseExecutionAuthorizationStore();
}

function createSupabaseExecutionAuthorizationStore(): SocialExecutionAuthorizationStoreStorage {
  return {
    async loadSnapshot() {
      if (!isSupabaseServiceConfigured()) {
        return EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT;
      }

      const client = createServiceRoleClient();
      const [authorizations, cancellations, intents, sessions, auditEvents] = await Promise.all([
        client
          .from("social_execution_authorizations")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        client
          .from("social_execution_authorization_cancellations")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        client
          .from("social_execution_authorization_intents")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        client
          .from("social_execution_runtime_sessions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        client
          .from("social_execution_authorization_audit_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      return {
        authorizations: (authorizations.data ?? []).map(mapAuthorizationRow),
        cancellations: (cancellations.data ?? []).map(mapCancellationRow),
        intents: (intents.data ?? []).map(mapIntentRow),
        sessions: (sessions.data ?? []).map(mapSessionRow),
        auditEvents: (auditEvents.data ?? []) as SocialExecutionAuthorizationAuditEventRow[],
      };
    },

    async insertAuthorization(record) {
      const client = createServiceRoleClient();
      const { error } = await client.from("social_execution_authorizations").insert(mapAuthorizationRecord(record));
      if (error) throw new Error(error.message);
      return record;
    },

    async insertCancellation(record) {
      const client = createServiceRoleClient();
      const { error } = await client.from("social_execution_authorization_cancellations").insert({
        cancellation_id: record.cancellationId,
        authorization_id: record.authorizationId,
        authorization_identity: record.authorizationIdentity,
        correlation_id: record.correlationId,
        cancelled_at: record.cancelledAt,
        sanitized_detail: record.sanitizedDetail,
        admin_actor_id: record.adminActorId,
        created_at: record.createdAt,
      });
      if (error) throw new Error(error.message);
      return record;
    },

    async insertIntent(record) {
      const client = createServiceRoleClient();
      const { error } = await client.from("social_execution_authorization_intents").insert({
        intent_record_id: record.intentRecordId,
        intent_version: record.intentVersion,
        execution_intent_id: record.executionIntentId,
        authorization_id: record.authorizationId,
        correlation_id: record.correlationId,
        intent_state: record.intentState,
        publication_target_id: record.publicationTargetId,
        owner_approval_id: record.ownerApprovalId,
        created_at: record.createdAt,
      });
      if (error) throw new Error(error.message);
      return record;
    },

    async insertSession(record) {
      const client = createServiceRoleClient();
      const { error } = await client.from("social_execution_runtime_sessions").insert({
        session_id: record.sessionId,
        session_version: record.sessionVersion,
        authorization_id: record.authorizationId,
        correlation_id: record.correlationId,
        runtime_status: record.runtimeStatus,
        publication_target_id: record.publicationTargetId,
        execution_intent_id: record.executionIntentId,
        expires_at: record.expiresAt,
        created_at: record.createdAt,
      });
      if (error) throw new Error(error.message);
      return record;
    },

    async insertAuditEvent(record) {
      const client = createServiceRoleClient();
      const { error } = await client.from("social_execution_authorization_audit_events").insert(record);
      if (error) throw new Error(error.message);
      return record;
    },
  };
}

function mapAuthorizationRecord(record: SocialExecutionAuthorizationRecord) {
  return {
    authorization_id: record.authorizationId,
    authorization_identity: record.authorizationIdentity,
    authorization_version: record.authorizationVersion,
    scope_kind: record.scope.scopeKind,
    execution_intent_id: record.executionIntentId,
    publication_target_id: record.publicationTargetId,
    owner_approval_id: record.ownerApprovalId,
    approval_id: record.scope.approvalId,
    social_post_id: record.scope.socialPostId,
    authorization_state: record.authorizationState,
    correlation_id: record.correlationId,
    authorized_at: record.authorizedAt,
    expires_at: record.expiresAt,
    admin_actor_id: record.adminActorId,
    created_at: record.createdAt,
  };
}

function mapAuthorizationRow(row: AuthorizationRow): SocialExecutionAuthorizationRecord {
  return {
    authorizationVersion: row.authorization_version as SocialExecutionAuthorizationRecord["authorizationVersion"],
    authorizationId: row.authorization_id,
    authorizationIdentity: row.authorization_identity,
    scope: {
      scopeKind: row.scope_kind as SocialExecutionAuthorizationRecord["scope"]["scopeKind"],
      executionIntentId: row.execution_intent_id,
      publicationTargetId: row.publication_target_id,
      ownerApprovalId: row.owner_approval_id,
      approvalId: row.approval_id,
      socialPostId: row.social_post_id,
    },
    authorizationState: "authorized",
    correlationId: row.correlation_id,
    authorizedAt: row.authorized_at,
    expiresAt: row.expires_at,
    ownerApprovalId: row.owner_approval_id,
    publicationTargetId: row.publication_target_id,
    executionIntentId: row.execution_intent_id,
    adminActorId: row.admin_actor_id,
    createdAt: row.created_at,
    appendOnly: true,
    immutable: true,
    containsSecrets: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    authorizesFutureExecutionOnly: true,
  };
}

function mapCancellationRow(row: CancellationRow): SocialExecutionAuthorizationCancellationRecord {
  return {
    cancellationId: row.cancellation_id,
    authorizationId: row.authorization_id,
    authorizationIdentity: row.authorization_identity,
    correlationId: row.correlation_id,
    cancelledAt: row.cancelled_at,
    adminActorId: row.admin_actor_id,
    sanitizedDetail: row.sanitized_detail,
    createdAt: row.created_at,
    appendOnly: true,
    immutable: true,
    containsSecrets: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function mapIntentRow(row: IntentRow): SocialExecutionAuthorizationIntentRecord {
  return {
    intentVersion: row.intent_version as SocialExecutionAuthorizationIntentRecord["intentVersion"],
    intentRecordId: row.intent_record_id,
    executionIntentId: row.execution_intent_id,
    authorizationId: row.authorization_id,
    correlationId: row.correlation_id,
    intentState: row.intent_state as SocialExecutionAuthorizationIntentRecord["intentState"],
    publicationTargetId: row.publication_target_id,
    ownerApprovalId: row.owner_approval_id,
    createdAt: row.created_at,
    appendOnly: true,
    immutable: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function mapSessionRow(row: SessionRow): SocialExecutionRuntimeSessionRecord {
  return {
    sessionVersion: row.session_version as SocialExecutionRuntimeSessionRecord["sessionVersion"],
    sessionId: row.session_id,
    authorizationId: row.authorization_id,
    correlationId: row.correlation_id,
    runtimeStatus: "active",
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    publicationTargetId: row.publication_target_id,
    executionIntentId: row.execution_intent_id,
    metadataOnly: true,
    appendOnly: true,
    immutable: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    backgroundWorkersForbidden: true,
  };
}
