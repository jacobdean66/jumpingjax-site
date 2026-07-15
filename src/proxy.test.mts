import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { proxy } from "./proxy";

test("legacy .net hosts redirect matching paths and preserve safe query parameters", () => {
  const response = proxy(
    new NextRequest(
      "https://jumpingjaxllc.net/api/rentals/confirm?id=booking-42&action=confirm&utm_source=legacy",
    ),
  );

  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get("location"),
    "https://jumpingjaxllc.com/api/rentals/confirm?id=booking-42&action=confirm&utm_source=legacy",
  );
});

test("legacy redirects remove OAuth and authentication secrets", () => {
  const response = proxy(
    new NextRequest(
      "https://www.jumpingjaxllc.net/rentals?source=legacy&code=oauth-code&state=oauth-state&TOKEN=secret",
    ),
  );
  const location = new URL(response.headers.get("location")!);

  assert.equal(location.origin, "https://jumpingjaxllc.com");
  assert.equal(location.pathname, "/rentals");
  assert.equal(location.searchParams.get("source"), "legacy");
  assert.equal(location.searchParams.has("code"), false);
  assert.equal(location.searchParams.has("state"), false);
  assert.equal(location.searchParams.has("TOKEN"), false);
});

test("canonical and preview hosts do not redirect", () => {
  const canonical = proxy(new NextRequest("https://jumpingjaxllc.com/rentals"));
  const preview = proxy(
    new NextRequest("https://jumpingjax-site-preview.vercel.app/rentals"),
  );

  assert.equal(canonical.headers.get("location"), null);
  assert.equal(preview.headers.get("location"), null);
});
