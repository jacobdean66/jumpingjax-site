import { SOCIAL_EXECUTION_AUTHORIZATION_VERSION } from "./social-execution-authorization-domain";

export const SOCIAL_EXECUTION_AUTHORIZATION_REQUEST_VERSION =
  SOCIAL_EXECUTION_AUTHORIZATION_VERSION;

export const SOCIAL_EXECUTION_AUTHORIZATION_REQUEST_ERROR_CODES = [
  "execution_intent_id_required",
  "execution_intent_id_invalid",
  "publication_target_id_required",
  "publication_target_id_invalid",
  "owner_approval_id_required",
  "owner_approval_id_invalid",
  "approval_id_invalid",
  "social_post_id_invalid",
] as const;

export type SocialExecutionAuthorizationRequestErrorCode =
  (typeof SOCIAL_EXECUTION_AUTHORIZATION_REQUEST_ERROR_CODES)[number];

export type SocialExecutionAuthorizationRequestValidationResult = Readonly<
  | {
      ok: true;
      executionIntentId: string;
      publicationTargetId: string;
      ownerApprovalId: string;
      approvalId: string | null;
      socialPostId: string | null;
      requestVersion: typeof SOCIAL_EXECUTION_AUTHORIZATION_REQUEST_VERSION;
    }
  | {
      ok: false;
      code: SocialExecutionAuthorizationRequestErrorCode;
      message: string;
    }
>;

const REFERENCE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

export function validateExecutionAuthorizationRequest(input: {
  executionIntentId: unknown;
  publicationTargetId: unknown;
  ownerApprovalId: unknown;
  approvalId?: unknown;
  socialPostId?: unknown;
}): SocialExecutionAuthorizationRequestValidationResult {
  const executionIntentId = normalizeOptionalString(input.executionIntentId);
  if (!executionIntentId) {
    return {
      ok: false,
      code: "execution_intent_id_required",
      message: "execution_intent_id is required for execution authorization.",
    };
  }
  if (!REFERENCE_ID_PATTERN.test(executionIntentId)) {
    return {
      ok: false,
      code: "execution_intent_id_invalid",
      message: "execution_intent_id format is invalid for execution authorization.",
    };
  }

  const publicationTargetId = normalizeOptionalString(input.publicationTargetId);
  if (!publicationTargetId) {
    return {
      ok: false,
      code: "publication_target_id_required",
      message: "publication_target_id is required for execution authorization.",
    };
  }
  if (!REFERENCE_ID_PATTERN.test(publicationTargetId)) {
    return {
      ok: false,
      code: "publication_target_id_invalid",
      message: "publication_target_id format is invalid for execution authorization.",
    };
  }

  const ownerApprovalId = normalizeOptionalString(input.ownerApprovalId);
  if (!ownerApprovalId) {
    return {
      ok: false,
      code: "owner_approval_id_required",
      message: "owner_approval_id is required for execution authorization.",
    };
  }
  if (!REFERENCE_ID_PATTERN.test(ownerApprovalId)) {
    return {
      ok: false,
      code: "owner_approval_id_invalid",
      message: "owner_approval_id format is invalid for execution authorization.",
    };
  }

  const approvalId = normalizeOptionalString(input.approvalId);
  if (approvalId && !REFERENCE_ID_PATTERN.test(approvalId)) {
    return {
      ok: false,
      code: "approval_id_invalid",
      message: "approval_id format is invalid for execution authorization.",
    };
  }

  const socialPostId = normalizeOptionalString(input.socialPostId);
  if (socialPostId && !REFERENCE_ID_PATTERN.test(socialPostId)) {
    return {
      ok: false,
      code: "social_post_id_invalid",
      message: "social_post_id format is invalid for execution authorization.",
    };
  }

  return {
    ok: true,
    executionIntentId,
    publicationTargetId,
    ownerApprovalId,
    approvalId,
    socialPostId,
    requestVersion: SOCIAL_EXECUTION_AUTHORIZATION_REQUEST_VERSION,
  };
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
