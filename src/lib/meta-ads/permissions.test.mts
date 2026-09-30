import assert from "node:assert/strict";
import test from "node:test";
import { checkMetaAdsReadPermission } from "./permissions";

test("a permission read failure retains provider failure rather than asserting missing scopes", async () => {
  for (const [status, providerCode, expected] of [[429, 613, "rate_limited"], [500, 1, "provider_error"], [401, 190, "token_expired"]] as const) {
    const result = await checkMetaAdsReadPermission({ accessToken: "fixture", fetchImpl: async () => new Response(JSON.stringify({ error: { code: providerCode, message: "Provider unavailable" } }), { status }) });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, expected);
    assert.equal(result.hasAdsManagement, false);
  }
});

test("ads_read allows reporting without claiming ad pause permission", async () => {
  const result = await checkMetaAdsReadPermission({ accessToken: "fixture", fetchImpl: async () => new Response(JSON.stringify({ data: [
    { permission: "ads_read", status: "granted" },
    { permission: "ads_management", status: "declined" },
  ] })) });
  assert.equal(result.ok, true);
  assert.equal(result.hasRequiredScopes, true);
  assert.equal(result.hasAdsManagement, false);
});
