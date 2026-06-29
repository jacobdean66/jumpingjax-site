import type {
  OwnerApprovalComputedCurrentState,
  OwnerApprovalLifecycleStatus,
} from "./social-owner-approval-current-state";

export type OwnerApprovalStatusKind =
  | "not_requested"
  | "requested"
  | "approved"
  | "rejected"
  | "revoked"
  | "expired"
  | "superseded"
  | "invalid_history"
  | "unavailable";

export type OwnerApprovalBadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

export type OwnerApprovalStatusView = Readonly<{
  statusLabel: string;
  statusKind: OwnerApprovalStatusKind;
  badgeTone: OwnerApprovalBadgeTone;
  ownerActionRequired: boolean;
  canBeSubmittedForApproval: boolean;
  canBePublishedSignalOnly: Readonly<{
    signal: boolean;
    authoritative: false;
    computedOnly: true;
    notPublicationPermission: true;
  }>;
  computedOnly: true;
  authoritative: false;
}>;

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

const STATUS_LABEL: Readonly<Record<OwnerApprovalStatusKind, string>> = {
  not_requested: "Approval not requested",
  requested: "Awaiting owner approval",
  approved: "Approved by owner",
  rejected: "Rejected by owner",
  revoked: "Approval revoked",
  expired: "Approval expired",
  superseded: "Approval superseded",
  invalid_history: "Invalid approval history",
  unavailable: "Approval status unavailable",
};

const BADGE_TONE: Readonly<Record<OwnerApprovalStatusKind, OwnerApprovalBadgeTone>> =
  {
    not_requested: "neutral",
    requested: "info",
    approved: "success",
    rejected: "danger",
    revoked: "danger",
    expired: "warning",
    superseded: "warning",
    invalid_history: "danger",
    unavailable: "neutral",
  };

const CAN_BE_PUBLISHED_SIGNAL_ONLY_FALSE = {
  signal: false,
  authoritative: false as const,
  computedOnly: true as const,
  notPublicationPermission: true as const,
};

const CAN_BE_PUBLISHED_SIGNAL_ONLY_TRUE = {
  signal: true,
  authoritative: false as const,
  computedOnly: true as const,
  notPublicationPermission: true as const,
};

function buildStatusView(input: {
  statusKind: OwnerApprovalStatusKind;
  statusLabel?: string;
}): OwnerApprovalStatusView {
  const { statusKind } = input;

  return {
    statusLabel: input.statusLabel ?? STATUS_LABEL[statusKind],
    statusKind,
    badgeTone: BADGE_TONE[statusKind],
    ownerActionRequired: statusKind === "requested",
    canBeSubmittedForApproval: statusKind === "not_requested",
    canBePublishedSignalOnly:
      statusKind === "approved"
        ? CAN_BE_PUBLISHED_SIGNAL_ONLY_TRUE
        : CAN_BE_PUBLISHED_SIGNAL_ONLY_FALSE,
    computedOnly: true,
    authoritative: false,
  };
}

export function getOwnerApprovalStatusKind(
  lifecycleStatus: OwnerApprovalLifecycleStatus,
): OwnerApprovalStatusKind {
  return LIFECYCLE_TO_STATUS_KIND[lifecycleStatus];
}

export function projectOwnerApprovalStatusView(
  state: OwnerApprovalComputedCurrentState,
): OwnerApprovalStatusView {
  return buildStatusView({
    statusKind: getOwnerApprovalStatusKind(state.lifecycleStatus),
  });
}

export function projectOwnerApprovalStatusViewUnavailable(): OwnerApprovalStatusView {
  return buildStatusView({ statusKind: "unavailable" });
}

export function projectOwnerApprovalStatusViewInvalidHistory(
  reasonCode?: string,
): OwnerApprovalStatusView {
  const trimmedReasonCode = reasonCode?.trim();
  const statusLabel = trimmedReasonCode
    ? `${STATUS_LABEL.invalid_history} (${trimmedReasonCode})`
    : STATUS_LABEL.invalid_history;

  return buildStatusView({
    statusKind: "invalid_history",
    statusLabel,
  });
}
