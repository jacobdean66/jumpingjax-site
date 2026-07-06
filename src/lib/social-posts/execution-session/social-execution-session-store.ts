import type {
  SocialExecutionSessionAuditEventRecord,
  SocialExecutionSessionRecord,
} from "./social-execution-session-domain";

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

let inMemorySnapshot: SocialExecutionSessionPersistenceSnapshot =
  EMPTY_SOCIAL_EXECUTION_SESSION_PERSISTENCE_SNAPSHOT;
let testStorage: SocialExecutionSessionStoreStorage | null = null;

export function configureSocialExecutionSessionStoreTestDependencies(
  storage: SocialExecutionSessionStoreStorage | null,
): void {
  testStorage = storage;
}

export function resetSocialExecutionSessionInMemoryStoreForTests(): void {
  inMemorySnapshot = EMPTY_SOCIAL_EXECUTION_SESSION_PERSISTENCE_SNAPSHOT;
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
  return testStorage ?? createInMemoryExecutionSessionStore();
}

function createInMemoryExecutionSessionStore(): SocialExecutionSessionStoreStorage {
  return {
    async loadSnapshot() {
      return inMemorySnapshot;
    },
    async insertSession(record) {
      inMemorySnapshot = Object.freeze({
        sessions: Object.freeze([...inMemorySnapshot.sessions, record]),
        auditEvents: inMemorySnapshot.auditEvents,
      });
      return record;
    },
    async insertAuditEvent(record) {
      inMemorySnapshot = Object.freeze({
        sessions: inMemorySnapshot.sessions,
        auditEvents: Object.freeze([...inMemorySnapshot.auditEvents, record]),
      });
      return record;
    },
  };
}
