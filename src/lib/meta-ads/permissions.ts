import {
  META_ADS_BUSINESS_SCOPE,
  META_ADS_MANAGEMENT_SCOPE,
  META_ADS_REQUIRED_SCOPE,
  META_ADS_REQUIRED_SCOPES,
} from "./config";
import { metaAdsGraphGet, type MetaAdsHttpResult } from "./http-client";
import { sanitizedError } from "./errors";

export type MetaPermissionRow = Readonly<{
  permission?: string;
  status?: string;
}>;

export type MetaAdsPermissionCheck = Readonly<
  | {
      ok: true;
      hasAdsRead: boolean;
      hasAdsManagement: boolean;
      hasBusinessManagement: boolean;
      hasRequiredScopes: boolean;
      granted: readonly string[];
    }
  | {
      ok: false;
      hasAdsRead: false;
      hasAdsManagement: false;
      hasBusinessManagement: false;
      hasRequiredScopes: false;
      error: import("./errors").MetaAdsSanitizedError;
    }
>;

export async function checkMetaAdsReadPermission(input: {
  accessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<MetaAdsPermissionCheck> {
  const result: MetaAdsHttpResult<{ data?: readonly MetaPermissionRow[] }> =
    await metaAdsGraphGet({
      path: "me/permissions",
      accessToken: input.accessToken,
      fetchImpl: input.fetchImpl,
    });

  if (!result.ok) {
    // Fall back: treat permission endpoint failure as unknown → caller may probe adaccounts.
    if (result.error.code === "permission_missing" || result.error.code === "token_expired") {
      return {
        ok: false,
        hasAdsRead: false,
        hasAdsManagement: false,
        hasBusinessManagement: false,
        hasRequiredScopes: false,
        error: result.error,
      };
    }
    return {
      ok: true,
      hasAdsRead: false,
      hasAdsManagement: false,
      hasBusinessManagement: false,
      hasRequiredScopes: false,
      granted: [],
    };
  }

  const granted = (result.data.data ?? [])
    .filter((row) => row.status === "granted" && row.permission)
    .map((row) => String(row.permission));

  const hasAdsRead = granted.includes(META_ADS_REQUIRED_SCOPE);
  const hasAdsManagement = granted.includes(META_ADS_MANAGEMENT_SCOPE);
  const hasBusinessManagement = granted.includes(META_ADS_BUSINESS_SCOPE);

  return {
    ok: true,
    hasAdsRead,
    hasAdsManagement,
    hasBusinessManagement,
    hasRequiredScopes: hasAdsRead && hasAdsManagement && hasBusinessManagement,
    granted,
  };
}

export function missingAdsReadError() {
  return sanitizedError(
    "permission_missing",
    `This Meta connection is missing required analytics permissions (${META_ADS_REQUIRED_SCOPES.join(", ")}). Reconnect Meta for Analytics.`,
    "permission_blocked",
  );
}
