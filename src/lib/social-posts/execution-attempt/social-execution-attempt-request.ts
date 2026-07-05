import { SOCIAL_EXECUTION_ATTEMPT_VERSION } from "./social-execution-attempt-domain";

export const SOCIAL_EXECUTION_ATTEMPT_REQUEST_VERSION = SOCIAL_EXECUTION_ATTEMPT_VERSION;

export const SOCIAL_EXECUTION_ATTEMPT_REQUEST_ERROR_CODES = [
  "authorization_id_required",
  "authorization_id_invalid",
  "execution_intent_id_required",
  "execution_intent_id_invalid",
  "publication_target_id_required",
  "publication_target_id_invalid",
] as const;

export type SocialExecutionAttemptRequestErrorCode =
  (typeof SOCIAL_EXECUTION_ATTEMPT_REQUEST_ERROR_CODES)[number];

export type SocialExecutionAttemptRequestValidationResult = Readonly<
  | {
      ok: true;
      authorizationId: string;
      executionIntentId: string;
      publicationTargetId: string;
      requestVersion: typeof SOCIAL_EXECUTION_ATTEMPT_REQUEST_VERSION;
    }
  | {
      ok: false;
      code: SocialExecutionAttemptRequestErrorCode;
      message: string;
    }
>;

const AUTHORIZATION_ID_PATTERN = /^exec-auth:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const REFERENCE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

export function validateExecutionAttemptRequest(input: {
  authorizationId: unknown;
  executionIntentId: unknown;
  publicationTargetId: unknown;
}): SocialExecutionAttemptRequestValidationResult {
  const authorizationId = normalizeOptionalString(input.authorizationId);
  if (!authorizationId) {
    return {
      ok: false,
      code: "authorization_id_required",
      message: "authorization_id is required for execution attempt creation.",
    };
  }
  if (!AUTHORIZATION_ID_PATTERN.test(authorizationId)) {
    return {
      ok: false,
      code: "authorization_id_invalid",
      message: "authorization_id format is invalid for execution attempt creation.",
    };
  }

  const executionIntentId = normalizeOptionalString(input.executionIntentId);
  if (!executionIntentId) {
    return {
      ok: false,
      code: "execution_intent_id_required",
      message: "execution_intent_id is required for execution attempt creation.",
    };
  }
  if (!REFERENCE_ID_PATTERN.test(executionIntentId)) {
    return {
      ok: false,
      code: "execution_intent_id_invalid",
      message: "execution_intent_id format is invalid for execution attempt creation.",
    };
  }

  const publicationTargetId = normalizeOptionalString(input.publicationTargetId);
  if (!publicationTargetId) {
    return {
      ok: false,
      code: "publication_target_id_required",
      message: "publication_target_id is required for execution attempt creation.",
    };
  }
  if (!REFERENCE_ID_PATTERN.test(publicationTargetId)) {
    return {
      ok: false,
      code: "publication_target_id_invalid",
      message: "publication_target_id format is invalid for execution attempt creation.",
    };
  }

  return {
    ok: true,
    authorizationId,
    executionIntentId,
    publicationTargetId,
    requestVersion: SOCIAL_EXECUTION_ATTEMPT_REQUEST_VERSION,
  };
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
