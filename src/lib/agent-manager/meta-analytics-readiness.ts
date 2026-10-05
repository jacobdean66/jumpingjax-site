import "server-only";
import { resolveMetaAdsAccessToken } from "@/lib/meta-ads/token-resolver";
import { checkMetaAdsReadPermission } from "@/lib/meta-ads/permissions";

export async function loadMetaAnalyticsReadiness(dependencies = { resolve: resolveMetaAdsAccessToken, permissions: checkMetaAdsReadPermission }) {
  const token = await dependencies.resolve();
  if (!token.ok) return { state: "setup_required" as const, summary: "Meta analytics needs its existing connection repaired.", blocker: token.error.message };
  const permissions = await dependencies.permissions({ accessToken: token.accessToken });
  if (!permissions.ok) return { state: "unavailable" as const, summary: "The Meta analytics permission check failed.", blocker: permissions.error.message };
  if (!permissions.hasAdsRead) return { state: "setup_required" as const, summary: "The connected Meta session lacks ads_read.", blocker: "Reconnect Meta for Analytics with ads_read. Ad management permission is not required for reporting." };
  return { state: "connected" as const, summary: "The stored analytics credential and live Meta ads_read permission are verified.", blocker: null };
}
