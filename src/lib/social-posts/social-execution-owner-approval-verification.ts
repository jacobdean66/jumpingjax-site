import { computeOwnerApprovalCurrentState } from "./social-owner-approval-current-state";
import type { OwnerApprovalLifecycleStatus } from "./social-owner-approval-current-state";
import type { SocialOwnerApprovalApprovalId } from "./social-owner-approval-persistence";
import {
  getOwnerApprovalProposalByApprovalId,
  listOwnerApprovalEventsByApprovalId,
} from "./social-owner-approval-store";

export const SOCIAL_EXECUTION_OWNER_APPROVAL_VERIFICATION_FAILURE_CODES = [
  "owner_approval_not_found",
  "owner_approval_verification_unavailable",
  "owner_approval_not_approved",
  "owner_approval_rejected",
  "owner_approval_revoked",
  "owner_approval_expired",
  "owner_approval_superseded",
] as const;

export type SocialExecutionOwnerApprovalVerificationFailureCode =
  (typeof SOCIAL_EXECUTION_OWNER_APPROVAL_VERIFICATION_FAILURE_CODES)[number];

export type SocialExecutionOwnerApprovalVerificationResult = Readonly<
  | { ok: true }
  | { ok: false; code: SocialExecutionOwnerApprovalVerificationFailureCode; message: string }
>;

export type SocialExecutionOwnerApprovalVerificationPurpose =
  | "execution_authorization"
  | "evidence_append";

function failureMessage(
  purpose: SocialExecutionOwnerApprovalVerificationPurpose,
): string {
  return purpose === "execution_authorization"
    ? "Owner approval verification is unavailable; execution authorization blocked."
    : "Owner approval verification is unavailable; evidence append blocked.";
}

function notApprovedMessage(
  purpose: SocialExecutionOwnerApprovalVerificationPurpose,
): string {
  return purpose === "execution_authorization"
    ? "Owner approval must be in approved state before execution authorization."
    : "Owner approval must be in approved state before evidence append.";
}

function failureCodeForLifecycleStatus(
  lifecycleStatus: OwnerApprovalLifecycleStatus,
): SocialExecutionOwnerApprovalVerificationFailureCode {
  switch (lifecycleStatus) {
    case "rejected":
      return "owner_approval_rejected";
    case "revoked":
      return "owner_approval_revoked";
    case "expired":
      return "owner_approval_expired";
    case "superseded":
      return "owner_approval_superseded";
    case "requested":
    case "no_events":
    default:
      return "owner_approval_not_approved";
  }
}

export async function verifyDurableOwnerApprovalApproved(input: {
  ownerApprovalId: string;
  purpose: SocialExecutionOwnerApprovalVerificationPurpose;
}): Promise<SocialExecutionOwnerApprovalVerificationResult> {
  const proposalRead = await getOwnerApprovalProposalByApprovalId(
    input.ownerApprovalId as SocialOwnerApprovalApprovalId,
  );

  if (proposalRead.ok === false) {
    if (proposalRead.error.code === "not_found") {
      return {
        ok: false,
        code: "owner_approval_not_found",
        message:
          input.purpose === "execution_authorization"
            ? "Owner approval record could not be found for execution authorization."
            : "Owner approval record could not be found for evidence append.",
      };
    }

    return {
      ok: false,
      code: "owner_approval_verification_unavailable",
      message: failureMessage(input.purpose),
    };
  }

  const eventsRead = await listOwnerApprovalEventsByApprovalId(
    input.ownerApprovalId as SocialOwnerApprovalApprovalId,
  );

  if (eventsRead.ok === false) {
    return {
      ok: false,
      code: "owner_approval_verification_unavailable",
      message: failureMessage(input.purpose),
    };
  }

  const state = computeOwnerApprovalCurrentState({
    proposal: proposalRead.value,
    events: eventsRead.value,
  });

  if (!state.ok) {
    return {
      ok: false,
      code: "owner_approval_verification_unavailable",
      message: failureMessage(input.purpose),
    };
  }

  if (
    state.value.lifecycleStatus !== "approved" ||
    state.value.decisionStatus !== "approved"
  ) {
    return {
      ok: false,
      code: failureCodeForLifecycleStatus(state.value.lifecycleStatus),
      message: notApprovedMessage(input.purpose),
    };
  }

  return { ok: true };
}
