import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./session.ts", import.meta.url), "utf8");

test("admin access helpers authenticate with the canonical session cookie only", () => {
  assert.doesNotMatch(source, /verifyAdminDeliveryToken|verifyAdminOwnerToken/);
  assert.equal((source.match(/cookieAuth\(\)/g) ?? []).length, 3);
});

test("owner access still rejects employee sessions", () => {
  assert.match(source, /auth\.role === "owner"/);
  assert.match(source, /\{ ok: false, reason: "invalid_token" \}/);
});
