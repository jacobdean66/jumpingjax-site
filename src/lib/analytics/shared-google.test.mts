import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { encryptSharedGoogleToken, decryptSharedGoogleToken, reconcileGoogleReport, presentSavedGoogleReport, reportMatchesDates } from "./shared-google-core";
import { fetchGoogleAdsReport, googleReportingConfig } from "./google-reporting-core";
import { fetchSearchConsoleReport } from "./search-console-core";

const env = { ADMIN_SESSION_SECRET: "fixture-encryption-key" };
const config = googleReportingConfig({ GOOGLE_CLIENT_ID: "fixture", GOOGLE_CLIENT_SECRET: "fixture" });
const now = new Date("2026-10-23T01:00:00Z");
test("persistent reporting credentials are encrypted, service-bound, and reject tampering or key changes", () => {
  const value = encryptSharedGoogleToken("fixture-refresh-secret", "ads", env);
  assert.doesNotMatch(Buffer.from(value, "base64url").toString(), /fixture-refresh-secret/);
  assert.equal(decryptSharedGoogleToken(value, "ads", env), "fixture-refresh-secret");
  assert.equal(decryptSharedGoogleToken(value, "search_console", env), null);
  assert.equal(decryptSharedGoogleToken(value, "ads", { ADMIN_SESSION_SECRET: "other" }), null);
  const bytes = Buffer.from(value, "base64url"); bytes[15] ^= 1;
  assert.equal(decryptSharedGoogleToken(bytes.toString("base64url"), "ads", env), null);
  assert.throws(() => encryptSharedGoogleToken("fixture", "ads", {}));
});
test("failed refresh retains last successful numbers and timestamp with an explicit failure warning", async () => {
  const empty = await fetchGoogleAdsReport({ config, refreshToken: "", preset: "today", now });
  const good = { ...empty, status: "connected" as const, fetchedAt: now.toISOString(), totals: { clicks: 3, impressions: 100, spend: 2, savedRentalRequests: 1, ctr: 3, costPerRentalRequest: 2 } };
  const saved = reconcileGoogleReport(good, null, now);
  const failed = reconcileGoogleReport({ ...empty, status: "reconnect" }, saved, new Date("2026-10-23T02:00:00Z"));
  const shown = presentSavedGoogleReport(failed, empty);
  assert.equal(shown.totals?.spend, 2);
  assert.equal(shown.fetchedAt, now.toISOString());
  assert.equal(shown.freshness?.lastAttemptStatus, "reconnect");
  assert.match(shown.freshness?.warning || "", /last successful report/);
  assert.equal(reconcileGoogleReport(empty, null).report, null);
});
test("today and date-range snapshots cannot cross local midnight, including Pacific SEO dates", async () => {
  const ads = await fetchGoogleAdsReport({ config, refreshToken: "", preset: "today", now });
  assert.equal(reportMatchesDates(ads, "ads", "today", now), true);
  assert.equal(reportMatchesDates(ads, "ads", "today", new Date("2026-10-23T04:01:00Z")), false);
  const seo = await fetchSearchConsoleReport({ config, refreshToken: "", preset: "today", now });
  assert.equal(reportMatchesDates(seo, "search_console", "today", new Date("2026-10-23T04:01:00Z")), true);
  assert.equal(reportMatchesDates(seo, "search_console", "today", new Date("2026-10-23T07:01:00Z")), false);
  assert.equal(reportMatchesDates(ads, "ads", "last_30d", now), false);
});
test("shared connection, disconnect and cron routes enforce their authorization boundaries", () => {
  for (const route of ["share", "disconnect", "refresh"]) {
    const source = readFileSync(new URL(`../../app/api/admin/ad-analytics/google/${route}/route.ts`, import.meta.url), "utf8");
    assert.match(source, /await verifyAdminOwnerAccess\(\)/);
    assert.match(source, /if \(!auth.ok\)/);
    assert.match(source, /request.headers.get\("origin"\) !== request.nextUrl.origin/);
    assert.match(source, /private, no-store/);
  }
  const cron = readFileSync(new URL("../../app/api/cron/google-reporting/route.ts", import.meta.url), "utf8");
  assert.match(cron, /if \(!secret/);
  assert.match(cron, /timingSafeEqual/);
  assert.doesNotMatch(cron, /console\.|refreshToken|encryptedToken/);
  const schedule = JSON.parse(readFileSync(new URL("../../../vercel.json", import.meta.url), "utf8")).crons.find((row: { path: string }) => row.path === "/api/cron/google-reporting");
  assert.equal(schedule.schedule, "0 0,12,18 * * *");
  const store = readFileSync(new URL("./shared-google-store.ts", import.meta.url), "utf8");
  assert.match(store, /import "server-only"/);
  assert.match(store, /public: false/);
  assert.match(store, /bucket.data.public/);
  assert.doesNotMatch(store, /createSignedUrl|getPublicUrl/);
});
