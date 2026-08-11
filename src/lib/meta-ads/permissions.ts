import { META_ADS_REQUIRED_SCOPE } from "./config";
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
      granted: readonly string[];
    }
  | {
      ok: false;
      hasAdsRead: false;
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
      return { ok: false, hasAdsRead: false, error: result.error };
    }
    return {
      ok: true,
      hasAdsRead: false,
      granted: [],
    };
  }

  const granted = (result.data.data ?? [])
    .filter((row) => row.status === "granted" && row.permission)
    .map((row) => String(row.permission));

  return {
    ok: true,
    hasAdsRead: granted.includes(META_ADS_REQUIRED_SCOPE),
    granted,
  };
}

export function missingAdsReadError() {
  return sanitizedError(
    "permission_missing",
    `This Meta connection does not include ${META_ADS_REQUIRED_SCOPE}. Reconnect Meta OAuth to grant read-only ad reporting access. ads_management is not required.`,
    "permission_blocked",
  );
}
