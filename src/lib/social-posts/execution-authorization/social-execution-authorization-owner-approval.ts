import { fetchSocialPublicationExecutionIntentRecordByIntentId } from "../social-publication-execution-store";
import type { SocialPublicationExecutionIntentRecord } from "../social-publication-execution-repository";
import type { SocialOwnerApprovalApprovalId } from "../social-owner-approval-persistence";
import { getOwnerApprovalProposalByApprovalId } from "../social-owner-approval-store";
import {
  SOCIAL_EXECUTION_OWNER_APPROVAL_VERIFICATION_FAILURE_CODES,
  verifyDurableOwnerApprovalApproved,
  type SocialExecutionOwnerApprovalVerificationFailureCode,
} from "../social-execution-owner-approval-verification";

export const SOCIAL_EXECUTION_AUTHORIZATION_OWNER_APPROVAL_FAILURE_CODES = [
  ...SOCIAL_EXECUTION_OWNER_APPROVAL_VERIFICATION_FAILURE_CODES,
  "owner_approval_id_mismatch",
  "social_post_id_scope_mismatch",
  "execution_intent_scope_mismatch",
] as const;

export type SocialExecutionAuthorizationOwnerApprovalFailureCode =
  (typeof SOCIAL_EXECUTION_AUTHORIZATION_OWNER_APPROVAL_FAILURE_CODES)[number];

export type SocialExecutionAuthorizationOwnerApprovalVerificationResult = Readonly<
  | { ok: true }
  | {
      ok: false;
      code: SocialExecutionAuthorizationOwnerApprovalFailureCode;
      message: string;
    }
>;

export type SocialExecutionAuthorizationOwnerApprovalVerificationInput = Readonly<{
  ownerApprovalId: string;
  executionIntentId: string;
  publicationTargetId: string;
  socialPostId: string | null;
  approvalId: string | null;
}>;

export type SocialExecutionAuthorizationOwnerApprovalVerificationDependencies = Readonly<{
  verifyApproved: (
    input: Readonly<{ ownerApprovalId: string }>,
  ) => Promise<
    | { ok: true }
    | { ok: false; code: SocialExecutionOwnerApprovalVerificationFailureCode; message: string }
  >;
  loadExecutionIntent: (
    executionIntentId: string,
  ) => Promise<
    | { ok: true; value: SocialPublicationExecutionIntentRecord | null }
    | { ok: false; code: "storage_unavailable"; message: string }
  >;
  loadOwnerApprovalProposal: (
    ownerApprovalId: string,
  ) => Promise<
    | { ok: true; value: { socialPostId: string; approvalId: string } }
    | { ok: false; code: "not_found" | "storage_unavailable"; message: string }
  >;
}>;

let testDependencies: SocialExecutionAuthorizationOwnerApprovalVerificationDependencies | null =
  null;

export function configureSocialExecutionAuthorizationOwnerApprovalVerificationTestDependencies(
  dependencies: SocialExecutionAuthorizationOwnerApprovalVerificationDependencies | null,
): void {
  testDependencies = dependencies;
}

function dependencies(): SocialExecutionAuthorizationOwnerApprovalVerificationDependencies {
  return (
    testDependencies ?? {
      verifyApproved: async ({ ownerApprovalId }) =>
        verifyDurableOwnerApprovalApproved({
          ownerApprovalId,
          purpose: "execution_authorization",
        }),
      loadExecutionIntent: async (executionIntentId) => {
        const result = await fetchSocialPublicationExecutionIntentRecordByIntentId(
          executionIntentId,
        );
        if (result.ok === false) {
          return {
            ok: false,
            code: "storage_unavailable",
            message: "Execution intent lookup is unavailable; execution authorization blocked.",
          };
        }
        return { ok: true, value: result.value };
      },
      loadOwnerApprovalProposal: async (ownerApprovalId) => {
        const result = await getOwnerApprovalProposalByApprovalId(
          ownerApprovalId as SocialOwnerApprovalApprovalId,
        );
        if (result.ok === false) {
          return {
            ok: false,
            code:
              result.error.code === "not_found" ? "not_found" : "storage_unavailable",
            message: result.error.message,
          };
        }
        return {
          ok: true,
          value: {
            socialPostId: result.value.socialPostId,
            approvalId: result.value.approvalId,
          },
        };
      },
    }
  );
}

export async function verifyOwnerApprovalForExecutionAuthorization(
  input: SocialExecutionAuthorizationOwnerApprovalVerificationInput,
): Promise<SocialExecutionAuthorizationOwnerApprovalVerificationResult> {
  const approved = await dependencies().verifyApproved({
    ownerApprovalId: input.ownerApprovalId,
  });
  if (!approved.ok) {
    return approved;
  }

  const proposalRead = await dependencies().loadOwnerApprovalProposal(
    input.ownerApprovalId,
  );
  if (proposalRead.ok === false) {
    if (proposalRead.code === "not_found") {
      return {
        ok: false,
        code: "owner_approval_not_found",
        message: "Owner approval record could not be found for execution authorization.",
      };
    }
    return {
      ok: false,
      code: "owner_approval_verification_unavailable",
      message:
        "Owner approval verification is unavailable; execution authorization blocked.",
    };
  }

  if (input.approvalId && input.approvalId !== proposalRead.value.approvalId) {
    return {
      ok: false,
      code: "owner_approval_id_mismatch",
      message: "approval_id must match the durable owner approval record.",
    };
  }

  if (input.socialPostId && input.socialPostId !== proposalRead.value.socialPostId) {
    return {
      ok: false,
      code: "social_post_id_scope_mismatch",
      message: "social_post_id must match the durable owner approval proposal scope.",
    };
  }

  const intentRead = await dependencies().loadExecutionIntent(input.executionIntentId);
  if (intentRead.ok === false) {
    return {
      ok: false,
      code: "owner_approval_verification_unavailable",
      message:
        "Owner approval verification is unavailable; execution authorization blocked.",
    };
  }

  const intent = intentRead.value;
  if (!intent) {
    return { ok: true };
  }

  if (intent.scope.publication_target_id !== input.publicationTargetId) {
    return {
      ok: false,
      code: "execution_intent_scope_mismatch",
      message:
        "publication_target_id must match the durable execution intent publication target scope.",
    };
  }

  if (
    intent.scope.owner_approval_id &&
    intent.scope.owner_approval_id !== input.ownerApprovalId
  ) {
    return {
      ok: false,
      code: "owner_approval_id_mismatch",
      message: "owner_approval_id must match the durable execution intent owner approval reference.",
    };
  }

  if (
    intent.scope.social_post_id &&
    intent.scope.social_post_id !== proposalRead.value.socialPostId
  ) {
    return {
      ok: false,
      code: "social_post_id_scope_mismatch",
      message:
        "Execution intent social_post_id must match the durable owner approval proposal scope.",
    };
  }

  return { ok: true };
}

export async function evaluateOwnerApprovalVerificationForAuthorizationRecord(input: {
  ownerApprovalId: string | null;
  executionIntentId: string;
  publicationTargetId: string;
  socialPostId: string | null;
  approvalId: string | null;
}): Promise<
  Readonly<{
    ownerApprovalVerificationStatus: "verified" | "not_verified" | "missing_reference";
    ownerApprovalVerificationCode: string | null;
    ownerApprovalVerificationMessage: string | null;
  }>
> {
  if (!input.ownerApprovalId) {
    return {
      ownerApprovalVerificationStatus: "missing_reference",
      ownerApprovalVerificationCode: "owner_approval_reference_missing",
      ownerApprovalVerificationMessage:
        "Execution authorization is missing a durable owner approval reference.",
    };
  }

  const verification = await verifyOwnerApprovalForExecutionAuthorization({
    ownerApprovalId: input.ownerApprovalId,
    executionIntentId: input.executionIntentId,
    publicationTargetId: input.publicationTargetId,
    socialPostId: input.socialPostId,
    approvalId: input.approvalId,
  });

  if (verification.ok) {
    return {
      ownerApprovalVerificationStatus: "verified",
      ownerApprovalVerificationCode: null,
      ownerApprovalVerificationMessage: null,
    };
  }

  return {
    ownerApprovalVerificationStatus: "not_verified",
    ownerApprovalVerificationCode: verification.code,
    ownerApprovalVerificationMessage: verification.message,
  };
}
