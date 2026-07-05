import { computeOwnerApprovalCurrentState } from "../social-owner-approval-current-state";
import type { SocialOwnerApprovalApprovalId } from "../social-owner-approval-persistence";
import {
  getOwnerApprovalProposalByApprovalId,
  listOwnerApprovalEventsByApprovalId,
} from "../social-owner-approval-store";

export async function verifyOwnerApprovalForEvidenceAppend(
  ownerApprovalId: string,
): Promise<
  | { ok: true }
  | { ok: false; code: string; message: string }
> {
  const proposalRead = await getOwnerApprovalProposalByApprovalId(
    ownerApprovalId as SocialOwnerApprovalApprovalId,
  );

  if (proposalRead.ok === false) {
    if (proposalRead.error.code === "not_found") {
      return {
        ok: false,
        code: "owner_approval_not_found",
        message: "Owner approval record could not be found for evidence append.",
      };
    }

    return {
      ok: false,
      code: "owner_approval_verification_unavailable",
      message: "Owner approval verification is unavailable; evidence append blocked.",
    };
  }

  const eventsRead = await listOwnerApprovalEventsByApprovalId(
    ownerApprovalId as SocialOwnerApprovalApprovalId,
  );

  if (eventsRead.ok === false) {
    return {
      ok: false,
      code: "owner_approval_verification_unavailable",
      message: "Owner approval verification is unavailable; evidence append blocked.",
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
      message: "Owner approval verification is unavailable; evidence append blocked.",
    };
  }

  if (
    state.value.lifecycleStatus !== "approved" ||
    state.value.decisionStatus !== "approved"
  ) {
    return {
      ok: false,
      code: "owner_approval_not_approved",
      message: "Owner approval must be in approved state before evidence append.",
    };
  }

  return { ok: true };
}
