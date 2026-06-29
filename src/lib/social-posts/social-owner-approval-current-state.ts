import {
  APPROVAL_EVENT_TYPES,
  type ApprovalEventType,
} from "./social-owner-approval";
import {
  validateSocialOwnerApprovalPersistenceModel,
  type SocialOwnerApprovalApprovalId,
  type SocialOwnerApprovalEventId,
  type SocialOwnerApprovalEventRecord,
  type SocialOwnerApprovalPersistenceError,
  type SocialOwnerApprovalPersistenceErrorCode,
  type SocialOwnerApprovalProposalId,
  type SocialOwnerApprovalProposalRecord,
} from "./social-owner-approval-persistence";

export const OWNER_APPROVAL_CURRENT_STATE_ERROR_CODES = [
  "invalid_history",
  "proposal_validation_failed",
] as const;

export type OwnerApprovalCurrentStateErrorCode =
  (typeof OWNER_APPROVAL_CURRENT_STATE_ERROR_CODES)[number];

export type OwnerApprovalLifecycleStatus =
  | "no_events"
  | "requested"
  | "approved"
  | "rejected"
  | "revoked"
  | "expired"
  | "superseded";

export type OwnerApprovalDecisionStatus =
  | "none"
  | "approved"
  | "rejected"
  | "revoked";

export type OwnerApprovalDecisionKind = "approve" | "reject" | "revoke";

export type OwnerApprovalCurrentStateInput = Readonly<{
  proposal: SocialOwnerApprovalProposalRecord;
  events: readonly SocialOwnerApprovalEventRecord[];
}>;

export type OwnerApprovalCurrentStateError = Readonly<{
  code: OwnerApprovalCurrentStateErrorCode;
  message: string;
  reasonCode: string;
}>;

export type OwnerApprovalComputedCurrentState = Readonly<{
  proposalId: SocialOwnerApprovalProposalId;
  approvalId: SocialOwnerApprovalApprovalId;
  lifecycleStatus: OwnerApprovalLifecycleStatus;
  decisionStatus: OwnerApprovalDecisionStatus;
  latestEventId: SocialOwnerApprovalEventId | null;
  latestEventSequence: number | null;
  latestDecisionEventId: SocialOwnerApprovalEventId | null;
  latestDecisionKind: OwnerApprovalDecisionKind | null;
  requestedAt: string | null;
  decidedAt: string | null;
  revokedAt: string | null;
  reasonCode: string;
  computedOnly: true;
}>;

export type OwnerApprovalCurrentStateResult =
  | Readonly<{ ok: true; value: OwnerApprovalComputedCurrentState }>
  | Readonly<{ ok: false; error: OwnerApprovalCurrentStateError }>;

const DECISION_EVENT_KIND: Readonly<
  Record<
    "approval_approved" | "approval_rejected" | "approval_revoked",
    OwnerApprovalDecisionKind
  >
> = {
  approval_approved: "approve",
  approval_rejected: "reject",
  approval_revoked: "revoke",
};

const EVENT_LIFECYCLE_STATUS: Readonly<
  Record<ApprovalEventType, OwnerApprovalLifecycleStatus>
> = {
  approval_requested: "requested",
  approval_approved: "approved",
  approval_rejected: "rejected",
  approval_revoked: "revoked",
  approval_expired: "expired",
  approval_superseded: "superseded",
};

function isReplayPersistenceErrorCode(
  code: SocialOwnerApprovalPersistenceErrorCode,
): boolean {
  return (
    code === "event_sequence_invalid" ||
    code === "event_scope_mismatch" ||
    code === "event_type_invalid" ||
    code === "identity_not_separated"
  );
}

function currentStateError(input: {
  code: OwnerApprovalCurrentStateErrorCode;
  message: string;
  reasonCode: string;
}): OwnerApprovalCurrentStateError {
  return input;
}

function isKnownEventType(
  eventType: string,
): eventType is ApprovalEventType {
  return APPROVAL_EVENT_TYPES.includes(eventType as ApprovalEventType);
}

function validateReplayHistory(input: {
  proposal: SocialOwnerApprovalProposalRecord;
  events: readonly SocialOwnerApprovalEventRecord[];
}): OwnerApprovalCurrentStateError | null {
  const seenSequences = new Set<number>();

  for (const event of input.events) {
    if (event.proposalId !== input.proposal.proposalId) {
      return currentStateError({
        code: "invalid_history",
        message: "Approval event proposalId must match the proposal record.",
        reasonCode: "invalid_history:proposal_id_mismatch",
      });
    }

    if (event.approvalId !== input.proposal.approvalId) {
      return currentStateError({
        code: "invalid_history",
        message: "Approval event approvalId must match the proposal record.",
        reasonCode: "invalid_history:approval_id_mismatch",
      });
    }

    if (
      !Number.isInteger(event.eventSequence) ||
      event.eventSequence <= 0
    ) {
      return currentStateError({
        code: "invalid_history",
        message: "Event sequence must be a positive integer.",
        reasonCode: "invalid_history:event_sequence_invalid",
      });
    }

    if (seenSequences.has(event.eventSequence)) {
      return currentStateError({
        code: "invalid_history",
        message: "Event sequence must be unique within an approval lifecycle.",
        reasonCode: "invalid_history:duplicate_event_sequence",
      });
    }
    seenSequences.add(event.eventSequence);

    if (!isKnownEventType(event.eventType)) {
      return currentStateError({
        code: "invalid_history",
        message: "Approval event type is not part of the lifecycle vocabulary.",
        reasonCode: "invalid_history:unknown_event_type",
      });
    }
  }

  return null;
}

function validatePersistenceModel(input: {
  proposal: SocialOwnerApprovalProposalRecord;
  events: readonly SocialOwnerApprovalEventRecord[];
}): OwnerApprovalCurrentStateError | null {
  const validation = validateSocialOwnerApprovalPersistenceModel({
    proposal: input.proposal,
    events: input.events,
  });

  if (validation.ok) return null;

  const persistenceErrors: readonly SocialOwnerApprovalPersistenceError[] =
    validation.errors;
  const replayErrors = persistenceErrors.filter((error) =>
    isReplayPersistenceErrorCode(error.code),
  );

  if (replayErrors.length > 0) {
    const reasonCode = replayErrors.some(
      (error) => error.code === "event_sequence_invalid",
    )
      ? "invalid_history:duplicate_event_sequence"
      : replayErrors.some((error) => error.code === "event_scope_mismatch")
        ? "invalid_history:proposal_id_mismatch"
        : replayErrors.some((error) => error.code === "event_type_invalid")
          ? "invalid_history:unknown_event_type"
          : "invalid_history:persistence_validation_failed";

    return currentStateError({
      code: "invalid_history",
      message: "Approval event history failed replay validation.",
      reasonCode,
    });
  }

  return currentStateError({
    code: "proposal_validation_failed",
    message: "Owner approval proposal failed persistence validation.",
    reasonCode: "proposal_validation_failed",
  });
}

function replayEvents(
  proposal: SocialOwnerApprovalProposalRecord,
  events: readonly SocialOwnerApprovalEventRecord[],
): OwnerApprovalComputedCurrentState {
  const orderedEvents = [...events].sort(
    (left, right) => left.eventSequence - right.eventSequence,
  );

  let lifecycleStatus: OwnerApprovalLifecycleStatus = "no_events";
  let decisionStatus: OwnerApprovalDecisionStatus = "none";
  let latestEventId: SocialOwnerApprovalEventId | null = null;
  let latestEventSequence: number | null = null;
  let latestDecisionEventId: SocialOwnerApprovalEventId | null = null;
  let latestDecisionKind: OwnerApprovalDecisionKind | null = null;
  let requestedAt: string | null = null;
  let decidedAt: string | null = null;
  let revokedAt: string | null = null;
  let reasonCode = "computed:no_events";

  for (const event of orderedEvents) {
    lifecycleStatus = EVENT_LIFECYCLE_STATUS[event.eventType];
    latestEventId = event.eventId;
    latestEventSequence = event.eventSequence;
    reasonCode = `computed:replay_latest_event:${event.eventType}`;

    if (event.eventType === "approval_requested") {
      requestedAt = event.occurredAt;
      decisionStatus = "none";
      latestDecisionEventId = null;
      latestDecisionKind = null;
      decidedAt = null;
      revokedAt = null;
      continue;
    }

    if (event.eventType === "approval_approved") {
      decisionStatus = "approved";
      latestDecisionEventId = event.eventId;
      latestDecisionKind = DECISION_EVENT_KIND.approval_approved;
      decidedAt = event.occurredAt;
      revokedAt = null;
      continue;
    }

    if (event.eventType === "approval_rejected") {
      decisionStatus = "rejected";
      latestDecisionEventId = event.eventId;
      latestDecisionKind = DECISION_EVENT_KIND.approval_rejected;
      decidedAt = event.occurredAt;
      revokedAt = null;
      continue;
    }

    if (event.eventType === "approval_revoked") {
      decisionStatus = "revoked";
      latestDecisionEventId = event.eventId;
      latestDecisionKind = DECISION_EVENT_KIND.approval_revoked;
      revokedAt = event.occurredAt;
      continue;
    }

    latestDecisionEventId = null;
    latestDecisionKind = null;
  }

  return {
    proposalId: proposal.proposalId,
    approvalId: proposal.approvalId,
    lifecycleStatus,
    decisionStatus,
    latestEventId,
    latestEventSequence,
    latestDecisionEventId,
    latestDecisionKind,
    requestedAt,
    decidedAt,
    revokedAt,
    reasonCode,
    computedOnly: true,
  };
}

function noEventsState(
  proposal: SocialOwnerApprovalProposalRecord,
): OwnerApprovalComputedCurrentState {
  return {
    proposalId: proposal.proposalId,
    approvalId: proposal.approvalId,
    lifecycleStatus: "no_events",
    decisionStatus: "none",
    latestEventId: null,
    latestEventSequence: null,
    latestDecisionEventId: null,
    latestDecisionKind: null,
    requestedAt: null,
    decidedAt: null,
    revokedAt: null,
    reasonCode: "computed:no_events",
    computedOnly: true,
  };
}

export function computeOwnerApprovalCurrentState(
  input: OwnerApprovalCurrentStateInput,
): OwnerApprovalCurrentStateResult {
  if (input.events.length === 0) {
    const persistenceError = validatePersistenceModel(input);
    if (persistenceError) {
      return { ok: false, error: persistenceError };
    }

    return { ok: true, value: noEventsState(input.proposal) };
  }

  const replayError = validateReplayHistory(input);
  if (replayError) {
    return { ok: false, error: replayError };
  }

  const persistenceError = validatePersistenceModel(input);
  if (persistenceError) {
    return { ok: false, error: persistenceError };
  }

  return {
    ok: true,
    value: replayEvents(input.proposal, input.events),
  };
}
