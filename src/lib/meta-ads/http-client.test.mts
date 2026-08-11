import assert from "node:assert/strict";
import test from "node:test";

import { metaAdsGraphGetAllPages } from "./http-client";

test("metaAdsGraphGetAllPages paginates without duplicating rows", async () => {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (!url.includes("after=")) {
      return new Response(
        JSON.stringify({
          data: [{ id: "1" }, { id: "2" }],
          paging: { cursors: { after: "cursor-a" } },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({
        data: [{ id: "3" }],
        paging: {},
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const result = await metaAdsGraphGetAllPages<{ id: string }>({
    path: "me/adaccounts",
    accessToken: "test-token-not-real",
    fetchImpl,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.data.map((row) => row.id),
    ["1", "2", "3"],
  );
  assert.equal(calls.length, 2);
  assert.equal(calls.some((url) => url.includes("access_token=")), false);
});

test("metaAdsGraphGetAllPages sanitizes permission errors", async () => {
  const result = await metaAdsGraphGetAllPages({
    path: "me/adaccounts",
    accessToken: "test-token-not-real",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          error: {
            message: "Requires ads_read permission token=EAAGREAL",
            type: "OAuthException",
            code: 200,
          },
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ),
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "permission_missing");
  assert.equal(result.error.message.includes("EAAGREAL"), false);
});
