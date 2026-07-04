import assert from "node:assert/strict";
import test from "node:test";

import { fetchMetaAuthorizedAssets } from "./social-meta-asset-discovery-client";

test("fetchMetaAuthorizedAssets normalizes pages and instagram accounts", async () => {
  const result = await fetchMetaAuthorizedAssets({
    accessToken: "token",
    discoveryRunId: "meta-discovery:test",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: "111",
              name: "Page One",
              instagram_business_account: { id: "222", username: "pageone" },
            },
            { id: "333", name: "Page Two" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.pageCount, 2);
    assert.equal(result.instagramCount, 1);
    assert.equal(result.assets.length, 3);
    assert.equal(result.assets.filter((asset) => asset.assetKind === "facebook_page").length, 2);
    assert.equal(
      result.assets.filter((asset) => asset.assetKind === "instagram_business_account").length,
      1,
    );
  }
});

test("fetchMetaAuthorizedAssets uses bearer authorization", async () => {
  let authHeader = "";
  await fetchMetaAuthorizedAssets({
    accessToken: "secret-token",
    discoveryRunId: "meta-discovery:test",
    fetchImpl: async (_url, init) => {
      authHeader = String(init?.headers && (init.headers as Record<string, string>).Authorization);
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  assert.equal(authHeader, "Bearer secret-token");
});

console.log("social-meta-asset-discovery-client tests passed");
