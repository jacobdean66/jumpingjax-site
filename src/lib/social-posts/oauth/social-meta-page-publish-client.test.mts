import assert from "node:assert/strict";
import test from "node:test";

import { publishMetaPageFeedPost } from "./social-meta-page-publish-client";

test("publishMetaPageFeedPost uses bearer auth and returns external id", async () => {
  let authHeader = "";
  let method = "";
  const result = await publishMetaPageFeedPost({
    pageId: "111",
    pageAccessToken: "page-secret",
    message: "Hello",
    fetchImpl: async (_url, init) => {
      method = String(init?.method);
      authHeader = String(
        init?.headers && (init.headers as Record<string, string>).Authorization,
      );
      assert.equal(
        String(init?.body ?? "").includes("page-secret"),
        false,
        "token must not appear in form body",
      );
      return new Response(JSON.stringify({ id: "111_42" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  assert.equal(method, "POST");
  assert.equal(authHeader, "Bearer page-secret");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.externalPostId, "111_42");
    assert.equal(result.status, "published");
  }
});

console.log("social-meta-page-publish-client tests passed");
