import assert from "node:assert/strict";
import test from "node:test";
import { NextResponse } from "next/server";
import { grantGuestListAccess, hasGuestListAccess } from "./guest-list-access.ts";

test("RSVP proof cannot be forged, reused for another party, or used after expiry", context => {
  const old = process.env.INVITATION_THEME_TOKEN_SECRET;
  process.env.INVITATION_THEME_TOKEN_SECRET = "test-only-guest-list-secret";
  context.after(() => { if (old === undefined) delete process.env.INVITATION_THEME_TOKEN_SECRET; else process.env.INVITATION_THEME_TOKEN_SECRET = old; });
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const response = grantGuestListAccess(NextResponse.json({ ok: true }), id);
  const setCookie = response.headers.get("set-cookie")!;
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=lax/i);
  const cookie = setCookie.split(";")[0];
  const req = (value: string) => new Request("https://example.com", { headers: { cookie: value } });
  assert.equal(hasGuestListAccess(req(cookie), id), true);
  assert.equal(hasGuestListAccess(req(""), id), false);
  assert.equal(hasGuestListAccess(req(cookie), other), false);
  assert.equal(hasGuestListAccess(req(cookie.replace(id, other)), other), false);
  assert.equal(hasGuestListAccess(req(cookie + "tampered"), id), false);
  const now = Date.now();
  context.mock.method(Date, "now", () => now + 181 * 86400000);
  assert.equal(hasGuestListAccess(req(cookie), id), false);
});
