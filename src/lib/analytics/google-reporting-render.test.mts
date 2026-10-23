import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GooglePerformance } from "../../app/admin/ad-analytics/google/GooglePerformance";
import type { GoogleAdsReport } from "./google-reporting-core";

const report: GoogleAdsReport = {
  status: "not_connected", message: "Connect Google Ads to load performance.", fetchedAt: null,
  preset: "last_30d", since: "2026-09-23", until: "2026-10-22", customerId: "7151399909", campaignId: "24386017082",
  campaign: null, currency: "USD", timeZone: "America/New_York", totals: null,
};
test("unconnected performance renders unavailable metrics, without fabricated spend or lead counts", () => {
  const html = renderToStaticMarkup(createElement(GooglePerformance, { report }));
  assert.equal(html.match(/>Unavailable</g)?.length, 4);
  assert.doesNotMatch(html, /\$0\.00|>0<|Fetched/);
  assert.match(html, /715-139-9909/);
  assert.match(html, /role="status"/);
});
test("connected performance shows reported metrics, status and attribution, while main-page compact view links to the Google report", () => {
  const connected: GoogleAdsReport = { ...report, status: "connected", message: "Live Google Ads report.", fetchedAt: "2026-10-22T22:00:00Z",
    campaign: { name: "Inflatable Rentals - 15% Off", status: "PAUSED", dailyBudget: 10 },
    totals: { spend: 8.25, clicks: 10, impressions: 200, savedRentalRequests: 2, ctr: 5, costPerRentalRequest: 4.125 } };
  const html = renderToStaticMarkup(createElement(GooglePerformance, { report: connected, compact: true }));
  assert.match(html, /\$8\.25/);
  assert.match(html, /PAUSED/);
  assert.match(html, /\$10\.00 average daily budget/);
  assert.match(html, /Saved rental requests/);
  assert.match(html, /href="\/admin\/ad-analytics\/google"/);
  assert.match(html, /Requests are not paid bookings or revenue/);
});
test("today view labels its date and processing lag, and exposes stale-report warnings", () => {
  const html = renderToStaticMarkup(createElement(GooglePerformance, { report: { ...report, preset: "today", freshness: { source: "saved", lastAttemptAt: "2026-10-23T01:00:00Z", lastAttemptStatus: "reconnect", warning: "The latest refresh failed. Showing the last successful report." } } }));
  assert.match(html, /Today — Google Ads/);
  assert.match(html, /Google reporting can lag/);
  assert.match(html, /role="alert"/);
  assert.match(html, /Showing the last successful report/);
});
