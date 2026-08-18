import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);

test("adult attendance edit is staff-authenticated and uses atomic RPCs", async () => {
  const route = await readFile(
    new URL("src/app/api/admin/open-play/attendee-admission/route.ts", root),
    "utf8",
  );
  assert.match(route, /requireStaffAuth/);
  assert.match(route, /update_open_play_adult_attendance_atomic/);
  assert.match(route, /update_legacy_open_play_adult_attendance_atomic/);
  assert.match(route, /amountCents !== 700/);
});

test("adult attendance migration keeps pricing, ledger, audit, and legal copy together", async () => {
  const sql = await readFile(
    new URL("supabase/migrations/20260818220000_adult_open_play_attendance.sql", root),
    "utf8",
  );
  assert.match(sql, /playing_adult/);
  assert.match(sql, /watching_adult/);
  assert.match(sql, /v_target_amount := case when p_mode = 'playing' then 700 else 0 end/);
  assert.match(sql, /open_play_payment_entries/);
  assert.match(sql, /smartwaiver_legacy_payment_entries/);
  assert.match(sql, /open_play_audit_events/);
  assert.match(sql, /Watching adults are free; playing adults are \$7\./);
});
