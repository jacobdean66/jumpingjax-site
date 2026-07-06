import type {
  SocialExecutionPlanAuditEventRecord,
  SocialExecutionPlanRecord,
} from "./social-execution-plan-domain";

export type SocialExecutionPlanPersistenceSnapshot = Readonly<{
  plans: readonly SocialExecutionPlanRecord[];
  auditEvents: readonly SocialExecutionPlanAuditEventRecord[];
}>;

export const EMPTY_SOCIAL_EXECUTION_PLAN_PERSISTENCE_SNAPSHOT: SocialExecutionPlanPersistenceSnapshot =
  Object.freeze({
    plans: [],
    auditEvents: [],
  });

export type SocialExecutionPlanStoreStorage = Readonly<{
  loadSnapshot(): Promise<SocialExecutionPlanPersistenceSnapshot>;
  insertPlan(record: SocialExecutionPlanRecord): Promise<SocialExecutionPlanRecord>;
  insertAuditEvent(record: SocialExecutionPlanAuditEventRecord): Promise<SocialExecutionPlanAuditEventRecord>;
}>;

let inMemorySnapshot: SocialExecutionPlanPersistenceSnapshot =
  EMPTY_SOCIAL_EXECUTION_PLAN_PERSISTENCE_SNAPSHOT;
let testStorage: SocialExecutionPlanStoreStorage | null = null;

export function configureSocialExecutionPlanStoreTestDependencies(
  storage: SocialExecutionPlanStoreStorage | null,
): void {
  testStorage = storage;
}

export function resetSocialExecutionPlanInMemoryStoreForTests(): void {
  inMemorySnapshot = EMPTY_SOCIAL_EXECUTION_PLAN_PERSISTENCE_SNAPSHOT;
}

export async function loadSocialExecutionPlanSnapshot(): Promise<SocialExecutionPlanPersistenceSnapshot> {
  return storage().loadSnapshot();
}

export async function appendSocialExecutionPlanRecord(
  record: SocialExecutionPlanRecord,
): Promise<SocialExecutionPlanRecord> {
  return storage().insertPlan(record);
}

export async function appendSocialExecutionPlanAuditEvent(
  record: SocialExecutionPlanAuditEventRecord,
): Promise<SocialExecutionPlanAuditEventRecord> {
  return storage().insertAuditEvent(record);
}

function storage(): SocialExecutionPlanStoreStorage {
  return testStorage ?? createInMemoryExecutionPlanStore();
}

function createInMemoryExecutionPlanStore(): SocialExecutionPlanStoreStorage {
  return {
    async loadSnapshot() {
      return inMemorySnapshot;
    },
    async insertPlan(record) {
      inMemorySnapshot = Object.freeze({
        plans: Object.freeze([...inMemorySnapshot.plans, record]),
        auditEvents: inMemorySnapshot.auditEvents,
      });
      return record;
    },
    async insertAuditEvent(record) {
      inMemorySnapshot = Object.freeze({
        plans: inMemorySnapshot.plans,
        auditEvents: Object.freeze([...inMemorySnapshot.auditEvents, record]),
      });
      return record;
    },
  };
}
