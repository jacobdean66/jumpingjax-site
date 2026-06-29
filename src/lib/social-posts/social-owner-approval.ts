export const APPROVAL_STATUSES = [
  "not_requested",
  "requested",
  "approved",
  "rejected",
  "revoked",
  "expired",
  "superseded",
] as const;

export const APPROVAL_EVENT_TYPES = [
  "approval_requested",
  "approval_approved",
  "approval_rejected",
  "approval_revoked",
  "approval_expired",
  "approval_superseded",
] as const;

export const APPROVAL_ACTOR_TYPES = ["human", "ai", "system"] as const;

export const APPROVAL_AUTHORITY_ROLES = [
  "owner",
  "admin",
  "ai",
  "system",
] as const;

export const APPROVAL_ERROR_CODES = [
  "readiness_required",
  "approval_authority_required",
  "ai_cannot_approve",
  "illegal_transition",
  "proposal_scope_mismatch",
  "proposal_changed",
  "approval_not_active",
  "approval_terminal",
  "multiple_active_approvals",
] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export type ApprovalEventType = (typeof APPROVAL_EVENT_TYPES)[number];
export type ApprovalActorType = (typeof APPROVAL_ACTOR_TYPES)[number];
export type ApprovalAuthorityRole =
  (typeof APPROVAL_AUTHORITY_ROLES)[number];
export type ApprovalErrorCode = (typeof APPROVAL_ERROR_CODES)[number];

export type ApprovalAuthority = Readonly<{
  actorId: string;
  actorType: ApprovalActorType;
  role: ApprovalAuthorityRole;
  canApprove: boolean;
}>;

export type ProposalIdentity = Readonly<{
  socialPostId: string;
  proposalFingerprint: string;
  version: string;
}>;

export type ApprovalIdentity = Readonly<{
  approvalId: string;
  proposal: ProposalIdentity;
}>;

export type ApprovalScope = Readonly<{
  approval: ApprovalIdentity;
  proposal: ProposalIdentity;
}>;

export type ApprovalDecision = Readonly<{
  eventType: ApprovalEventType;
  authority: ApprovalAuthority;
  proposal: ProposalIdentity;
  reason?: string;
}>;

export type ApprovalTransition = Readonly<{
  from: ApprovalStatus;
  eventType: ApprovalEventType;
  to: ApprovalStatus;
}>;

export type ApprovalError = Readonly<{
  code: ApprovalErrorCode;
  message: string;
}>;

export type ApprovalResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; errors: readonly ApprovalError[] }>;

export type ApprovalValidity = Readonly<{
  valid: boolean;
  status: ApprovalStatus;
  proposalChanged: boolean;
  reasons: readonly ApprovalError[];
}>;

export type ApprovalLifecycle = Readonly<{
  status: ApprovalStatus;
  proposal: ProposalIdentity;
  activeApprovalCount: number;
}>;

export type ApprovalInvariant = Readonly<{
  code: ApprovalErrorCode;
  label: string;
  description: string;
}>;

export const APPROVAL_INVARIANTS: readonly ApprovalInvariant[] = [
  {
    code: "approval_authority_required",
    label: "Human owner authority required",
    description: "Only an authorized human owner can approve, reject, or revoke.",
  },
  {
    code: "ai_cannot_approve",
    label: "AI cannot approve",
    description: "AI may prepare, recommend, and explain, but it cannot approve.",
  },
  {
    code: "readiness_required",
    label: "Readiness required",
    description: "Approval may only be requested after readiness is ready_for_approval.",
  },
  {
    code: "proposal_scope_mismatch",
    label: "Proposal scoped",
    description: "Approval authority applies only to the proposal identity that was approved.",
  },
  {
    code: "proposal_changed",
    label: "Proposal changes invalidate approval",
    description: "A changed proposal identity invalidates the prior approval.",
  },
  {
    code: "multiple_active_approvals",
    label: "One active approval",
    description: "A proposal identity may have only one active approval.",
  },
];

export const APPROVAL_TRANSITIONS: readonly ApprovalTransition[] = [
  {
    from: "not_requested",
    eventType: "approval_requested",
    to: "requested",
  },
  {
    from: "requested",
    eventType: "approval_approved",
    to: "approved",
  },
  {
    from: "requested",
    eventType: "approval_rejected",
    to: "rejected",
  },
  {
    from: "requested",
    eventType: "approval_expired",
    to: "expired",
  },
  {
    from: "requested",
    eventType: "approval_superseded",
    to: "superseded",
  },
  {
    from: "approved",
    eventType: "approval_revoked",
    to: "revoked",
  },
  {
    from: "approved",
    eventType: "approval_expired",
    to: "expired",
  },
  {
    from: "approved",
    eventType: "approval_superseded",
    to: "superseded",
  },
];

const TERMINAL_STATUSES = new Set<ApprovalStatus>([
  "rejected",
  "revoked",
  "expired",
  "superseded",
]);

const ACTIVE_STATUSES = new Set<ApprovalStatus>(["requested", "approved"]);

function error(code: ApprovalErrorCode, message: string): ApprovalError {
  return { code, message };
}

function sameProposalIdentity(
  left: ProposalIdentity,
  right: ProposalIdentity,
): boolean {
  return (
    left.socialPostId === right.socialPostId &&
    left.proposalFingerprint === right.proposalFingerprint &&
    left.version === right.version
  );
}

function hasOwnerApprovalAuthority(authority: ApprovalAuthority): boolean {
  return (
    authority.actorType === "human" &&
    authority.role === "owner" &&
    authority.canApprove
  );
}

export function isApprovalTerminal(status: ApprovalStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isApprovalActive(status: ApprovalStatus): boolean {
  return ACTIVE_STATUSES.has(status);
}

export function isProposalChanged(
  approvedProposal: ProposalIdentity,
  currentProposal: ProposalIdentity,
): boolean {
  return !sameProposalIdentity(approvedProposal, currentProposal);
}

export function canRequestApproval(input: {
  readinessState: "blocked" | "ready_for_approval";
  activeApprovalCount?: number;
}): boolean {
  return (
    input.readinessState === "ready_for_approval" &&
    (input.activeApprovalCount ?? 0) === 0
  );
}

export function canApprove(
  status: ApprovalStatus,
  authority: ApprovalAuthority,
): boolean {
  return status === "requested" && hasOwnerApprovalAuthority(authority);
}

export function canReject(
  status: ApprovalStatus,
  authority: ApprovalAuthority,
): boolean {
  return status === "requested" && hasOwnerApprovalAuthority(authority);
}

export function canRevoke(
  status: ApprovalStatus,
  authority: ApprovalAuthority,
): boolean {
  return status === "approved" && hasOwnerApprovalAuthority(authority);
}

export function canExpire(status: ApprovalStatus): boolean {
  return status === "requested" || status === "approved";
}

export function canSupersede(status: ApprovalStatus): boolean {
  return status === "requested" || status === "approved";
}

export function getNextLegalStates(
  status: ApprovalStatus,
): readonly ApprovalStatus[] {
  return APPROVAL_TRANSITIONS.filter(
    (transition) => transition.from === status,
  ).map((transition) => transition.to);
}

export function validateTransition(input: {
  status: ApprovalStatus;
  decision: ApprovalDecision;
  scope: ApprovalScope;
}): ApprovalResult<ApprovalTransition> {
  const errors: ApprovalError[] = [];

  if (isApprovalTerminal(input.status)) {
    errors.push(
      error("approval_terminal", "Terminal approvals cannot transition again."),
    );
  }

  if (isProposalChanged(input.scope.approval.proposal, input.scope.proposal)) {
    errors.push(
      error(
        "proposal_scope_mismatch",
        "Approval scope must match the approval identity proposal.",
      ),
    );
  }

  if (isProposalChanged(input.scope.proposal, input.decision.proposal)) {
    errors.push(
      error(
        "proposal_scope_mismatch",
        "Approval decisions must target the scoped proposal identity.",
      ),
    );
  }

  if (
    input.decision.eventType === "approval_approved" ||
    input.decision.eventType === "approval_rejected" ||
    input.decision.eventType === "approval_revoked"
  ) {
    if (input.decision.authority.actorType === "ai") {
      errors.push(error("ai_cannot_approve", "AI cannot approve."));
    }

    if (!hasOwnerApprovalAuthority(input.decision.authority)) {
      errors.push(
        error(
          "approval_authority_required",
          "Owner approval authority is required for this decision.",
        ),
      );
    }
  }

  const transition = APPROVAL_TRANSITIONS.find(
    (candidate) =>
      candidate.from === input.status &&
      candidate.eventType === input.decision.eventType,
  );

  if (!transition) {
    errors.push(
      error(
        "illegal_transition",
        `Cannot apply ${input.decision.eventType} from ${input.status}.`,
      ),
    );
  }

  if (errors.length > 0 || !transition) {
    return { ok: false, errors };
  }

  return { ok: true, value: transition };
}

export function isApprovalValid(input: {
  status: ApprovalStatus;
  approvedProposal: ProposalIdentity;
  currentProposal: ProposalIdentity;
}): boolean {
  return evaluateApprovalValidity(input).valid;
}

export function evaluateApprovalValidity(input: {
  status: ApprovalStatus;
  approvedProposal: ProposalIdentity;
  currentProposal: ProposalIdentity;
  activeApprovalCount?: number;
}): ApprovalValidity {
  const reasons: ApprovalError[] = [];
  const proposalChanged = isProposalChanged(
    input.approvedProposal,
    input.currentProposal,
  );

  if (input.status !== "approved") {
    reasons.push(
      error("approval_not_active", "Only approved approvals are valid."),
    );
  }

  if (proposalChanged) {
    reasons.push(
      error(
        "proposal_changed",
        "The current proposal identity differs from the approved proposal.",
      ),
    );
  }

  if ((input.activeApprovalCount ?? 1) > 1) {
    reasons.push(
      error(
        "multiple_active_approvals",
        "Only one active approval may exist for a proposal identity.",
      ),
    );
  }

  return {
    valid: reasons.length === 0,
    status: input.status,
    proposalChanged,
    reasons,
  };
}
