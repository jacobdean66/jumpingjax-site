import {
  evaluateOwnerApprovalAuthorization,
  type OwnerApprovalActor,
} from "./social-owner-approval-authorization";
import {
  appendOwnerApprovalEvent,
  createOwnerApprovalProposal,
  type SocialOwnerApprovalRepositoryError,
  type SocialOwnerApprovalRepositoryResult,
} from "./social-owner-approval-store";
import {
  validateSocialOwnerApprovalPersistenceModel,
  type SocialOwnerApprovalApprovalId,
  type SocialOwnerApprovalAssetReference,
  type SocialOwnerApprovalEventId,
  type SocialOwnerApprovalEventRecord,
  type SocialOwnerApprovalJsonObject,
  type SocialOwnerApprovalPersistenceError,
  type SocialOwnerApprovalProposalFingerprint,
  type SocialOwnerApprovalProposalId,
  type SocialOwnerApprovalProposalRecord,
  type SocialOwnerApprovalProposalScope,
  type SocialOwnerApprovalProposalVersion,
  type SocialOwnerApprovalSocialPostId,
} from "./social-owner-approval-persistence";

export const OWNER_APPROVAL_REQUEST_ERROR_CODES = [
  "authorization_denied",
  "validation_failed",
  "proposal_write_failed",
  "event_write_failed",
] as const;

export type OwnerApprovalRequestErrorCode =
  (typeof OWNER_APPROVAL_REQUEST_ERROR_CODES)[number];

export type OwnerApprovalScopedReference = Readonly<{
  id: string;
  kind: "publication_manifest" | "eligibility_summary";
  fingerprint: string | null;
}>;

export type OwnerApprovalRequestInput = Readonly<{
  proposalId: SocialOwnerApprovalProposalId;
  approvalId: SocialOwnerApprovalApprovalId;
  requestEventId: SocialOwnerApprovalEventId;
  socialPostId: SocialOwnerApprovalSocialPostId;
  proposalFingerprint: SocialOwnerApprovalProposalFingerprint;
  proposalVersion: SocialOwnerApprovalProposalVersion;
  campaignId: string | null;
  platforms: readonly string[];
  actor: OwnerApprovalActor;
  createdAt: string;
  requestedAt: string;
  reviewedSnapshot: Readonly<{
    title: string | null;
    caption: string | null;
    mediaType: "image" | "video";
    businessFocus: string | null;
    socialPostStatusAtRequest: string;
    mediaReference: SocialOwnerApprovalAssetReference | null;
    selectedAssetReferences: readonly SocialOwnerApprovalAssetReference[];
    approvedAssetReferences: readonly SocialOwnerApprovalAssetReference[];
    humanSummary: string;
  }>;
  manifestReference: OwnerApprovalScopedReference | null;
  eligibilityReference: OwnerApprovalScopedReference | null;
  warningCodes: readonly string[];
  notes: string | null;
  context: SocialOwnerApprovalJsonObject;
}>;

export type PreparedOwnerApprovalRequest = Readonly<{
  proposal: SocialOwnerApprovalProposalRecord;
  requestEvent: SocialOwnerApprovalEventRecord;
}>;

export type OwnerApprovalRequestError = Readonly<{
  code: OwnerApprovalRequestErrorCode;
  message: string;
  authorizationCode?: string;
  validationErrors?: readonly SocialOwnerApprovalPersistenceError[];
  repositoryError?: SocialOwnerApprovalRepositoryError;
}>;

export type OwnerApprovalRequestResult =
  | Readonly<{
      ok: true;
      value: PreparedOwnerApprovalRequest;
    }>
  | Readonly<{
      ok: false;
      error: OwnerApprovalRequestError;
    }>;

export type OwnerApprovalRequestFlowDependencies = Readonly<{
  createProposal(
    proposal: SocialOwnerApprovalProposalRecord,
  ): Promise<SocialOwnerApprovalRepositoryResult<SocialOwnerApprovalProposalRecord>>;
  appendEvent(input: {
    proposal: SocialOwnerApprovalProposalRecord;
    event: SocialOwnerApprovalEventRecord;
  }): Promise<SocialOwnerApprovalRepositoryResult<SocialOwnerApprovalEventRecord>>;
}>;

function requestError(input: {
  code: OwnerApprovalRequestErrorCode;
  message: string;
  authorizationCode?: string;
  validationErrors?: readonly SocialOwnerApprovalPersistenceError[];
  repositoryError?: SocialOwnerApprovalRepositoryError;
}): OwnerApprovalRequestError {
  return input;
}

function defaultDependencies(): OwnerApprovalRequestFlowDependencies {
  return {
    createProposal: createOwnerApprovalProposal,
    appendEvent: appendOwnerApprovalEvent,
  };
}

function proposalScope(
  input: OwnerApprovalRequestInput,
): SocialOwnerApprovalProposalScope {
  return {
    socialPostId: input.socialPostId,
    proposalFingerprint: input.proposalFingerprint,
    proposalVersion: input.proposalVersion,
    campaignId: input.campaignId,
    platforms: input.platforms,
  };
}

function requestContext(
  input: OwnerApprovalRequestInput,
): SocialOwnerApprovalJsonObject {
  return {
    ...input.context,
    scopedReferences: {
      manifestReference: input.manifestReference,
      eligibilityReference: input.eligibilityReference,
    },
  };
}

export function prepareOwnerApprovalRequestProposal(
  input: OwnerApprovalRequestInput,
): PreparedOwnerApprovalRequest {
  const scope = proposalScope(input);
  const actorSnapshot = input.actor.authoritySnapshot;

  if (!actorSnapshot) {
    throw new Error("Owner approval request preparation requires actor authority.");
  }

  const proposal: SocialOwnerApprovalProposalRecord = {
    proposalId: input.proposalId,
    approvalId: input.approvalId,
    socialPostId: input.socialPostId,
    proposalFingerprint: input.proposalFingerprint,
    proposalVersion: input.proposalVersion,
    proposalScope: scope,
    snapshot: {
      socialPostId: input.socialPostId,
      proposalFingerprint: input.proposalFingerprint,
      proposalVersion: input.proposalVersion,
      title: input.reviewedSnapshot.title,
      caption: input.reviewedSnapshot.caption,
      mediaType: input.reviewedSnapshot.mediaType,
      platforms: input.platforms,
      campaignId: input.campaignId,
      businessFocus: input.reviewedSnapshot.businessFocus,
      socialPostStatusAtRequest:
        input.reviewedSnapshot.socialPostStatusAtRequest,
      mediaReference: input.reviewedSnapshot.mediaReference,
      selectedAssetReferences: input.reviewedSnapshot.selectedAssetReferences,
      approvedAssetReferences: input.reviewedSnapshot.approvedAssetReferences,
      humanSummary: input.reviewedSnapshot.humanSummary,
    },
    requestedReadinessSummary: {
      state: "ready_for_approval",
      blockerCount: 0,
      warningCodes: input.warningCodes,
      computedOnly: true,
      authoritative: false,
    },
    createdByActor: actorSnapshot,
    createdAt: input.createdAt,
    requestMetadata: {
      source: "owner_approval_request",
      notes: input.notes,
      context: requestContext(input),
    },
  };

  const requestEvent: SocialOwnerApprovalEventRecord = {
    eventId: input.requestEventId,
    approvalId: input.approvalId,
    proposalId: input.proposalId,
    proposalFingerprint: input.proposalFingerprint,
    eventType: "approval_requested",
    actorSnapshot,
    eventReason: input.notes,
    occurredAt: input.requestedAt,
    eventSequence: 1,
    eventMetadata: {
      source: "owner_approval_lifecycle",
      context: requestContext(input),
    },
  };

  return { proposal, requestEvent };
}

export async function requestOwnerApproval(input: {
  request: OwnerApprovalRequestInput;
  dependencies?: OwnerApprovalRequestFlowDependencies;
}): Promise<OwnerApprovalRequestResult> {
  const scope = proposalScope(input.request);
  const authorization = evaluateOwnerApprovalAuthorization({
    actor: input.request.actor,
    action: "request_owner_approval",
    context: {
      proposalId: input.request.proposalId,
      approvalId: input.request.approvalId,
      socialPostId: input.request.socialPostId,
      campaignId: input.request.campaignId,
      manifestId: input.request.manifestReference?.id ?? null,
      proposalScope: scope,
      requiresOwnerAuthority: true,
    },
  });

  if (!authorization.allowed) {
    return {
      ok: false,
      error: requestError({
        code: "authorization_denied",
        message: authorization.reason,
        authorizationCode: authorization.code,
      }),
    };
  }

  const prepared = prepareOwnerApprovalRequestProposal(input.request);
  const validation = validateSocialOwnerApprovalPersistenceModel({
    proposal: prepared.proposal,
    events: [prepared.requestEvent],
  });

  if (!validation.ok) {
    return {
      ok: false,
      error: requestError({
        code: "validation_failed",
        message: "Owner approval request failed persistence validation.",
        validationErrors: validation.errors,
      }),
    };
  }

  const dependencies = input.dependencies ?? defaultDependencies();
  const proposalWrite = await dependencies.createProposal(prepared.proposal);
  if (proposalWrite.ok === false) {
    return {
      ok: false,
      error: requestError({
        code: "proposal_write_failed",
        message: proposalWrite.error.message,
        repositoryError: proposalWrite.error,
      }),
    };
  }

  const eventWrite = await dependencies.appendEvent({
    proposal: proposalWrite.value,
    event: prepared.requestEvent,
  });

  if (eventWrite.ok === false) {
    return {
      ok: false,
      error: requestError({
        code: "event_write_failed",
        message: eventWrite.error.message,
        repositoryError: eventWrite.error,
      }),
    };
  }

  return {
    ok: true,
    value: {
      proposal: proposalWrite.value,
      requestEvent: eventWrite.value,
    },
  };
}
