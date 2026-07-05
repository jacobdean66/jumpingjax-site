import {
  verifyDurableOwnerApprovalApproved,
  type SocialExecutionOwnerApprovalVerificationResult,
} from "../social-execution-owner-approval-verification";

export async function verifyOwnerApprovalForEvidenceAppend(
  ownerApprovalId: string,
): Promise<SocialExecutionOwnerApprovalVerificationResult> {
  return verifyDurableOwnerApprovalApproved({
    ownerApprovalId,
    purpose: "evidence_append",
  });
}
