import { SOCIAL_EXECUTION_AUTHORIZATION_VERSION } from "./social-execution-authorization-domain";

export const SOCIAL_EXECUTION_AUTHORIZATION_CANCELLATION_REQUEST_VERSION =
  SOCIAL_EXECUTION_AUTHORIZATION_VERSION;

export const SOCIAL_EXECUTION_AUTHORIZATION_CANCELLATION_REQUEST_ERROR_CODES = [
  "authorization_id_required",
  "authorization_id_invalid",
  "sanitized_detail_invalid",
] as const;

export type SocialExecutionAuthorizationCancellationRequestErrorCode =
  (typeof SOCIAL_EXECUTION_AUTHORIZATION_CANCELLATION_REQUEST_ERROR_CODES)[number];

export type SocialExecutionAuthorizationCancellationRequestValidationResult = Readonly<
  | {
      ok: true;
      authorizationId: string;
      sanitizedDetail: string;
      requestVersion: typeof SOCIAL_EXECUTION_AUTHORIZATION_CANCELLATION_REQUEST_VERSION;
    }
  | {
      ok: false;
      code: SocialExecutionAuthorizationCancellationRequestErrorCode;
      message: string;
    }
>;

const AUTHORIZATION_ID_PATTERN = /^exec-auth:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

export function validateExecutionAuthorizationCancellationRequest(input: {
  authorizationId: unknown;
  sanitizedDetail?: unknown;
}): SocialExecutionAuthorizationCancellationRequestValidationResult {
  const authorizationId = normalizeOptionalString(input.authorizationId);
  if (!authorizationId) {
    return {
      ok: false,
      code: "authorization_id_required",
      message: "authorization_id is required for execution authorization cancellation.",
    };
  }
  if (!AUTHORIZATION_ID_PATTERN.test(authorizationId)) {
    return {
      ok: false,
      code: "authorization_id_invalid",
      message: "authorization_id format is invalid for execution authorization cancellation.",
    };
  }

  const sanitizedDetail =
    normalizeOptionalString(input.sanitizedDetail) ?? "execution_authorization_cancelled";

  if (sanitizedDetail.length > 256) {
    return {
      ok: false,
      code: "sanitized_detail_invalid",
      message: "sanitized_detail exceeds maximum length for execution authorization cancellation.",
    };
  }

  return {
    ok: true,
    authorizationId,
    sanitizedDetail,
    requestVersion: SOCIAL_EXECUTION_AUTHORIZATION_CANCELLATION_REQUEST_VERSION,
  };
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
