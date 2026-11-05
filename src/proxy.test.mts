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

test("signed invitation links redirect before rendering and scope the HttpOnly cookie to one preview", async t => {
  const { previewToken, validPreviewSession, PREVIEW_SESSION_COOKIE } =
    await import("./lib/facility-parties/preview-session");
  const enabled = process.env.RECEPTIONIST_INVITATION_PREVIEW_ENABLED;
  const signing = process.env.RECEPTIONIST_INVITATION_PREVIEW_SIGNING_KEY;
  t.after(() => {
    if (enabled === undefined) delete process.env.RECEPTIONIST_INVITATION_PREVIEW_ENABLED;
    else process.env.RECEPTIONIST_INVITATION_PREVIEW_ENABLED = enabled;
    if (signing === undefined) delete process.env.RECEPTIONIST_INVITATION_PREVIEW_SIGNING_KEY;
    else process.env.RECEPTIONIST_INVITATION_PREVIEW_SIGNING_KEY = signing;
  });
  process.env.RECEPTIONIST_INVITATION_PREVIEW_ENABLED = "true";
  process.env.RECEPTIONIST_INVITATION_PREVIEW_SIGNING_KEY = "synthetic-preview-signing-key-0123456";
  const id = "1ecf032f-f261-44fb-a0e0-fc180e456789";
  const path = `/facility-invitation-previews/${id}`;
  const base = `https://jumpingjaxllc.com${path}`;
  const token = previewToken(id)!;
  const request = (value: string, headers?: Record<string, string>) =>
    new NextRequest(`${base}?token=${value}&extra=${value}`, { headers });

  for (const headers of [undefined, { RSC: "1", "next-router-prefetch": "1" }]) {
    const response = proxy(request(token, headers));
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), base);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(await response.text(), "");
    const cookie = response.cookies.get(PREVIEW_SESSION_COOKIE)!;
    assert.equal(cookie.path, path);
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.secure, true);
    assert.equal(cookie.sameSite, "lax");
    assert.notEqual(cookie.value, token);
    assert.ok(validPreviewSession(id, cookie.value));
    assert.ok(!validPreviewSession("36fb225d-20d7-4b77-9bfb-bdc4875316de", cookie.value));
  }

  const nested = proxy(new NextRequest(`${base}/missing?TOKEN=${token}`));
  assert.equal(nested.headers.get("location"), base + "/missing");
  assert.equal(nested.headers.get("set-cookie"), null);
  assert.equal(await nested.text(), "");

  const legacy = proxy(new NextRequest(`https://jumpingjaxllc.net${path}?token=${token}&extra=${token}`));
  assert.equal(legacy.headers.get("location"), base);
  assert.equal(legacy.headers.get("set-cookie"), null);
  assert.equal(await legacy.text(), "");

  const invalid = proxy(request("invalid"));
  assert.equal(invalid.headers.get("location"), base);
  assert.equal(invalid.headers.get("set-cookie"), null);
  process.env.RECEPTIONIST_INVITATION_PREVIEW_ENABLED = "false";
  assert.equal(proxy(request(token)).headers.get("set-cookie"), null);
  assert.equal(proxy(new NextRequest(base)).headers.get("location"), null);
});
