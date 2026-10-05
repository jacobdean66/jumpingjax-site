import assert from "node:assert/strict";
import test from "node:test";
import { loadMetaAnalyticsReadiness } from "./meta-analytics-readiness.ts";

const resolve = async () => ({ ok: true as const, accessToken: "fixture", publicationTargetId: "ad-analytics", sessionId: "fixture-session" });
test("analytics readiness uses a usable credential and actual ads_read instead of arbitrary session counts", async () => {
  const result = await loadMetaAnalyticsReadiness({ resolve, permissions: async ({ accessToken }) => {
    assert.equal(accessToken, "fixture");
    return { ok: true, hasAdsRead: true, hasAdsManagement: false, hasBusinessManagement: false, hasRequiredScopes: true, granted: ["ads_read"] };
  } });
  assert.equal(result.state, "connected");
  assert.equal(result.blocker, null);
  assert.doesNotMatch(JSON.stringify(result), /fixture/);
});
test("missing credentials and missing ads_read remain actionable blockers", async () => {
  const missing = await loadMetaAnalyticsReadiness({ resolve: async () => ({ ok: false, error: { code: "oauth_session_missing", message: "Connect Meta for Analytics.", freshness: "unavailable" } }), permissions: async () => { throw new Error("Must not query Meta without a credential"); } });
  assert.equal(missing.state, "setup_required");
  const noScope = await loadMetaAnalyticsReadiness({ resolve, permissions: async () => ({ ok: true, hasAdsRead: false, hasAdsManagement: true, hasBusinessManagement: true, hasRequiredScopes: false, granted: ["ads_management"] }) });
  assert.equal(noScope.state, "setup_required");
});
