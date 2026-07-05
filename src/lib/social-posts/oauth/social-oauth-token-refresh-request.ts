export const SOCIAL_OAUTH_MANUAL_REFRESH_REQUEST_VERSION = "d16-w4-v1" as const;

export const SOCIAL_OAUTH_MANUAL_REFRESH_REQUEST_ERROR_CODES = [
  "publication_target_id_required",
  "publication_target_id_invalid",
] as const;

export type SocialOAuthManualRefreshRequestErrorCode =
  (typeof SOCIAL_OAUTH_MANUAL_REFRESH_REQUEST_ERROR_CODES)[number];

export type SocialOAuthManualRefreshRequestValidationResult = Readonly<
  | {
      ok: true;
      publicationTargetId: string;
      requestVersion: typeof SOCIAL_OAUTH_MANUAL_REFRESH_REQUEST_VERSION;
    }
  | {
      ok: false;
      code: SocialOAuthManualRefreshRequestErrorCode;
      message: string;
    }
>;

const PUBLICATION_TARGET_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

export function validateManualTokenRefreshRequest(input: {
  publicationTargetId: unknown;
}): SocialOAuthManualRefreshRequestValidationResult {
  if (typeof input.publicationTargetId !== "string" || !input.publicationTargetId.trim()) {
    return {
      ok: false,
      code: "publication_target_id_required",
      message: "publication_target_id is required for manual token refresh.",
    };
  }

  const publicationTargetId = input.publicationTargetId.trim();
  if (!PUBLICATION_TARGET_ID_PATTERN.test(publicationTargetId)) {
    return {
      ok: false,
      code: "publication_target_id_invalid",
      message: "publication_target_id format is invalid for manual token refresh.",
    };
  }

  return {
    ok: true,
    publicationTargetId,
    requestVersion: SOCIAL_OAUTH_MANUAL_REFRESH_REQUEST_VERSION,
  };
}
