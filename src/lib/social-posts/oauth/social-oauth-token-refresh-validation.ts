import type { SocialMetaOAuthExchangeResult } from "./social-meta-oauth-client";
import type { SocialOAuthRefreshEligibility } from "./social-oauth-refresh-eligibility";

export const SOCIAL_OAUTH_TOKEN_REFRESH_VALIDATION_VERSION = "d16-w3-v1" as const;

export type SocialOAuthTokenRefreshValidationResult = Readonly<
  | {
      ok: true;
      expiresInSeconds: number | null;
      tokenType: string | null;
    }
  | {
      ok: false;
      code: string;
      message: string;
    }
>;

export function validateRefreshEligibilityBeforeExchange(
  eligibility: SocialOAuthRefreshEligibility,
): Readonly<{ ok: true } | { ok: false; code: string; message: string }> {
  if (!eligibility.eligible) {
    const reason = eligibility.blockingReasons[0] ?? "refresh_not_eligible";
    return {
      ok: false,
      code: reason,
      message: `Controlled token refresh is blocked: ${eligibility.blockingReasons.join(", ") || reason}.`,
    };
  }
  if (eligibility.refreshMode === "none") {
    return {
      ok: false,
      code: "refresh_mode_unavailable",
      message: "No supported refresh mode is available for this credential.",
    };
  }
  return { ok: true };
}

export function validateMetaTokenRefreshResult(
  result: SocialMetaOAuthExchangeResult,
): SocialOAuthTokenRefreshValidationResult {
  if (!result.ok) {
    return {
      ok: false,
      code: result.errorCode,
      message: result.message,
    };
  }

  if (!result.accessToken.trim()) {
    return {
      ok: false,
      code: "refresh_empty_access_token",
      message: "Meta refresh returned an empty access token.",
    };
  }

  if (
    result.expiresInSeconds !== null &&
    (!Number.isFinite(result.expiresInSeconds) || result.expiresInSeconds <= 0)
  ) {
    return {
      ok: false,
      code: "refresh_invalid_expires_in",
      message: "Meta refresh returned an invalid expires_in value.",
    };
  }

  return {
    ok: true,
    expiresInSeconds: result.expiresInSeconds,
    tokenType: result.tokenType,
  };
}
