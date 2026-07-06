import { createServiceRoleClient, isSupabaseServiceConfigured } from "../../supabase/admin";
import type {
  SocialExecutionSessionAuditEventRecord,
  SocialExecutionSessionRecord,
} from "./social-execution-session-domain";
import {
  mapSocialExecutionSessionAuditEventRecordToRow,
  mapSocialExecutionSessionAuditEventRowToRecord,
  mapSocialExecutionSessionRecordToRow,
  mapSocialExecutionSessionRowToRecord,
} from "./social-execution-session-mapper";
import type { SocialExecutionSessionAuditEventRow, SocialExecutionSessionRow } from "./social-execution-session-rows";

export type SocialExecutionSessionPersistenceSnapshot = Readonly<{
  sessions: readonly SocialExecutionSessionRecord[];
  auditEvents: readonly SocialExecutionSessionAuditEventRecord[];
}>;

export const EMPTY_SOCIAL_EXECUTION_SESSION_PERSISTENCE_SNAPSHOT: SocialExecutionSessionPersistenceSnapshot =
  Object.freeze({
    sessions: [],
    auditEvents: [],
  });

export type SocialExecutionSessionStoreStorage = Readonly<{
  loadSnapshot(): Promise<SocialExecutionSessionPersistenceSnapshot>;
  insertSession(record: SocialExecutionSessionRecord): Promise<SocialExecutionSessionRecord>;
  insertAuditEvent(
    record: SocialExecutionSessionAuditEventRecord,
  ): Promise<SocialExecutionSessionAuditEventRecord>;
}>;

let testStorage: SocialExecutionSessionStoreStorage | null = null;

export function configureSocialExecutionSessionStoreTestDependencies(
  storage: SocialExecutionSessionStoreStorage | null,
): void {
  testStorage = storage;
}

export function resetSocialExecutionSessionInMemoryStoreForTests(): void {
  testStorage = null;
}

export function isSocialExecutionSessionStoreConfigured(): boolean {
  return testStorage !== null || isSupabaseServiceConfigured();
}

export function createInMemoryExecutionSessionStore(
  initialSnapshot: SocialExecutionSessionPersistenceSnapshot = EMPTY_SOCIAL_EXECUTION_SESSION_PERSISTENCE_SNAPSHOT,
): SocialExecutionSessionStoreStorage {
  let snapshot = initialSnapshot;

  return {
    async loadSnapshot() {
      return snapshot;
    },
    async insertSession(record) {
      snapshot = Object.freeze({
        sessions: Object.freeze([...snapshot.sessions, record]),
        auditEvents: snapshot.auditEvents,
      });
      return record;
    },
    async insertAuditEvent(record) {
      snapshot = Object.freeze({
        sessions: snapshot.sessions,
        auditEvents: Object.freeze([...snapshot.auditEvents, record]),
      });
      return record;
    },
  };
}

export async function loadSocialExecutionSessionSnapshot(): Promise<SocialExecutionSessionPersistenceSnapshot> {
  return storage().loadSnapshot();
}

export async function appendSocialExecutionSessionRecord(
  record: SocialExecutionSessionRecord,
): Promise<SocialExecutionSessionRecord> {
  return storage().insertSession(record);
}

export async function appendSocialExecutionSessionAuditEvent(
  record: SocialExecutionSessionAuditEventRecord,
): Promise<SocialExecutionSessionAuditEventRecord> {
  return storage().insertAuditEvent(record);
}

function storage(): SocialExecutionSessionStoreStorage {
  return testStorage ?? createSupabaseExecutionSessionStore();
}

function createSupabaseExecutionSessionStore(): SocialExecutionSessionStoreStorage {
  return {
    async loadSnapshot() {
      if (!isSupabaseServiceConfigured()) {
        return EMPTY_SOCIAL_EXECUTION_SESSION_PERSISTENCE_SNAPSHOT;
      }

      const client = createServiceRoleClient();
      const [sessions, auditEvents] = await Promise.all([
        client
          .from("social_execution_sessions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        client
          .from("social_execution_session_audit_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      const mappedSessions: SocialExecutionSessionRecord[] = [];
      for (const row of sessions.data ?? []) {
        const mapped = mapSocialExecutionSessionRowToRecord(normalizeSessionRow(row));
        if (!mapped.ok) {
          throw new Error(
            mapped.errors.map((error) => `${error.path}: ${error.message}`).join(" "),
          );
        }

        mappedSessions.push(mapped.value);
      }

      const mappedAuditEvents: SocialExecutionSessionAuditEventRecord[] = [];
      for (const row of auditEvents.data ?? []) {
        const mapped = mapSocialExecutionSessionAuditEventRowToRecord(
          row as SocialExecutionSessionAuditEventRow,
        );
        if (!mapped.ok) {
          throw new Error(
            mapped.errors.map((error) => `${error.path}: ${error.message}`).join(" "),
          );
        }

        mappedAuditEvents.push(mapped.value);
      }

      return {
        sessions: mappedSessions,
        auditEvents: mappedAuditEvents,
      };
    },

    async insertSession(record) {
      const mapped = mapSocialExecutionSessionRecordToRow(record);
      if (!mapped.ok) {
        throw new Error(mapped.errors.map((error) => `${error.path}: ${error.message}`).join(" "));
      }

      const client = createServiceRoleClient();
      const { error } = await client.from("social_execution_sessions").insert({
        session_id: mapped.value.session_id,
        session_version: mapped.value.session_version,
        correlation_id: mapped.value.correlation_id,
        summary_status: mapped.value.summary_status,
        sanitized_summary: mapped.value.sanitized_summary,
        transcript_ids: mapped.value.transcript_ids,
        attempt_ids: mapped.value.attempt_ids,
        created_at: mapped.value.created_at,
        completed_at: mapped.value.completed_at,
      });
      if (error) throw new Error(error.message);
      return record;
    },

    async insertAuditEvent(record) {
      const mapped = mapSocialExecutionSessionAuditEventRecordToRow(record);
      if (!mapped.ok) {
        throw new Error(mapped.errors.map((error) => `${error.path}: ${error.message}`).join(" "));
      }

      const client = createServiceRoleClient();
      const { error } = await client
        .from("social_execution_session_audit_events")
        .insert(mapped.value);
      if (error) throw new Error(error.message);
      return record;
    },
  };
}

function normalizeSessionRow(row: Record<string, unknown>): SocialExecutionSessionRow {
  return {
    session_id: String(row.session_id),
    session_version: String(row.session_version),
    correlation_id: String(row.correlation_id),
    summary_status: String(row.summary_status),
    sanitized_summary: String(row.sanitized_summary),
    transcript_ids: normalizeStringArray(row.transcript_ids),
    attempt_ids: normalizeStringArray(row.attempt_ids),
    created_at: String(row.created_at),
    completed_at: String(row.completed_at),
  };
}

function normalizeStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item));
}
