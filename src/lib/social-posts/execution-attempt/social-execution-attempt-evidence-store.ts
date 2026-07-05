import { createServiceRoleClient, isSupabaseServiceConfigured } from "../../supabase/admin";
import type { SocialExecutionAttemptEvidenceRecord } from "./social-execution-attempt-evidence-domain";
import type { SocialExecutionAttemptStateTransitionRecord } from "./social-execution-attempt-state-transition-domain";

export type SocialExecutionAttemptEvidencePersistenceSnapshot = Readonly<{
  evidenceRecords: readonly SocialExecutionAttemptEvidenceRecord[];
  stateTransitions: readonly SocialExecutionAttemptStateTransitionRecord[];
}>;

export const EMPTY_SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_PERSISTENCE_SNAPSHOT: SocialExecutionAttemptEvidencePersistenceSnapshot =
  Object.freeze({
    evidenceRecords: [],
    stateTransitions: [],
  });

type EvidenceRow = Readonly<{
  evidence_id: string;
  evidence_version: string;
  attempt_id: string;
  correlation_id: string;
  transition_id: string | null;
  evidence_kind: string;
  sanitized_summary: string;
  evidence_payload: Record<string, unknown>;
  recorded_at: string;
  recorded_by_actor: string;
  recorded_source: string;
}>;

type TransitionRow = Readonly<{
  transition_id: string;
  transition_version: string;
  attempt_id: string;
  correlation_id: string;
  from_state: string;
  to_state: string;
  transition_kind: string;
  evidence_id: string | null;
  created_at: string;
}>;

export type SocialExecutionAttemptEvidenceStoreStorage = Readonly<{
  loadSnapshot(): Promise<SocialExecutionAttemptEvidencePersistenceSnapshot>;
  insertEvidenceRecord(
    record: SocialExecutionAttemptEvidenceRecord,
  ): Promise<SocialExecutionAttemptEvidenceRecord>;
  insertStateTransition(
    record: SocialExecutionAttemptStateTransitionRecord,
  ): Promise<SocialExecutionAttemptStateTransitionRecord>;
}>;

let testStorage: SocialExecutionAttemptEvidenceStoreStorage | null = null;

export function configureSocialExecutionAttemptEvidenceStoreTestDependencies(
  storage: SocialExecutionAttemptEvidenceStoreStorage | null,
): void {
  testStorage = storage;
}

export function isSocialExecutionAttemptEvidenceStoreConfigured(): boolean {
  return testStorage !== null || isSupabaseServiceConfigured();
}

export async function loadSocialExecutionAttemptEvidenceSnapshot(): Promise<SocialExecutionAttemptEvidencePersistenceSnapshot> {
  return storage().loadSnapshot();
}

export async function appendSocialExecutionAttemptEvidenceRecord(
  record: SocialExecutionAttemptEvidenceRecord,
): Promise<SocialExecutionAttemptEvidenceRecord> {
  return storage().insertEvidenceRecord(record);
}

export async function appendSocialExecutionAttemptStateTransition(
  record: SocialExecutionAttemptStateTransitionRecord,
): Promise<SocialExecutionAttemptStateTransitionRecord> {
  return storage().insertStateTransition(record);
}

function storage(): SocialExecutionAttemptEvidenceStoreStorage {
  return testStorage ?? createSupabaseExecutionAttemptEvidenceStore();
}

function createSupabaseExecutionAttemptEvidenceStore(): SocialExecutionAttemptEvidenceStoreStorage {
  return {
    async loadSnapshot() {
      if (!isSupabaseServiceConfigured()) {
        return EMPTY_SOCIAL_EXECUTION_ATTEMPT_EVIDENCE_PERSISTENCE_SNAPSHOT;
      }

      const client = createServiceRoleClient();
      const [evidenceRecords, stateTransitions] = await Promise.all([
        client
          .from("social_execution_attempt_evidence")
          .select("*")
          .order("recorded_at", { ascending: false })
          .limit(500),
        client
          .from("social_execution_attempt_state_transitions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      return {
        evidenceRecords: (evidenceRecords.data ?? []).map(mapEvidenceRow),
        stateTransitions: (stateTransitions.data ?? []).map(mapTransitionRow),
      };
    },

    async insertEvidenceRecord(record) {
      const client = createServiceRoleClient();
      const { error } = await client.from("social_execution_attempt_evidence").insert({
        evidence_id: record.evidenceId,
        evidence_version: record.evidenceVersion,
        attempt_id: record.attemptId,
        correlation_id: record.correlationId,
        transition_id: record.transitionId,
        evidence_kind: record.evidenceKind,
        sanitized_summary: record.sanitizedSummary,
        evidence_payload: record.evidencePayload,
        recorded_at: record.recordedAt,
        recorded_by_actor: record.recordedByActor,
        recorded_source: record.recordedSource,
      });
      if (error) throw new Error(error.message);
      return record;
    },

    async insertStateTransition(record) {
      const client = createServiceRoleClient();
      const { error } = await client.from("social_execution_attempt_state_transitions").insert({
        transition_id: record.transitionId,
        transition_version: record.transitionVersion,
        attempt_id: record.attemptId,
        correlation_id: record.correlationId,
        from_state: record.fromState,
        to_state: record.toState,
        transition_kind: record.transitionKind,
        evidence_id: record.evidenceId,
        created_at: record.createdAt,
      });
      if (error) throw new Error(error.message);
      return record;
    },
  };
}

function mapEvidenceRow(row: EvidenceRow): SocialExecutionAttemptEvidenceRecord {
  return {
    evidenceVersion: row.evidence_version as SocialExecutionAttemptEvidenceRecord["evidenceVersion"],
    evidenceId: row.evidence_id,
    attemptId: row.attempt_id,
    correlationId: row.correlation_id,
    transitionId: row.transition_id,
    evidenceKind: row.evidence_kind as SocialExecutionAttemptEvidenceRecord["evidenceKind"],
    sanitizedSummary: row.sanitized_summary,
    evidencePayload: row.evidence_payload as SocialExecutionAttemptEvidenceRecord["evidencePayload"],
    recordedAt: row.recorded_at,
    recordedByActor: row.recorded_by_actor as SocialExecutionAttemptEvidenceRecord["recordedByActor"],
    recordedSource: row.recorded_source as SocialExecutionAttemptEvidenceRecord["recordedSource"],
    appendOnly: true,
    immutable: true,
    metadataOnly: true,
    containsSecrets: false,
    provesExecution: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function mapTransitionRow(row: TransitionRow): SocialExecutionAttemptStateTransitionRecord {
  return {
    transitionVersion:
      row.transition_version as SocialExecutionAttemptStateTransitionRecord["transitionVersion"],
    transitionId: row.transition_id,
    attemptId: row.attempt_id,
    correlationId: row.correlation_id,
    fromState: row.from_state as SocialExecutionAttemptStateTransitionRecord["fromState"],
    toState: row.to_state as SocialExecutionAttemptStateTransitionRecord["toState"],
    transitionKind: row.transition_kind as SocialExecutionAttemptStateTransitionRecord["transitionKind"],
    evidenceId: row.evidence_id,
    createdAt: row.created_at,
    appendOnly: true,
    immutable: true,
    metadataOnly: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}
