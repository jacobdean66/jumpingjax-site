import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { GOOGLE_ADS_SCOPE, fetchGoogleAdsReport, googleReportingConfig, googleReportingDates } from "./google-reporting-core";
import { buildGoogleAdsAuthorization, openGoogleAdsCookie, sealGoogleAdsCookie, validateGoogleAdsState } from "./google-reporting-auth";

const config = googleReportingConfig({ GOOGLE_CLIENT_ID: "fixture-client", GOOGLE_CLIENT_SECRET: "fixture-client-secret" });
const env = { ADMIN_SESSION_SECRET: "test-only-cookie-secret" };
const now = new Date("2026-10-23T01:30:00Z");

function fixtureRequest(options: { failure?: number; body?: unknown; traffic?: unknown[]; leads?: unknown[]; scope?: string; malformed?: boolean } = {}) {
  const calls: { url: string; query?: string; body?: URLSearchParams; headers?: HeadersInit }[] = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url);
    if (target === "https://oauth2.googleapis.com/token") {
      calls.push({ url: target, body: init?.body as URLSearchParams });
      return Response.json({ access_token: "fixture-access-secret", scope: options.scope || GOOGLE_ADS_SCOPE });
    }
    assert.equal(target, "https://googleads.googleapis.com/v26/customers/7151399909/googleAds:searchStream");
    assert.equal(init?.method, "POST");
    assert.equal(init?.cache, "no-store");
    const query = JSON.parse(String(init?.body)).query as string;
    // GAQL requires non-date segments used by WHERE to also appear in SELECT.
    if (query.includes("AND segments.conversion_action")) assert.match(query.split(" FROM ")[0], /segments\.conversion_action/);
    calls.push({ url: target, query, headers: init?.headers });
    if (options.failure) return Response.json(options.body || { error: { message: "DO NOT EXPOSE fixture-access-secret" } }, { status: options.failure });
    if (options.malformed) return Response.json({ results: [] });
    const results = query.includes("FROM customer") ? [{ customer: { id: "7151399909", currencyCode: "USD", timeZone: "America/New_York" } }]
      : query.includes("campaign_budget") ? [{ campaign: { id: "24386017082", name: "Inflatable Rentals - 15% Off", status: "PAUSED" }, campaignBudget: { amountMicros: "10000000" } }]
      : query.includes("metrics.conversions") ? options.leads || [{ metrics: { conversions: 1.5 } }]
      : options.traffic || [{ metrics: { impressions: "100", clicks: "4", costMicros: "2500000" } }];
    return Response.json([{ results }]);
  }) as typeof fetch;
  return { fetcher, calls };
}

test("missing reporting authorization stays unavailable, makes no requests, and never reuses Calendar refresh tokens", async () => {
  const { fetcher, calls } = fixtureRequest();
  const report = await fetchGoogleAdsReport({ config, refreshToken: "", fetcher, now });
  assert.equal(report.status, "not_connected");
  assert.equal(report.totals, null);
  assert.equal(report.fetchedAt, null);
  assert.equal(calls.length, 0);
  const loader = readFileSync(new URL("./google-reporting.ts", import.meta.url), "utf8");
  assert.ok(!/env\.GOOGLE_REFRESH_TOKEN\b/.test(loader));
});

test("report isolates the replacement campaign and rental conversion, converts micros, and retains fractional attribution", async () => {
  const { fetcher, calls } = fixtureRequest();
  const report = await fetchGoogleAdsReport({ config, refreshToken: "fixture-refresh-secret", fetcher, now });
  assert.equal(report.status, "connected");
  assert.equal(report.campaign?.dailyBudget, 10);
  assert.equal(report.campaign?.status, "PAUSED");
  assert.deepEqual(report.totals, { impressions: 100, clicks: 4, spend: 2.5, savedRentalRequests: 1.5, ctr: 4, costPerRentalRequest: 2.5 / 1.5 });
  assert.equal(report.until, "2026-10-22");
  assert.equal(report.since, "2026-09-23");
  assert.equal(calls.length, 5);
  const traffic = calls.find(call => call.query?.includes("metrics.impressions"))!;
  const leads = calls.find(call => call.query?.includes("metrics.conversions"))!;
  assert.match(traffic.query!, /campaign.id = 24386017082/);
  assert.doesNotMatch(traffic.query!, /conversion_action/);
  assert.match(leads.query!, /conversionActions\/7823548968/);
  assert.ok(calls.filter(call => call.query).every(call => !/mutate/i.test(call.url)));
  assert.doesNotMatch(JSON.stringify(report), /fixture.*secret/);
  assert.equal(calls[0].body?.get("refresh_token"), "fixture-refresh-secret");
});

test("successful empty metric results mean zero activity, with no false cost-per-lead", async () => {
  const { fetcher } = fixtureRequest({ traffic: [], leads: [] });
  const report = await fetchGoogleAdsReport({ config, refreshToken: "fixture", fetcher, now });
  assert.equal(report.status, "connected");
  assert.deepEqual(report.totals, { impressions: 0, clicks: 0, spend: 0, savedRentalRequests: 0, ctr: null, costPerRentalRequest: null });
});

test("permission errors, expired scopes and malformed responses never masquerade as zero results or leak raw errors", async () => {
  for (const [options, expected] of [[{ failure: 403 }, "permission_required"], [{ failure: 401 }, "reconnect"], [{ failure: 429 }, "unavailable"], [{ malformed: true }, "unavailable"], [{ scope: "https://www.googleapis.com/auth/calendar" }, "reconnect"]] as const) {
    const { fetcher } = fixtureRequest(options);
    const report = await fetchGoogleAdsReport({ config, refreshToken: "fixture", fetcher, now });
    assert.equal(report.status, expected);
    assert.equal(report.totals, null);
    assert.equal(report.fetchedAt, null);
    assert.doesNotMatch(JSON.stringify(report), /DO NOT EXPOSE|fixture-access-secret/);
  }
});

test("date presets use account-local days across UTC midnight and reject query injection", () => {
  assert.deepEqual(googleReportingDates("today", now), { preset: "today", since: "2026-10-22", until: "2026-10-22" });
  assert.deepEqual(googleReportingDates("last_7d", new Date("2026-03-09T01:00:00Z")), { preset: "last_7d", since: "2026-03-02", until: "2026-03-08" });
  assert.equal(googleReportingDates("' OR 1=1", now).preset, "last_30d");
});

test("connection cookies are authenticated, purpose-bound, encrypted and expire", () => {
  const cookie = sealGoogleAdsCookie({ refreshToken: "synthetic-refresh-token" }, env, "connection", 60, 1000);
  assert.doesNotMatch(Buffer.from(cookie, "base64url").toString("utf8"), /synthetic-refresh-token/);
  assert.equal(openGoogleAdsCookie(cookie, env, "connection", 2000)?.refreshToken, "synthetic-refresh-token");
  assert.equal(openGoogleAdsCookie(cookie, env, "state", 2000), null);
  assert.equal(openGoogleAdsCookie(cookie, { ADMIN_SESSION_SECRET: "wrong" }, "connection", 2000), null);
  assert.equal(openGoogleAdsCookie(cookie, env, "connection", 61001), null);
  const bytes = Buffer.from(cookie, "base64url"); bytes[30] ^= 1;
  assert.equal(openGoogleAdsCookie(bytes.toString("base64url"), env, "connection", 2000), null);
});

test("OAuth state binds the owner session, uses PKCE and the exact redirect, and rejects mismatches", () => {
  const connection = buildGoogleAdsAuthorization({ ...env, GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-secret" }, "https://jumpingjaxllc.com", "owner")!;
  const url = new URL(connection.url);
  const state = url.searchParams.get("state");
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("redirect_uri"), "https://jumpingjaxllc.com/api/admin/ad-analytics/google/callback");
  assert.equal(url.searchParams.get("scope"), GOOGLE_ADS_SCOPE);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.ok(validateGoogleAdsState(connection.cookie, state, "owner", env));
  assert.equal(validateGoogleAdsState(connection.cookie, "wrong", "owner", env), null);
  assert.equal(validateGoogleAdsState(connection.cookie, state, "employee", env), null);
  assert.equal(validateGoogleAdsState(connection.cookie, state, "owner", env, Date.now() + 601_000), null);
  assert.doesNotMatch(connection.url, /test-secret/);
});

test("reporting routes require owner access and state-changing connect checks origin; no raw token response is returned", () => {
  for (const path of ["route.ts", "connect/route.ts", "callback/route.ts"]) {
    const source = readFileSync(new URL(`../../app/api/admin/ad-analytics/google/${path}`, import.meta.url), "utf8");
    assert.match(source, /await verifyAdminOwnerAccess\(\)/);
    assert.match(source, /if \(!auth.ok\)/);
    assert.doesNotMatch(source, /console\.(log|error)|NextResponse\.json\(token/);
  }
  const connect = readFileSync(new URL("../../app/api/admin/ad-analytics/google/connect/route.ts", import.meta.url), "utf8");
  assert.match(connect, /request.headers.get\("origin"\) !== request.nextUrl.origin/);
});
