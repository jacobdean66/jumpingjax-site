import type { OwnerApprovalLifecycleStatus } from "./social-owner-approval-current-state";
import type {
  SocialOwnerApprovalApprovalId,
  SocialOwnerApprovalProposalId,
} from "./social-owner-approval-persistence";
import type { OwnerApprovalStateServiceResult } from "./social-owner-approval-state-service";
import type {
  OwnerApprovalBadgeTone,
  OwnerApprovalStatusKind,
  OwnerApprovalStatusView,
} from "./social-owner-approval-status-view";
import { projectOwnerApprovalStatusViewUnavailable } from "./social-owner-approval-status-view";

export const OWNER_APPROVAL_SUMMARY_ERROR_CODES = [
  "state_unavailable",
  "status_view_mismatch",
] as const;

export type OwnerApprovalSummaryErrorCode =
  (typeof OWNER_APPROVAL_SUMMARY_ERROR_CODES)[number];

export type OwnerApprovalSummaryError = Readonly<{
  code: OwnerApprovalSummaryErrorCode;
  message: string;
}>;

export type OwnerApprovalSummary = Readonly<{
  proposalId: SocialOwnerApprovalProposalId | null;
  approvalId: SocialOwnerApprovalApprovalId | null;
  statusKind: OwnerApprovalStatusKind;
  statusLabel: string;
  badgeTone: OwnerApprovalBadgeTone;
  ownerActionRequired: boolean;
  canBeSubmittedForApproval: boolean;
  canBePublishedSignalOnly: OwnerApprovalStatusView["canBePublishedSignalOnly"];
  source: "owner_approval_computed_state";
  computedOnly: true;
  authoritative: false;
  approvesNothing: true;
  publishesNothing: true;
  schedulesNothing: true;
  notPublicationPermission: true;
}>;

export type OwnerApprovalSummaryInput = Readonly<{
  stateResult: OwnerApprovalStateServiceResult;
  statusView: OwnerApprovalStatusView;
}>;

export type OwnerApprovalSummaryResult =
  | Readonly<{ ok: true; value: OwnerApprovalSummary }>
  | Readonly<{ ok: false; error: OwnerApprovalSummaryError }>;

const LIFECYCLE_TO_STATUS_KIND: Readonly<
  Record<OwnerApprovalLifecycleStatus, OwnerApprovalStatusKind>
> = {
  no_events: "not_requested",
  requested: "requested",
  approved: "approved",
  rejected: "rejected",
  revoked: "revoked",
  expired: "expired",
  superseded: "superseded",
};

function expectedStatusKind(
  lifecycleStatus: OwnerApprovalLifecycleStatus,
): OwnerApprovalStatusKind {
  return LIFECYCLE_TO_STATUS_KIND[lifecycleStatus];
}

function buildSummaryFromStatusView(input: {
  proposalId: SocialOwnerApprovalProposalId | null;
  approvalId: SocialOwnerApprovalApprovalId | null;
  statusView: OwnerApprovalStatusView;
}): OwnerApprovalSummary {
  const { proposalId, approvalId, statusView } = input;

  return {
    proposalId,
    approvalId,
    statusKind: statusView.statusKind,
    statusLabel: statusView.statusLabel,
    badgeTone: statusView.badgeTone,
    ownerActionRequired: statusView.ownerActionRequired,
    canBeSubmittedForApproval: statusView.canBeSubmittedForApproval,
    canBePublishedSignalOnly: statusView.canBePublishedSignalOnly,
    source: "owner_approval_computed_state",
    computedOnly: true,
    authoritative: false,
    approvesNothing: true,
    publishesNothing: true,
    schedulesNothing: true,
    notPublicationPermission: true,
  };
}

export function buildOwnerApprovalSummary(
  input: OwnerApprovalSummaryInput,
): OwnerApprovalSummaryResult {
  const { stateResult, statusView } = input;

  if ("error" in stateResult) {
    return {
      ok: false,
      error: {
        code: "state_unavailable",
        message: stateResult.error.message,
      },
    };
  }

  const state = stateResult.value;
  const expectedKind = expectedStatusKind(state.lifecycleStatus);

  if (statusView.statusKind !== expectedKind) {
    return {
      ok: false,
      error: {
        code: "status_view_mismatch",
        message: `Status view kind "${statusView.statusKind}" does not match lifecycle status "${state.lifecycleStatus}" (expected "${expectedKind}")`,
      },
    };
  }

  return {
    ok: true,
    value: buildSummaryFromStatusView({
      proposalId: state.proposalId,
      approvalId: state.approvalId,
      statusView,
    }),
  };
}

export function buildOwnerApprovalSummaryUnavailable(input?: {
  reasonCode?: string;
}): OwnerApprovalSummary {
  void input;

  return buildSummaryFromStatusView({
    proposalId: null,
    approvalId: null,
    statusView: projectOwnerApprovalStatusViewUnavailable(),
  });
}
