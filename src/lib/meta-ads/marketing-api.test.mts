import assert from "node:assert/strict";
import test from "node:test";

import { fetchAdHierarchyWithInsights, pauseMetaAd } from "./marketing-api";
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

test("hierarchy requests omit Meta's fragile effective-status parameter", async () => {
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

  function requestFor(edge: "campaigns" | "adsets" | "ads"): URL {
    const request = urls.find((url) => url.pathname.endsWith(`/act_1711925889991527/${edge}`));
    assert.ok(request, `missing ${edge} request`);
    return request;
  }

  assert.equal(requestFor("campaigns").searchParams.has("effective_status"), false);
  assert.equal(requestFor("adsets").searchParams.has("effective_status"), false);
  assert.equal(requestFor("ads").searchParams.has("effective_status"), false);
});

test("pause requires acknowledgment and a matching PAUSED status from Meta", async () => {
  for (const [ack, readBack, expected] of [
    [true, { id: "1234567", status: "PAUSED" }, true],
    [false, { id: "1234567", status: "PAUSED" }, false],
    [true, { id: "1234567", status: "ACTIVE" }, false],
    [true, { id: "7654321", status: "PAUSED" }, false],
  ] as const) {
    const methods: string[] = [];
    const result = await pauseMetaAd({ adId: "1234567", accessToken: "test-token-not-real", fetchImpl: async (_url, options) => {
      methods.push(options?.method ?? "GET");
      return Response.json(options?.method === "POST" ? { success: ack } : readBack);
    } });
    assert.equal(result.ok, expected);
    assert.deepEqual(methods, ack ? ["POST", "GET"] : ["POST"]);
  }
});

test("pause verification read failure cannot be reported as success", async () => {
  const result = await pauseMetaAd({ adId: "1234567", accessToken: "test-token-not-real", fetchImpl: async (_url, options) =>
    options?.method === "POST" ? Response.json({ success: true }) : Response.json({ error: { code: 200, message: "Denied" } }, { status: 403 }) });
  assert.equal(result.ok, false);
});
