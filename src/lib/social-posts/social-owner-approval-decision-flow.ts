import {
  evaluateOwnerApprovalAuthorization,
  type OwnerApprovalActor,
} from "./social-owner-approval-authorization";
import {
  appendOwnerApprovalEvent,
  getOwnerApprovalProposalById,
  type SocialOwnerApprovalRepositoryError,
  type SocialOwnerApprovalRepositoryResult,
} from "./social-owner-approval-store";
import {
  validateSocialOwnerApprovalPersistenceModel,
  type SocialOwnerApprovalApprovalId,
  type SocialOwnerApprovalEventId,
  type SocialOwnerApprovalEventRecord,
  type SocialOwnerApprovalJsonObject,
  type SocialOwnerApprovalPersistenceError,
  type SocialOwnerApprovalProposalId,
  type SocialOwnerApprovalProposalRecord,
} from "./social-owner-approval-persistence";

export const OWNER_APPROVAL_DECISION_ERROR_CODES = [
  "proposal_context_missing",
  "authorization_denied",
  "validation_failed",
  "event_append_failed",
] as const;

export type OwnerApprovalDecisionErrorCode =
  (typeof OWNER_APPROVAL_DECISION_ERROR_CODES)[number];

export type OwnerApprovalDecisionKind = "approve" | "reject" | "revoke";

export type OwnerApprovalDecisionInput = Readonly<{
  proposalId: SocialOwnerApprovalProposalId;
  approvalId: SocialOwnerApprovalApprovalId;
  decisionEventId: SocialOwnerApprovalEventId;
  decisionKind: OwnerApprovalDecisionKind;
  actor: OwnerApprovalActor;
  occurredAt: string;
  eventSequence: number;
  reason: string | null;
  context: SocialOwnerApprovalJsonObject;
}>;

export type OwnerApprovalDecisionError = Readonly<{
  code: OwnerApprovalDecisionErrorCode;
  message: string;
  authorizationCode?: string;
  validationErrors?: readonly SocialOwnerApprovalPersistenceError[];
  repositoryError?: SocialOwnerApprovalRepositoryError;
}>;

export type OwnerApprovalDecisionResult =
  | Readonly<{
      ok: true;
      value: SocialOwnerApprovalEventRecord;
    }>
  | Readonly<{
      ok: false;
      error: OwnerApprovalDecisionError;
    }>;

export type OwnerApprovalDecisionFlowDependencies = Readonly<{
  getProposal(
    proposalId: SocialOwnerApprovalProposalId,
  ): Promise<SocialOwnerApprovalRepositoryResult<SocialOwnerApprovalProposalRecord>>;
  appendEvent(input: {
    proposal: SocialOwnerApprovalProposalRecord;
    event: SocialOwnerApprovalEventRecord;
  }): Promise<SocialOwnerApprovalRepositoryResult<SocialOwnerApprovalEventRecord>>;
}>;

const DECISION_CONFIG: Readonly<
  Record<
    OwnerApprovalDecisionKind,
    Readonly<{
      action: "approve_owner_approval" | "reject_owner_approval" | "revoke_owner_approval";
      eventType: "approval_approved" | "approval_rejected" | "approval_revoked";
    }>
  >
> = {
  approve: {
    action: "approve_owner_approval",
    eventType: "approval_approved",
  },
  reject: {
    action: "reject_owner_approval",
    eventType: "approval_rejected",
  },
  revoke: {
    action: "revoke_owner_approval",
    eventType: "approval_revoked",
  },
};

function decisionError(input: {
  code: OwnerApprovalDecisionErrorCode;
  message: string;
  authorizationCode?: string;
  validationErrors?: readonly SocialOwnerApprovalPersistenceError[];
  repositoryError?: SocialOwnerApprovalRepositoryError;
}): OwnerApprovalDecisionError {
  return input;
}

function defaultDependencies(): OwnerApprovalDecisionFlowDependencies {
  return {
    getProposal: getOwnerApprovalProposalById,
    appendEvent: appendOwnerApprovalEvent,
  };
}

function prepareDecisionEvent(input: {
  decision: OwnerApprovalDecisionInput;
  proposal: SocialOwnerApprovalProposalRecord;
}): SocialOwnerApprovalEventRecord {
  const actorSnapshot = input.decision.actor.authoritySnapshot;

  if (!actorSnapshot) {
    throw new Error("Owner approval decision requires actor authority.");
  }

  return {
    eventId: input.decision.decisionEventId,
    approvalId: input.decision.approvalId,
    proposalId: input.decision.proposalId,
    proposalFingerprint: input.proposal.proposalFingerprint,
    eventType: DECISION_CONFIG[input.decision.decisionKind].eventType,
    actorSnapshot,
    eventReason: input.decision.reason,
    occurredAt: input.decision.occurredAt,
    eventSequence: input.decision.eventSequence,
    eventMetadata: {
      source: "owner_approval_lifecycle",
      context: input.decision.context,
    },
  };
}

export async function decideOwnerApproval(input: {
  decision: OwnerApprovalDecisionInput;
  dependencies?: OwnerApprovalDecisionFlowDependencies;
}): Promise<OwnerApprovalDecisionResult> {
  const dependencies = input.dependencies ?? defaultDependencies();
  const proposalRead = await dependencies.getProposal(input.decision.proposalId);

  if (proposalRead.ok === false) {
    return {
      ok: false,
      error: decisionError({
        code: "proposal_context_missing",
        message: proposalRead.error.message,
        repositoryError: proposalRead.error,
      }),
    };
  }

  const proposal = proposalRead.value;
  const authorization = evaluateOwnerApprovalAuthorization({
    actor: input.decision.actor,
    action: DECISION_CONFIG[input.decision.decisionKind].action,
    context: {
      proposalId: proposal.proposalId,
      approvalId: proposal.approvalId,
      socialPostId: proposal.socialPostId,
      campaignId: proposal.proposalScope.campaignId,
      manifestId: input.decision.actor.authorityScope?.manifestId ?? null,
      proposalScope: proposal.proposalScope,
      requiresOwnerAuthority: true,
    },
  });

  if (!authorization.allowed) {
    return {
      ok: false,
      error: decisionError({
        code: "authorization_denied",
        message: authorization.reason,
        authorizationCode: authorization.code,
      }),
    };
  }

  const event = prepareDecisionEvent({
    decision: input.decision,
    proposal,
  });
  const validation = validateSocialOwnerApprovalPersistenceModel({
    proposal,
    events: [event],
  });

  if (!validation.ok) {
    return {
      ok: false,
      error: decisionError({
        code: "validation_failed",
        message: "Owner approval decision failed persistence validation.",
        validationErrors: validation.errors,
      }),
    };
  }

  const append = await dependencies.appendEvent({
    proposal,
    event,
  });

  if (append.ok === false) {
    return {
      ok: false,
      error: decisionError({
        code: "event_append_failed",
        message: append.error.message,
        repositoryError: append.error,
      }),
    };
  }

  return { ok: true, value: append.value };
}
