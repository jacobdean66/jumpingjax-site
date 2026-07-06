import type {
  SocialExecutionRunnerAuditEventRecord,
  SocialExecutionRunnerTranscriptRecord,
} from "./social-execution-runner-domain";

export type SocialExecutionRunnerPersistenceSnapshot = Readonly<{
  transcripts: readonly SocialExecutionRunnerTranscriptRecord[];
  auditEvents: readonly SocialExecutionRunnerAuditEventRecord[];
}>;

export const EMPTY_SOCIAL_EXECUTION_RUNNER_PERSISTENCE_SNAPSHOT: SocialExecutionRunnerPersistenceSnapshot =
  Object.freeze({
    transcripts: [],
    auditEvents: [],
  });

export type SocialExecutionRunnerStoreStorage = Readonly<{
  loadSnapshot(): Promise<SocialExecutionRunnerPersistenceSnapshot>;
  insertTranscript(record: SocialExecutionRunnerTranscriptRecord): Promise<SocialExecutionRunnerTranscriptRecord>;
  insertAuditEvent(record: SocialExecutionRunnerAuditEventRecord): Promise<SocialExecutionRunnerAuditEventRecord>;
}>;

let inMemorySnapshot: SocialExecutionRunnerPersistenceSnapshot =
  EMPTY_SOCIAL_EXECUTION_RUNNER_PERSISTENCE_SNAPSHOT;
let testStorage: SocialExecutionRunnerStoreStorage | null = null;

export function configureSocialExecutionRunnerStoreTestDependencies(
  storage: SocialExecutionRunnerStoreStorage | null,
): void {
  testStorage = storage;
}

export function resetSocialExecutionRunnerInMemoryStoreForTests(): void {
  inMemorySnapshot = EMPTY_SOCIAL_EXECUTION_RUNNER_PERSISTENCE_SNAPSHOT;
}

export async function loadSocialExecutionRunnerSnapshot(): Promise<SocialExecutionRunnerPersistenceSnapshot> {
  return storage().loadSnapshot();
}

export async function appendSocialExecutionRunnerTranscript(
  record: SocialExecutionRunnerTranscriptRecord,
): Promise<SocialExecutionRunnerTranscriptRecord> {
  return storage().insertTranscript(record);
}

export async function appendSocialExecutionRunnerAuditEvent(
  record: SocialExecutionRunnerAuditEventRecord,
): Promise<SocialExecutionRunnerAuditEventRecord> {
  return storage().insertAuditEvent(record);
}

function storage(): SocialExecutionRunnerStoreStorage {
  return testStorage ?? createInMemoryExecutionRunnerStore();
}

function createInMemoryExecutionRunnerStore(): SocialExecutionRunnerStoreStorage {
  return {
    async loadSnapshot() {
      return inMemorySnapshot;
    },
    async insertTranscript(record) {
      inMemorySnapshot = Object.freeze({
        transcripts: Object.freeze([...inMemorySnapshot.transcripts, record]),
        auditEvents: inMemorySnapshot.auditEvents,
      });
      return record;
    },
    async insertAuditEvent(record) {
      inMemorySnapshot = Object.freeze({
        transcripts: inMemorySnapshot.transcripts,
        auditEvents: Object.freeze([...inMemorySnapshot.auditEvents, record]),
      });
      return record;
    },
  };
}
