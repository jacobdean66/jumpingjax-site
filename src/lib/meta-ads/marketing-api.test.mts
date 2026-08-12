import assert from "node:assert/strict";
import test from "node:test";

import { fetchAdHierarchyWithInsights } from "./marketing-api";
import type { MetaAdsResolvedDateRange } from "./dates";

const range: MetaAdsResolvedDateRange = {
  preset: "last_7d",
  since: "2026-08-06",
  until: "2026-08-12",
  comparisonSince: "2026-07-30",
  comparisonUntil: "2026-08-05",
  label: "Last 7 days",
  dayCount: 7,
};

test("hierarchy requests use object-specific Meta effective-status enums", async () => {
  const urls: URL[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    urls.push(new URL(String(input)));
    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const result = await fetchAdHierarchyWithInsights({
    accessToken: "test-token-not-real",
    accountId: "1711925889991527",
    range,
    comparisonRange: {
      ...range,
      since: range.comparisonSince,
      until: range.comparisonUntil,
    },
    fetchImpl,
  });

  assert.equal(result.ok, true);

  function statusesFor(edge: "campaigns" | "adsets" | "ads"): string[] {
    const request = urls.find((url) => url.pathname.endsWith(`/act_1711925889991527/${edge}`));
    assert.ok(request, `missing ${edge} request`);
    return JSON.parse(request.searchParams.get("effective_status") ?? "[]") as string[];
  }

  assert.deepEqual(statusesFor("campaigns"), [
    "ACTIVE",
    "ARCHIVED",
    "DELETED",
    "IN_PROCESS",
    "PAUSED",
    "WITH_ISSUES",
  ]);
  assert.deepEqual(statusesFor("adsets"), [
    "ACTIVE",
    "ARCHIVED",
    "CAMPAIGN_PAUSED",
    "DELETED",
    "IN_PROCESS",
    "PAUSED",
    "WITH_ISSUES",
  ]);
  assert.deepEqual(statusesFor("ads"), [
    "ACTIVE",
    "ADSET_PAUSED",
    "ARCHIVED",
    "CAMPAIGN_PAUSED",
    "DELETED",
    "DISAPPROVED",
    "IN_PROCESS",
    "PAUSED",
    "PENDING_BILLING_INFO",
    "PENDING_REVIEW",
    "PREAPPROVED",
    "WITH_ISSUES",
  ]);
});
