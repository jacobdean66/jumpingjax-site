import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("giveaway status changes are owner-only and same-origin guarded", () => {
  const route = readFileSync(
    new URL("../../app/api/admin/giveaway/status/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /verifyAdminOwnerAccess/);
  assert.match(route, /validateOwnerPost/);
  assert.match(route, /set_giveaway_winner/);
  assert.match(route, /set_giveaway_free_pass_redeemed/);
});

test("giveaway tracking migration keeps one winner and protects status rows", () => {
  const migration = readFileSync(
    new URL("../../../supabase/migrations/20260904130000_create_giveaway_nominee_status.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /where is_winner = true/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all .* from anon, authenticated/i);
});

test("the giveaway page clearly shows a redeemed free pass", () => {
  const client = readFileSync(
    new URL("../../app/admin/giveaway/GiveawayDrawClient.tsx", import.meta.url),
    "utf8",
  );
  assert.match(client, /Child has used the free pass/);
  assert.match(client, /freePassRedeemed/);
});
