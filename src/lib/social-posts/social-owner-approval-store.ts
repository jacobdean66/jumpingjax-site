import { createServiceRoleClient } from "../supabase/admin";

import {
  validateSocialOwnerApprovalPersistenceModel,
  type SocialOwnerApprovalApprovalId,
  type SocialOwnerApprovalEventId,
  type SocialOwnerApprovalEventRecord,
  type SocialOwnerApprovalPersistenceError,
  type SocialOwnerApprovalPersistenceModel,
  type SocialOwnerApprovalProposalId,
  type SocialOwnerApprovalProposalRecord,
} from "./social-owner-approval-persistence";

export const SOCIAL_OWNER_APPROVAL_REPOSITORY_ERROR_CODES = [
  "validation_failed",
  "not_found",
  "storage_error",
  "storage_inconsistent",
] as const;

export type SocialOwnerApprovalRepositoryErrorCode =
  (typeof SOCIAL_OWNER_APPROVAL_REPOSITORY_ERROR_CODES)[number];

export type SocialOwnerApprovalRepositoryError = Readonly<{
  code: SocialOwnerApprovalRepositoryErrorCode;
  message: string;
  validationErrors?: readonly SocialOwnerApprovalPersistenceError[];
}>;

export type SocialOwnerApprovalRepositoryResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: SocialOwnerApprovalRepositoryError }>;

type JsonRecord = Record<string, unknown>;

type SocialOwnerApprovalProposalRow = {
  proposal_id: string;
  approval_id: string;
  social_post_id: string;
  proposal_fingerprint: string;
  proposal_version: string;
  proposal_scope: JsonRecord;
  snapshot: JsonRecord;
  requested_readiness_summary: JsonRecord;
  created_by_actor: JsonRecord;
  created_at: string;
  request_metadata: JsonRecord | null;
};

type SocialOwnerApprovalEventRow = {
  event_id: string;
  approval_id: string;
  proposal_id: string;
  proposal_fingerprint: string;
  event_type: string;
  actor_snapshot: JsonRecord;
  event_reason: string | null;
  occurred_at: string;
  event_sequence: number;
  event_metadata: JsonRecord | null;
};

type OwnerApprovalStoreStorage = {
  insertProposal(
    row: SocialOwnerApprovalProposalRow,
  ): Promise<SocialOwnerApprovalProposalRow>;
  insertEvent(row: SocialOwnerApprovalEventRow): Promise<SocialOwnerApprovalEventRow>;
  getProposalById(
    proposalId: SocialOwnerApprovalProposalId,
  ): Promise<SocialOwnerApprovalProposalRow | null>;
  getProposalByApprovalId(
    approvalId: SocialOwnerApprovalApprovalId,
  ): Promise<SocialOwnerApprovalProposalRow | null>;
  listEventsByProposalId(
    proposalId: SocialOwnerApprovalProposalId,
  ): Promise<SocialOwnerApprovalEventRow[]>;
  listEventsByApprovalId(
    approvalId: SocialOwnerApprovalApprovalId,
  ): Promise<SocialOwnerApprovalEventRow[]>;
};

const PROPOSAL_SELECT =
  "proposal_id, approval_id, social_post_id, proposal_fingerprint, proposal_version, proposal_scope, snapshot, requested_readiness_summary, created_by_actor, created_at, request_metadata";

const EVENT_SELECT =
  "event_id, approval_id, proposal_id, proposal_fingerprint, event_type, actor_snapshot, event_reason, occurred_at, event_sequence, event_metadata";

let testStorage: OwnerApprovalStoreStorage | null = null;

export function configureOwnerApprovalStoreTestDependencies(
  storage: OwnerApprovalStoreStorage | null,
): void {
  testStorage = storage;
}

function repositoryError(
  code: SocialOwnerApprovalRepositoryErrorCode,
  message: string,
  validationErrors?: readonly SocialOwnerApprovalPersistenceError[],
): SocialOwnerApprovalRepositoryError {
  return { code, message, validationErrors };
}

function storage(): OwnerApprovalStoreStorage {
  if (testStorage) return testStorage;
  return createSupabaseOwnerApprovalStorage();
}

function createSupabaseOwnerApprovalStorage(): OwnerApprovalStoreStorage {
  const supabase = createServiceRoleClient();

  return {
    async insertProposal(row) {
      const { data, error } = await supabase
        .from("social_owner_approval_proposals")
        .insert(row)
        .select(PROPOSAL_SELECT)
        .single<SocialOwnerApprovalProposalRow>();

      if (error) throw new Error(error.message);
      return data;
    },
    async insertEvent(row) {
      const { data, error } = await supabase
        .from("social_owner_approval_events")
        .insert(row)
        .select(EVENT_SELECT)
        .single<SocialOwnerApprovalEventRow>();

      if (error) throw new Error(error.message);
      return data;
    },
    async getProposalById(proposalId) {
      const { data, error } = await supabase
        .from("social_owner_approval_proposals")
        .select(PROPOSAL_SELECT)
        .eq("proposal_id", proposalId)
        .maybeSingle<SocialOwnerApprovalProposalRow>();

      if (error) throw new Error(error.message);
      return data;
    },
    async getProposalByApprovalId(approvalId) {
      const { data, error } = await supabase
        .from("social_owner_approval_proposals")
        .select(PROPOSAL_SELECT)
        .eq("approval_id", approvalId)
        .maybeSingle<SocialOwnerApprovalProposalRow>();

      if (error) throw new Error(error.message);
      return data;
    },
    async listEventsByProposalId(proposalId) {
      const { data, error } = await supabase
        .from("social_owner_approval_events")
        .select(EVENT_SELECT)
        .eq("proposal_id", proposalId)
        .order("event_sequence", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as SocialOwnerApprovalEventRow[];
    },
    async listEventsByApprovalId(approvalId) {
      const { data, error } = await supabase
        .from("social_owner_approval_events")
        .select(EVENT_SELECT)
        .eq("approval_id", approvalId)
        .order("event_sequence", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as SocialOwnerApprovalEventRow[];
    },
  };
}

function proposalToRow(
  proposal: SocialOwnerApprovalProposalRecord,
): SocialOwnerApprovalProposalRow {
  return {
    proposal_id: proposal.proposalId,
    approval_id: proposal.approvalId,
    social_post_id: proposal.socialPostId,
    proposal_fingerprint: proposal.proposalFingerprint,
    proposal_version: proposal.proposalVersion,
    proposal_scope: proposal.proposalScope as JsonRecord,
    snapshot: proposal.snapshot as JsonRecord,
    requested_readiness_summary:
      proposal.requestedReadinessSummary as JsonRecord,
    created_by_actor: proposal.createdByActor as JsonRecord,
    created_at: proposal.createdAt,
    request_metadata: proposal.requestMetadata as JsonRecord | null,
  };
}

function eventToRow(event: SocialOwnerApprovalEventRecord): SocialOwnerApprovalEventRow {
  return {
    event_id: event.eventId,
    approval_id: event.approvalId,
    proposal_id: event.proposalId,
    proposal_fingerprint: event.proposalFingerprint,
    event_type: event.eventType,
    actor_snapshot: event.actorSnapshot as JsonRecord,
    event_reason: event.eventReason,
    occurred_at: event.occurredAt,
    event_sequence: event.eventSequence,
    event_metadata: event.eventMetadata as JsonRecord | null,
  };
}

function proposalFromRow(
  row: SocialOwnerApprovalProposalRow,
): SocialOwnerApprovalProposalRecord {
  return {
    proposalId: row.proposal_id as SocialOwnerApprovalProposalId,
    approvalId: row.approval_id as SocialOwnerApprovalApprovalId,
    socialPostId: row.social_post_id as SocialOwnerApprovalProposalRecord["socialPostId"],
    proposalFingerprint:
      row.proposal_fingerprint as SocialOwnerApprovalProposalRecord["proposalFingerprint"],
    proposalVersion:
      row.proposal_version as SocialOwnerApprovalProposalRecord["proposalVersion"],
    proposalScope:
      row.proposal_scope as SocialOwnerApprovalProposalRecord["proposalScope"],
    snapshot: row.snapshot as SocialOwnerApprovalProposalRecord["snapshot"],
    requestedReadinessSummary:
      row.requested_readiness_summary as SocialOwnerApprovalProposalRecord["requestedReadinessSummary"],
    createdByActor:
      row.created_by_actor as SocialOwnerApprovalProposalRecord["createdByActor"],
    createdAt: row.created_at,
    requestMetadata:
      row.request_metadata as SocialOwnerApprovalProposalRecord["requestMetadata"],
  };
}

function eventFromRow(row: SocialOwnerApprovalEventRow): SocialOwnerApprovalEventRecord {
  return {
    eventId: row.event_id as SocialOwnerApprovalEventId,
    approvalId: row.approval_id as SocialOwnerApprovalApprovalId,
    proposalId: row.proposal_id as SocialOwnerApprovalProposalId,
    proposalFingerprint:
      row.proposal_fingerprint as SocialOwnerApprovalEventRecord["proposalFingerprint"],
    eventType: row.event_type as SocialOwnerApprovalEventRecord["eventType"],
    actorSnapshot:
      row.actor_snapshot as SocialOwnerApprovalEventRecord["actorSnapshot"],
    eventReason: row.event_reason,
    occurredAt: row.occurred_at,
    eventSequence: row.event_sequence,
    eventMetadata:
      row.event_metadata as SocialOwnerApprovalEventRecord["eventMetadata"],
  };
}

function validateModelForWrite(
  model: SocialOwnerApprovalPersistenceModel,
): SocialOwnerApprovalRepositoryError | null {
  const validation = validateSocialOwnerApprovalPersistenceModel(model);
  if (validation.ok) return null;

  return repositoryError(
    "validation_failed",
    "Owner approval persistence model failed validation.",
    validation.errors,
  );
}

function validationModel(
  proposal: SocialOwnerApprovalProposalRecord,
  events: readonly SocialOwnerApprovalEventRecord[] = [],
): SocialOwnerApprovalPersistenceModel {
  return { proposal, events };
}

export async function createOwnerApprovalProposal(
  proposal: SocialOwnerApprovalProposalRecord,
): Promise<SocialOwnerApprovalRepositoryResult<SocialOwnerApprovalProposalRecord>> {
  const validationError = validateModelForWrite(validationModel(proposal));
  if (validationError) return { ok: false, error: validationError };

  try {
    const row = await storage().insertProposal(proposalToRow(proposal));
    return { ok: true, value: proposalFromRow(row) };
  } catch (error) {
    return {
      ok: false,
      error: repositoryError(
        "storage_error",
        error instanceof Error ? error.message : "Proposal write failed.",
      ),
    };
  }
}

export async function getOwnerApprovalProposalById(
  proposalId: SocialOwnerApprovalProposalId,
): Promise<SocialOwnerApprovalRepositoryResult<SocialOwnerApprovalProposalRecord>> {
  try {
    const row = await storage().getProposalById(proposalId);
    if (!row) {
      return {
        ok: false,
        error: repositoryError("not_found", "Owner approval proposal not found."),
      };
    }

    return { ok: true, value: proposalFromRow(row) };
  } catch (error) {
    return {
      ok: false,
      error: repositoryError(
        "storage_error",
        error instanceof Error ? error.message : "Proposal read failed.",
      ),
    };
  }
}

export async function getOwnerApprovalProposalByApprovalId(
  approvalId: SocialOwnerApprovalApprovalId,
): Promise<SocialOwnerApprovalRepositoryResult<SocialOwnerApprovalProposalRecord>> {
  try {
    const row = await storage().getProposalByApprovalId(approvalId);
    if (!row) {
      return {
        ok: false,
        error: repositoryError("not_found", "Owner approval proposal not found."),
      };
    }

    return { ok: true, value: proposalFromRow(row) };
  } catch (error) {
    return {
      ok: false,
      error: repositoryError(
        "storage_error",
        error instanceof Error ? error.message : "Proposal read failed.",
      ),
    };
  }
}

export async function appendOwnerApprovalEvent(input: {
  proposal: SocialOwnerApprovalProposalRecord;
  event: SocialOwnerApprovalEventRecord;
}): Promise<SocialOwnerApprovalRepositoryResult<SocialOwnerApprovalEventRecord>> {
  const validationError = validateModelForWrite(
    validationModel(input.proposal, [input.event]),
  );
  if (validationError) return { ok: false, error: validationError };

  try {
    const row = await storage().insertEvent(eventToRow(input.event));
    return { ok: true, value: eventFromRow(row) };
  } catch (error) {
    return {
      ok: false,
      error: repositoryError(
        "storage_error",
        error instanceof Error ? error.message : "Approval event write failed.",
      ),
    };
  }
}

export async function listOwnerApprovalEventsByProposalId(
  proposalId: SocialOwnerApprovalProposalId,
): Promise<SocialOwnerApprovalRepositoryResult<SocialOwnerApprovalEventRecord[]>> {
  try {
    const rows = await storage().listEventsByProposalId(proposalId);
    return {
      ok: true,
      value: rows
        .map(eventFromRow)
        .sort((left, right) => left.eventSequence - right.eventSequence),
    };
  } catch (error) {
    return {
      ok: false,
      error: repositoryError(
        "storage_error",
        error instanceof Error ? error.message : "Approval event read failed.",
      ),
    };
  }
}

export async function listOwnerApprovalEventsByApprovalId(
  approvalId: SocialOwnerApprovalApprovalId,
): Promise<SocialOwnerApprovalRepositoryResult<SocialOwnerApprovalEventRecord[]>> {
  try {
    const rows = await storage().listEventsByApprovalId(approvalId);
    return {
      ok: true,
      value: rows
        .map(eventFromRow)
        .sort((left, right) => left.eventSequence - right.eventSequence),
    };
  } catch (error) {
    return {
      ok: false,
      error: repositoryError(
        "storage_error",
        error instanceof Error ? error.message : "Approval event read failed.",
      ),
    };
  }
}
