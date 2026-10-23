import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fetchSearchConsoleReport, SEARCH_CONSOLE_SCOPE } from "./search-console-core";
import { buildGoogleAdsAuthorization, openGoogleAdsCookie, sealGoogleAdsCookie } from "./google-reporting-auth";
import { googleReportingConfig } from "./google-reporting-core";
import { SearchConsolePerformance } from "../../app/admin/ad-analytics/google/SearchConsolePerformance";

const config = googleReportingConfig({ GOOGLE_CLIENT_ID: "fixture-client", GOOGLE_CLIENT_SECRET: "fixture-secret" });
const now = new Date("2026-10-23T05:30:00Z");
function fixture(options: { failure?: number; scope?: string; empty?: boolean; sitemapFailure?: boolean; malformed?: boolean; domain?: boolean; unrelated?: boolean } = {}) {
  const calls: { url: string; body: unknown; method: string | undefined }[] = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url);
    calls.push({ url: target, body: init?.body, method: init?.method });
    assert.equal(init?.cache, "no-store");
    if (target.endsWith("/token")) return Response.json({ access_token: "fixture-access-secret", scope: options.scope || SEARCH_CONSOLE_SCOPE });
    if (options.failure) return Response.json({ error: "DO NOT EXPOSE fixture-access-secret" }, { status: options.failure });
    if (target.endsWith("/sites")) return Response.json({ siteEntry: [{ siteUrl: options.unrelated ? "https://unrelated.test/" : options.domain ? "sc-domain:jumpingjaxllc.com" : "https://jumpingjaxllc.com/", permissionLevel: "siteOwner" }] });
    if (target.endsWith("/sitemaps")) return options.sitemapFailure ? Response.json({ error: "fixture-secret" }, { status: 403 }) : Response.json({ sitemap: [{ path: "https://jumpingjaxllc.com/sitemap.xml", lastDownloaded: "2026-10-20T12:00:00Z", errors: "0", warnings: "1", isPending: false }, { path: "javascript:alert(1)" }] });
    assert.ok(target.endsWith("/searchAnalytics/query"));
    return Response.json({ rows: options.malformed ? "bad" : options.empty ? [] : [{ clicks: 152, impressions: 4290, ctr: 152 / 4290, position: 8.6 }] });
  }) as typeof fetch;
  return { fetcher, calls };
}
test("Search Console never fetches without its own authorization or invents zeros", async () => {
  const { fetcher, calls } = fixture();
  const report = await fetchSearchConsoleReport({ config, refreshToken: "", fetcher, now });
  assert.equal(report.status, "not_connected");
  assert.equal(report.totals, null);
  assert.equal(report.sitemaps, null);
  assert.equal(calls.length, 0);
});
test("Search Console uses Pacific dates, finalized aggregate data, allowed property and safe sitemap metadata", async () => {
  const { fetcher, calls } = fixture();
  const report = await fetchSearchConsoleReport({ config, refreshToken: "fixture-refresh-secret", fetcher, now, preset: "last_7d" });
  assert.equal(report.status, "connected");
  assert.equal(report.since, "2026-10-16");
  assert.equal(report.until, "2026-10-22");
  assert.equal(report.totals?.clicks, 152);
  assert.equal(report.totals?.ctr, 152 / 4290 * 100);
  assert.equal(report.totals?.position, 8.6);
  assert.equal(report.sitemaps?.length, 1);
  assert.equal(report.sitemaps?.[0].warnings, 1);
  const query = calls.find(call => call.url.endsWith("/searchAnalytics/query"))!;
  assert.deepEqual(JSON.parse(String(query.body)), { startDate: "2026-10-16", endDate: "2026-10-22", type: "web", dataState: "final", rowLimit: 1 });
  assert.ok(query.url.includes(encodeURIComponent("https://jumpingjaxllc.com/")));
  assert.doesNotMatch(JSON.stringify(report), /fixture.*secret/);
  assert.equal(calls.length, 4);
});
test("empty successful reports mean no finalized activity, not missing access", async () => {
  const { fetcher } = fixture({ empty: true });
  const report = await fetchSearchConsoleReport({ config, refreshToken: "fixture", fetcher, now });
  assert.equal(report.status, "connected");
  assert.deepEqual(report.totals, { clicks: 0, impressions: 0, ctr: null, position: null });
});
test("today without finalized organic rows stays unavailable rather than claiming zero visits", async () => {
  const { fetcher } = fixture({ empty: true });
  const report = await fetchSearchConsoleReport({ config, refreshToken: "fixture", fetcher, now, preset: "today" });
  assert.equal(report.status, "connected");
  assert.equal(report.totals, null);
  assert.match(report.message, /not published finalized/);
  assert.ok(report.sitemaps);
});
test("domain property is supported but unrelated properties are never queried", async () => {
  const good = fixture({ domain: true });
  assert.equal((await fetchSearchConsoleReport({ config, refreshToken: "fixture", fetcher: good.fetcher, now })).property, "sc-domain:jumpingjaxllc.com");
  const other = fixture({ unrelated: true });
  assert.equal((await fetchSearchConsoleReport({ config, refreshToken: "fixture", fetcher: other.fetcher, now })).status, "permission_required");
  assert.equal(other.calls.length, 2);
});
test("provider errors, wrong scope and malformed rows remain unavailable and redact secrets", async () => {
  for (const [options, status] of [[{ failure: 403 }, "permission_required"], [{ failure: 401 }, "reconnect"], [{ failure: 429 }, "unavailable"], [{ scope: "calendar" }, "reconnect"], [{ malformed: true }, "unavailable"]] as const) {
    const { fetcher } = fixture(options);
    const report = await fetchSearchConsoleReport({ config, refreshToken: "fixture", fetcher, now });
    assert.equal(report.status, status);
    assert.equal(report.totals, null);
    assert.doesNotMatch(JSON.stringify(report), /fixture.*secret|DO NOT EXPOSE/);
  }
});
test("sitemap failure preserves successful performance with an explicit missing-status message", async () => {
  const { fetcher } = fixture({ sitemapFailure: true });
  const report = await fetchSearchConsoleReport({ config, refreshToken: "fixture", fetcher, now });
  assert.equal(report.status, "connected");
  assert.equal(report.totals?.clicks, 152);
  assert.equal(report.sitemaps, null);
  assert.match(report.sitemapMessage!, /could not be loaded/);
});
test("Search Console consent is read-only, uses the existing callback, and its cookie cannot be used as Ads authorization", () => {
  const env = { ADMIN_SESSION_SECRET: "test-only-encryption-key", GOOGLE_CLIENT_ID: "fixture", GOOGLE_CLIENT_SECRET: "fixture" };
  const authorization = buildGoogleAdsAuthorization(env, "https://jumpingjaxllc.com", "owner", "search_console")!;
  const url = new URL(authorization.url);
  assert.equal(url.searchParams.get("scope"), SEARCH_CONSOLE_SCOPE);
  assert.equal(url.searchParams.get("redirect_uri"), "https://jumpingjaxllc.com/api/admin/ad-analytics/google/callback");
  assert.equal(openGoogleAdsCookie(authorization.cookie, env, "state")?.service, "search_console");
  const cookie = sealGoogleAdsCookie({ refreshToken: "fixture-refresh-secret" }, env, "search_console", 60);
  assert.equal(openGoogleAdsCookie(cookie, env, "connection"), null);
  assert.equal(openGoogleAdsCookie(cookie, env, "search_console")?.refreshToken, "fixture-refresh-secret");
});
test("organic report renders unavailable, read-only consent, and actual metrics without implying live indexing totals", async () => {
  const disconnected = await fetchSearchConsoleReport({ config, refreshToken: "", now });
  const html = renderToStaticMarkup(createElement(SearchConsolePerformance, { report: disconnected, canConnect: true }));
  assert.equal(html.match(/>Unavailable</g)?.length, 4);
  assert.match(html, /Connect Search Console/);
  assert.match(html, /separate read-only/);
  assert.match(html, /indexed-page totals/);
  const { fetcher } = fixture();
  const connected = await fetchSearchConsoleReport({ config, refreshToken: "fixture", fetcher, now });
  const connectedHtml = renderToStaticMarkup(createElement(SearchConsolePerformance, { report: connected, canConnect: true }));
  assert.match(connectedHtml, /4,290/);
  assert.match(connectedHtml, /Processing completed/);
  assert.doesNotMatch(connectedHtml, /Connect Search Console|javascript:/);
});
