import assert from "node:assert/strict";
import test from "node:test";
import { fetchGoogleAdsReport, googleReportingConfig } from "./google-reporting-core";

test("the contest campaign report is isolated from the discount campaign and rental conversion", async () => {
  const queries: string[] = [];
  const fetcher = (async (url: string | URL | Request, options?: RequestInit) => {
    if (String(url).includes("oauth2.googleapis.com")) return Response.json({ access_token: "unit-test-access" });
    const query = JSON.parse(String(options?.body)).query as string;
    queries.push(query);
    const results = query.includes("FROM customer") ? [{ customer: { id: "7151399909", currencyCode: "USD", timeZone: "America/New_York" } }]
      : query.includes("campaign_budget") ? [{ campaign: { id: "9990001", name: "Backyard Takeover", status: "PAUSED" }, campaignBudget: { amountMicros: "10000000" } }]
      : [{ metrics: { clicks: "7", impressions: "100", costMicros: "2500000" } }];
    return Response.json([{ results }]);
  }) as typeof fetch;
  const report = await fetchGoogleAdsReport({ config: googleReportingConfig({ GOOGLE_CLIENT_ID: "fixture", GOOGLE_CLIENT_SECRET: "fixture" }), refreshToken: "unit-test-refresh", campaignId: "9990001", trafficOnly: true, fetcher });
  assert.equal(report.status, "connected"); assert.equal(report.campaignId, "9990001"); assert.equal(report.totals?.clicks, 7);
  assert.ok(queries.filter(query => query.includes("FROM campaign")).every(query => query.includes("campaign.id = 9990001")));
  assert.ok(queries.every(query => !query.includes("24386017082") && !query.includes("7823548968") && !query.includes("metrics.conversions")));
});

test("invalid configured campaign identifiers cannot become GAQL", async () => {
  let called = false;
  const report = await fetchGoogleAdsReport({ config: googleReportingConfig({ GOOGLE_CLIENT_ID: "fixture", GOOGLE_CLIENT_SECRET: "fixture" }), refreshToken: "fixture", campaignId: "1 OR 1=1", trafficOnly: true, fetcher: (async () => { called = true; return Response.json({}); }) as typeof fetch });
  assert.equal(report.status, "unavailable"); assert.equal(report.totals, null); assert.equal(called, false);
});
