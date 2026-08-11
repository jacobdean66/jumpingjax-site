import assert from "node:assert/strict";
import test from "node:test";

import {
  inclusiveDayCount,
  resolveMetaAdsDateRange,
} from "./dates";
import { mapMetaHttpFailure, redactProviderText } from "./errors";
import {
  humanizeActionType,
  normalizeActionResults,
  normalizeInsightsRow,
  safeDivide,
  zeroInsights,
} from "./normalize";
import { recomputeDerivedFromCounts } from "./dashboard-service";

test("resolveMetaAdsDateRange last_7d is inclusive and builds comparison window", () => {
  const now = new Date("2026-08-11T15:00:00Z");
  const result = resolveMetaAdsDateRange({ preset: "last_7d", now });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.range.dayCount, 7);
  assert.equal(result.range.until, "2026-08-11");
  assert.equal(result.range.since, "2026-08-05");
  assert.equal(result.range.comparisonUntil, "2026-08-04");
  assert.equal(result.range.comparisonSince, "2026-07-29");
  assert.equal(
    inclusiveDayCount(result.range.comparisonSince, result.range.comparisonUntil),
    7,
  );
});

test("resolveMetaAdsDateRange rejects inverted custom ranges", () => {
  const result = resolveMetaAdsDateRange({
    preset: "custom",
    since: "2026-08-10",
    until: "2026-08-01",
    now: new Date("2026-08-11T15:00:00Z"),
  });
  assert.equal(result.ok, false);
});

test("resolveMetaAdsDateRange maximum preset is allowed beyond custom ceiling", () => {
  const now = new Date("2026-08-11T15:00:00Z");
  const result = resolveMetaAdsDateRange({ preset: "maximum", now });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.range.preset, "maximum");
  assert.equal(result.range.until, "2026-08-11");
  assert.ok(result.range.dayCount > 366);
  assert.equal(
    inclusiveDayCount(result.range.comparisonSince, result.range.comparisonUntil),
    30,
  );
});

test("normalizeInsightsRow keeps unavailable distinct from zero", () => {
  const missing = normalizeInsightsRow(undefined);
  assert.equal(missing.spend.kind, "unavailable");
  assert.equal(missing.landingPageViews.kind, "unavailable");

  const zero = zeroInsights("2026-08-01", "2026-08-01");
  assert.equal(zero.spend.kind, "number");
  assert.equal(zero.spend.value, 0);
  assert.equal(zero.ctr.kind, "unavailable");
});

test("normalizeInsightsRow extracts landing-page views and derived metrics", () => {
  const insights = normalizeInsightsRow({
    spend: "3.00",
    impressions: "1000",
    reach: "500",
    clicks: "40",
    inline_link_clicks: "25",
    actions: [
      { action_type: "landing_page_view", value: "10" },
      { action_type: "link_click", value: "25" },
      { action_type: "lead", value: "2" },
    ],
    cost_per_action_type: [
      { action_type: "landing_page_view", value: "0.30" },
    ],
  });

  assert.equal(insights.spend.kind, "number");
  assert.equal(insights.spend.value, 3);
  assert.equal(insights.landingPageViews.kind, "number");
  assert.equal(insights.landingPageViews.value, 10);
  assert.equal(insights.linkClicks.kind, "number");
  assert.equal(insights.linkClicks.value, 25);
  assert.equal(insights.costPerLandingPageView.kind, "number");
  assert.equal(insights.costPerLandingPageView.value, 0.3);
  assert.ok(insights.results.some((row) => row.actionType === "lead"));
});

test("safeDivide and recomputeDerivedFromCounts avoid divide-by-zero", () => {
  assert.equal(safeDivide(10, 0).kind, "unavailable");
  assert.equal(safeDivide(null, 5).kind, "unavailable");
  const derived = recomputeDerivedFromCounts({
    spend: 10,
    impressions: 0,
    reach: 0,
    linkClicks: 0,
    landingPageViews: 0,
  });
  assert.equal(derived.ctr.kind, "unavailable");
  assert.equal(derived.cpc.kind, "unavailable");
  assert.equal(derived.costPerLandingPageView.kind, "unavailable");
});

test("normalizeActionResults prefers readable labels", () => {
  const results = normalizeActionResults(
    [{ action_type: "landing_page_view", value: "4" }],
    [{ action_type: "landing_page_view", value: "1.25" }],
    5,
  );
  assert.equal(results[0]?.label, "Landing-page views");
  assert.equal(humanizeActionType("link_click"), "Link clicks");
});

test("redactProviderText strips tokens from provider errors", () => {
  const redacted = redactProviderText(
    "Invalid OAuth access_token=EAAG123456789 secret bearer abc.def-ghi",
  );
  assert.equal(redacted.includes("EAAG123456789"), false);
  assert.equal(redacted.includes("access_token=EAAG"), false);
});

test("mapMetaHttpFailure classifies permission and rate limit errors", () => {
  const permission = mapMetaHttpFailure({
    httpStatus: 403,
    providerCode: 200,
    providerMessage: "(#200) Requires ads_read permission",
  });
  assert.equal(permission.code, "permission_missing");
  assert.equal(permission.freshness, "permission_blocked");

  const rate = mapMetaHttpFailure({
    httpStatus: 429,
    providerCode: 80004,
    providerMessage: "too many calls",
  });
  assert.equal(rate.code, "rate_limited");

  const expired = mapMetaHttpFailure({
    httpStatus: 401,
    providerCode: 190,
    providerMessage: "Invalid OAuth 2.0 Access Token EAAGSECRET",
  });
  assert.equal(expired.code, "token_expired");
  assert.equal(expired.message.includes("EAAGSECRET"), false);
});
