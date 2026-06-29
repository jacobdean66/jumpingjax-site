import type {
  ApprovalActorType,
  ApprovalAuthorityRole,
} from "./social-owner-approval";
import type {
  SocialOwnerApprovalApprovalId,
  SocialOwnerApprovalActorAuthoritySnapshot,
  SocialOwnerApprovalProposalId,
  SocialOwnerApprovalProposalScope,
  SocialOwnerApprovalSocialPostId,
} from "./social-owner-approval-persistence";

export const OWNER_APPROVAL_AUTHORIZATION_ACTIONS = [
  "create_approval_proposal",
  "request_owner_approval",
  "approve_owner_approval",
  "reject_owner_approval",
  "revoke_owner_approval",
  "view_owner_approval",
] as const;

export type OwnerApprovalAuthorizationAction =
  (typeof OWNER_APPROVAL_AUTHORIZATION_ACTIONS)[number];

export const OWNER_APPROVAL_AUTHORIZATION_REASON_CODES = [
  "authorized",
  "unknown_action",
  "actor_authority_missing",
  "owner_authority_required",
  "scope_mismatch",
] as const;

export type OwnerApprovalAuthorizationReasonCode =
  (typeof OWNER_APPROVAL_AUTHORIZATION_REASON_CODES)[number];

export type OwnerApprovalActor = Readonly<{
  actorId: string;
  actorType: ApprovalActorType;
  authoritySnapshot?: SocialOwnerApprovalActorAuthoritySnapshot | null;
  authorityScope?: OwnerApprovalActorScope | null;
  displayName?: string | null;
}>;

export type OwnerApprovalActorScope = Readonly<{
  socialPostId: SocialOwnerApprovalSocialPostId;
  campaignId: string | null;
  manifestId?: string | null;
}>;

export type OwnerApprovalAuthorizationScope = Readonly<{
  proposalId: SocialOwnerApprovalProposalId;
  approvalId: SocialOwnerApprovalApprovalId;
  socialPostId: SocialOwnerApprovalSocialPostId;
  campaignId: string | null;
  manifestId?: string | null;
  proposalScope: SocialOwnerApprovalProposalScope;
  requiresOwnerAuthority: boolean;
}>;

export type OwnerApprovalAuthorizationEvidence = Readonly<{
  actorId: string | null;
  actorType: ApprovalActorType | null;
  authorityRole: ApprovalAuthorityRole | null;
  authoritySource: string | null;
  canApprove: boolean;
  action: string;
  proposalId: SocialOwnerApprovalProposalId;
  approvalId: SocialOwnerApprovalApprovalId;
  socialPostId: SocialOwnerApprovalSocialPostId;
  campaignId: string | null;
  manifestId: string | null;
}>;

export type OwnerApprovalAuthorizationResult = Readonly<{
  allowed: boolean;
  code: OwnerApprovalAuthorizationReasonCode;
  reason: string;
  evidence: OwnerApprovalAuthorizationEvidence;
}>;

const OWNER_ONLY_ACTIONS = new Set<string>([
  "create_approval_proposal",
  "request_owner_approval",
  "approve_owner_approval",
  "reject_owner_approval",
  "revoke_owner_approval",
]);

function isKnownAction(
  action: string,
): action is OwnerApprovalAuthorizationAction {
  return OWNER_APPROVAL_AUTHORIZATION_ACTIONS.includes(
    action as OwnerApprovalAuthorizationAction,
  );
}

function hasOwnerAuthority(
  snapshot: SocialOwnerApprovalActorAuthoritySnapshot | null | undefined,
): snapshot is SocialOwnerApprovalActorAuthoritySnapshot {
  return (
    snapshot?.actorType === "human" &&
    snapshot.authorityRole === "owner" &&
    snapshot.canApprove === true
  );
}

function hasMatchingScope(input: {
  actor: OwnerApprovalActor;
  context: OwnerApprovalAuthorizationScope;
}): boolean {
  const snapshot = input.actor.authoritySnapshot;
  const actorScope = input.actor.authorityScope;

  return (
    Boolean(snapshot) &&
    Boolean(actorScope) &&
    input.actor.actorId === snapshot?.actorId &&
    input.actor.actorType === snapshot.actorType &&
    actorScope?.socialPostId === input.context.socialPostId &&
    actorScope.campaignId === input.context.campaignId &&
    (actorScope.manifestId ?? null) === (input.context.manifestId ?? null) &&
    input.context.proposalScope.socialPostId === input.context.socialPostId &&
    input.context.proposalScope.campaignId === input.context.campaignId
  );
}

function evidence(input: {
  actor: OwnerApprovalActor | null;
  action: string;
  context: OwnerApprovalAuthorizationScope;
}): OwnerApprovalAuthorizationEvidence {
  const snapshot = input.actor?.authoritySnapshot;

  return {
    actorId: input.actor?.actorId ?? null,
    actorType: input.actor?.actorType ?? null,
    authorityRole: snapshot?.authorityRole ?? null,
    authoritySource: snapshot?.authoritySource ?? null,
    canApprove: snapshot?.canApprove ?? false,
    action: input.action,
    proposalId: input.context.proposalId,
    approvalId: input.context.approvalId,
    socialPostId: input.context.socialPostId,
    campaignId: input.context.campaignId,
    manifestId: input.context.manifestId ?? null,
  };
}

function result(input: {
  allowed: boolean;
  code: OwnerApprovalAuthorizationReasonCode;
  reason: string;
  actor: OwnerApprovalActor | null;
  action: string;
  context: OwnerApprovalAuthorizationScope;
}): OwnerApprovalAuthorizationResult {
  return {
    allowed: input.allowed,
    code: input.code,
    reason: input.reason,
    evidence: evidence(input),
  };
}

export function createOwnerApprovalAuthoritySnapshot(input: {
  actorId: string;
  actorType: ApprovalActorType;
  authorityRole: ApprovalAuthorityRole;
  canApprove: boolean;
  authoritySource: string | null;
}): SocialOwnerApprovalActorAuthoritySnapshot {
  return {
    actorId: input.actorId,
    actorType: input.actorType,
    authorityRole: input.authorityRole,
    canApprove: input.canApprove,
    authoritySource: input.authoritySource,
  };
}

export function evaluateOwnerApprovalAuthorization(input: {
  actor: OwnerApprovalActor | null;
  action: string;
  context: OwnerApprovalAuthorizationScope;
}): OwnerApprovalAuthorizationResult {
  if (!isKnownAction(input.action)) {
    return result({
      allowed: false,
      code: "unknown_action",
      reason: "Owner approval action is not recognized.",
      actor: input.actor,
      action: input.action,
      context: input.context,
    });
  }

  if (!input.actor?.authoritySnapshot) {
    return result({
      allowed: false,
      code: "actor_authority_missing",
      reason: "Actor authority snapshot is required.",
      actor: input.actor,
      action: input.action,
      context: input.context,
    });
  }

  if (!hasMatchingScope({ actor: input.actor, context: input.context })) {
    return result({
      allowed: false,
      code: "scope_mismatch",
      reason: "Actor authority must match the owner approval proposal scope.",
      actor: input.actor,
      action: input.action,
      context: input.context,
    });
  }

  if (
    (OWNER_ONLY_ACTIONS.has(input.action) ||
      input.context.requiresOwnerAuthority) &&
    !hasOwnerAuthority(input.actor.authoritySnapshot)
  ) {
    return result({
      allowed: false,
      code: "owner_authority_required",
      reason: "Human owner authority is required for this owner approval action.",
      actor: input.actor,
      action: input.action,
      context: input.context,
    });
  }

  return result({
    allowed: true,
    code: "authorized",
    reason: "Actor is authorized for this owner approval action and scope.",
    actor: input.actor,
    action: input.action,
    context: input.context,
  });
}
