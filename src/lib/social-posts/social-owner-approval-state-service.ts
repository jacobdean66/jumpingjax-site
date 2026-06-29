import "server-only";

import {
  computeOwnerApprovalCurrentState,
  type OwnerApprovalComputedCurrentState,
  type OwnerApprovalCurrentStateError,
  type OwnerApprovalCurrentStateInput,
} from "./social-owner-approval-current-state";
import type {
  SocialOwnerApprovalApprovalId,
  SocialOwnerApprovalEventRecord,
  SocialOwnerApprovalProposalId,
  SocialOwnerApprovalProposalRecord,
} from "./social-owner-approval-persistence";
import {
  getOwnerApprovalProposalByApprovalId,
  getOwnerApprovalProposalById,
  listOwnerApprovalEventsByApprovalId,
  listOwnerApprovalEventsByProposalId,
  type SocialOwnerApprovalRepositoryError,
  type SocialOwnerApprovalRepositoryResult,
} from "./social-owner-approval-store";

export const OWNER_APPROVAL_STATE_SERVICE_ERROR_CODES = [
  "proposal_not_found",
  "events_read_failed",
  "compute_failed",
  "repository_error",
] as const;

export type OwnerApprovalStateServiceErrorCode =
  (typeof OWNER_APPROVAL_STATE_SERVICE_ERROR_CODES)[number];

export type OwnerApprovalStateServiceError = Readonly<{
  code: OwnerApprovalStateServiceErrorCode;
  message: string;
  repositoryError?: SocialOwnerApprovalRepositoryError;
  computeError?: OwnerApprovalCurrentStateError;
}>;

export type OwnerApprovalStateServiceResult =
  | Readonly<{ ok: true; value: OwnerApprovalComputedCurrentState }>
  | Readonly<{ ok: false; error: OwnerApprovalStateServiceError }>;

export type OwnerApprovalStateServiceDependencies = Readonly<{
  getProposalById(
    proposalId: SocialOwnerApprovalProposalId,
  ): Promise<SocialOwnerApprovalRepositoryResult<SocialOwnerApprovalProposalRecord>>;
  getProposalByApprovalId(
    approvalId: SocialOwnerApprovalApprovalId,
  ): Promise<SocialOwnerApprovalRepositoryResult<SocialOwnerApprovalProposalRecord>>;
  listEventsByProposalId(
    proposalId: SocialOwnerApprovalProposalId,
  ): Promise<SocialOwnerApprovalRepositoryResult<SocialOwnerApprovalEventRecord[]>>;
  listEventsByApprovalId(
    approvalId: SocialOwnerApprovalApprovalId,
  ): Promise<SocialOwnerApprovalRepositoryResult<SocialOwnerApprovalEventRecord[]>>;
}>;

function stateServiceError(input: {
  code: OwnerApprovalStateServiceErrorCode;
  message: string;
  repositoryError?: SocialOwnerApprovalRepositoryError;
  computeError?: OwnerApprovalCurrentStateError;
}): OwnerApprovalStateServiceError {
  return input;
}

function defaultDependencies(): OwnerApprovalStateServiceDependencies {
  return {
    getProposalById: getOwnerApprovalProposalById,
    getProposalByApprovalId: getOwnerApprovalProposalByApprovalId,
    listEventsByProposalId: listOwnerApprovalEventsByProposalId,
    listEventsByApprovalId: listOwnerApprovalEventsByApprovalId,
  };
}

function mapProposalReadError(
  error: SocialOwnerApprovalRepositoryError,
): OwnerApprovalStateServiceError {
  if (error.code === "not_found") {
    return stateServiceError({
      code: "proposal_not_found",
      message: error.message,
      repositoryError: error,
    });
  }

  return stateServiceError({
    code: "repository_error",
    message: error.message,
    repositoryError: error,
  });
}

function mapEventsReadError(
  error: SocialOwnerApprovalRepositoryError,
): OwnerApprovalStateServiceError {
  return stateServiceError({
    code: "events_read_failed",
    message: error.message,
    repositoryError: error,
  });
}

function mapComputeError(
  error: OwnerApprovalCurrentStateError,
): OwnerApprovalStateServiceError {
  return stateServiceError({
    code: "compute_failed",
    message: error.message,
    computeError: error,
  });
}

export function getOwnerApprovalCurrentState(
  input: OwnerApprovalCurrentStateInput,
): OwnerApprovalStateServiceResult {
  const result = computeOwnerApprovalCurrentState(input);

  if ("error" in result) {
    return { ok: false, error: mapComputeError(result.error) };
  }

  return { ok: true, value: result.value };
}

export async function getOwnerApprovalCurrentStateByProposalId(input: {
  proposalId: SocialOwnerApprovalProposalId;
  dependencies?: OwnerApprovalStateServiceDependencies;
}): Promise<OwnerApprovalStateServiceResult> {
  const dependencies = input.dependencies ?? defaultDependencies();
  const proposalRead = await dependencies.getProposalById(input.proposalId);

  if (proposalRead.ok === false) {
    return { ok: false, error: mapProposalReadError(proposalRead.error) };
  }

  const eventsRead = await dependencies.listEventsByProposalId(input.proposalId);

  if (eventsRead.ok === false) {
    return { ok: false, error: mapEventsReadError(eventsRead.error) };
  }

  return getOwnerApprovalCurrentState({
    proposal: proposalRead.value,
    events: eventsRead.value,
  });
}

export async function getOwnerApprovalCurrentStateByApprovalId(input: {
  approvalId: SocialOwnerApprovalApprovalId;
  dependencies?: OwnerApprovalStateServiceDependencies;
}): Promise<OwnerApprovalStateServiceResult> {
  const dependencies = input.dependencies ?? defaultDependencies();
  const proposalRead = await dependencies.getProposalByApprovalId(input.approvalId);

  if (proposalRead.ok === false) {
    return { ok: false, error: mapProposalReadError(proposalRead.error) };
  }

  const eventsRead = await dependencies.listEventsByApprovalId(input.approvalId);

  if (eventsRead.ok === false) {
    return { ok: false, error: mapEventsReadError(eventsRead.error) };
  }

  return getOwnerApprovalCurrentState({
    proposal: proposalRead.value,
    events: eventsRead.value,
  });
}
