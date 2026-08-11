import { META_ADS_REQUIRED_SCOPE } from "./config";

export type MetaAdsFreshness =
  | "fresh"
  | "stale"
  | "unavailable"
  | "permission_blocked"
  | "token_expired"
  | "rate_limited"
  | "misconfigured"
  | "empty";

export type MetaAdsErrorCode =
  | "misconfigured"
  | "oauth_session_missing"
  | "token_unavailable"
  | "permission_missing"
  | "token_expired"
  | "rate_limited"
  | "provider_error"
  | "invalid_account"
  | "invalid_date_range"
  | "invalid_level"
  | "timeout"
  | "network_error"
  | "partial_data";

export type MetaAdsSanitizedError = Readonly<{
  code: MetaAdsErrorCode;
  message: string;
  freshness: MetaAdsFreshness;
}>;

const TOKENISH = /(access[_-]?token|bearer\s+[a-z0-9._-]+|EAAG[A-Za-z0-9]+)/gi;

export function redactProviderText(raw: string | null | undefined): string {
  if (!raw) return "Meta request failed.";
  return raw
    .replace(TOKENISH, "[redacted]")
    .replace(/[?&]access_token=[^&\s]+/gi, "")
    .slice(0, 280);
}

export function mapMetaHttpFailure(input: {
  httpStatus: number;
  providerCode?: number | null;
  providerMessage?: string | null;
  providerType?: string | null;
}): MetaAdsSanitizedError {
  const code = input.providerCode ?? null;
  const message = redactProviderText(input.providerMessage);

  if (input.httpStatus === 401 || code === 190) {
    return {
      code: "token_expired",
      message:
        "The Meta connection expired or was revoked. Reconnect Meta OAuth with ads_read to continue.",
      freshness: "token_expired",
    };
  }

  if (input.httpStatus === 403 || code === 200) {
    const lower = message.toLowerCase();
    if (
      lower.includes("ads_read") ||
      lower.includes("permission") ||
      lower.includes("(#200)")
    ) {
      return {
        code: "permission_missing",
        message: `Meta blocked this read. Grant the ${META_ADS_REQUIRED_SCOPE} permission by reconnecting Meta OAuth, then retry.`,
        freshness: "permission_blocked",
      };
    }
    return {
      code: "permission_missing",
      message:
        "Meta denied access to this ad data. Check Business Manager permissions and reconnect if needed.",
      freshness: "permission_blocked",
    };
  }

  if (input.httpStatus === 429 || code === 613 || code === 80004) {
    return {
      code: "rate_limited",
      message:
        "Meta rate-limited ad analytics. Wait a minute, then refresh. Earlier totals are unavailable until Meta responds.",
      freshness: "rate_limited",
    };
  }

  if (input.httpStatus === 408 || code === null && message.toLowerCase().includes("timeout")) {
    return {
      code: "timeout",
      message: "Meta did not respond in time. Try a shorter date range or refresh.",
      freshness: "unavailable",
    };
  }

  return {
    code: "provider_error",
    message: message || "Meta ad analytics request failed.",
    freshness: "unavailable",
  };
}

export function sanitizedError(
  code: MetaAdsErrorCode,
  message: string,
  freshness: MetaAdsFreshness,
): MetaAdsSanitizedError {
  return { code, message: redactProviderText(message), freshness };
}
