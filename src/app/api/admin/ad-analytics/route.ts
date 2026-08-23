import { NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { loadMetaAdsDashboard } from "@/lib/meta-ads";
import { sanitizedError } from "@/lib/meta-ads/errors";
import { pauseMetaAd } from "@/lib/meta-ads/marketing-api";
import { checkMetaAdsReadPermission } from "@/lib/meta-ads/permissions";
import { resolveMetaAdsAccessToken } from "@/lib/meta-ads/token-resolver";

export const dynamic = "force-dynamic";

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) {
    return noStoreJson(
      {
        error:
          auth.reason === "missing_config"
            ? "Admin login is not configured."
            : "Owner authentication required.",
      },
      auth.reason === "missing_config" ? 503 : 401,
    );
  }

  const url = new URL(request.url);
  const accountId = url.searchParams.get("account_id");
  const preset = url.searchParams.get("preset");
  const since = url.searchParams.get("since");
  const until = url.searchParams.get("until");
  const status = url.searchParams.get("status");
  const level = url.searchParams.get("level");
  const campaignId = url.searchParams.get("campaign_id");

  if (level && !["account", "campaign", "adset", "ad"].includes(level)) {
    return noStoreJson({ error: "Invalid level." }, 400);
  }

  const dashboard = await loadMetaAdsDashboard({
    accountId,
    preset,
    since,
    until,
    status,
    campaignId,
  });

  if (dashboard.freshness === "unavailable" && dashboard.errors.some((e) => e.code === "invalid_account")) {
    return noStoreJson(
      {
        error: "Unauthorized or unknown ad account id.",
        freshness: dashboard.freshness,
      },
      403,
    );
  }

  if (dashboard.freshness === "unavailable" && dashboard.errors.some((e) => e.code === "invalid_date_range")) {
    return noStoreJson(
      {
        error: dashboard.message ?? "Invalid date range.",
        freshness: dashboard.freshness,
      },
      400,
    );
  }

  // Normalized view model only — never include tokens or raw provider payloads.
  return noStoreJson({
    generatedAt: dashboard.generatedAt,
    freshness: dashboard.freshness,
    message: dashboard.message,
    connection: {
      configured: dashboard.connection.configured,
      hasConnectedSession: dashboard.connection.hasConnectedSession,
      hasAdsRead: dashboard.connection.hasAdsRead,
      hasAdsManagement: dashboard.connection.hasAdsManagement,
      reconnectPath: dashboard.connection.reconnectPath,
    },
    accounts: dashboard.accounts,
    selectedAccountId: dashboard.selectedAccountId,
    dateRange: dashboard.dateRange,
    statusFilter: dashboard.statusFilter,
    totals: dashboard.totals,
    comparisonTotals: dashboard.comparisonTotals,
    campaigns: dashboard.campaigns,
    daily: dashboard.daily,
    metricGlossary: dashboard.metricGlossary,
    errors: dashboard.errors,
  });
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) {
    return noStoreJson(
      {
        error:
          auth.reason === "missing_config"
            ? "Admin login is not configured."
            : "Owner authentication required.",
      },
      auth.reason === "missing_config" ? 503 : 401,
    );
  }

  const body = await readJsonBody(request);
  const action = typeof body?.action === "string" ? body.action : "";
  const adId = typeof body?.adId === "string" ? body.adId.trim() : "";

  if (action !== "pause_ad" || !adId) {
    return noStoreJson({ error: "Invalid ad stop request." }, 400);
  }

  const tokenResult = await resolveMetaAdsAccessToken();
  if (!tokenResult.ok) {
    return noStoreJson({ error: tokenResult.error.message }, 401);
  }

  const permission = await checkMetaAdsReadPermission({
    accessToken: tokenResult.accessToken,
  });
  if (!permission.ok) {
    return noStoreJson({ error: permission.error.message }, 403);
  }
  if (!permission.hasRequiredScopes) {
    const missing = sanitizedError(
      "permission_missing",
      "Reconnect Meta for Analytics to grant ads_management before stopping ads.",
      "permission_blocked",
    );
    return noStoreJson({ error: missing.message }, 403);
  }

  const pause = await pauseMetaAd({
    accessToken: tokenResult.accessToken,
    adId,
  });

  if (!pause.ok) {
    const status =
      pause.error.code === "permission_missing"
        ? 403
        : pause.error.code === "token_expired"
          ? 401
          : 502;
    return noStoreJson({ error: pause.error.message }, status);
  }

  return noStoreJson({
    ok: true,
    adId: pause.adId,
    status: "PAUSED",
  });
}
