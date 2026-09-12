import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const sql = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260912121000_add_waiver_participant_name_corrections.sql",
  ),
  "utf8",
);

test("name corrections are append-only and do not relax waiver participant immutability", () => {
  assert.match(sql, /create table if not exists public\.waiver_participant_name_corrections/);
  assert.match(sql, /execute function public\.prevent_append_only_mutation\(\)/);
  assert.doesNotMatch(sql, /drop trigger if exists prevent_waiver_participant_mutation_trg/);
  assert.doesNotMatch(sql, /alter table public\.waiver_participants\s+add column/i);
});

test("name correction RPC writes audit details and is service-role only", () => {
  assert.match(sql, /create or replace function public\.correct_waiver_participant_display_name_atomic\(p_payload jsonb\)/);
  assert.match(sql, /'waiver_participant_name_corrected'/);
  assert.match(sql, /'signedName'/);
  assert.match(sql, /revoke all on function public\.correct_waiver_participant_display_name_atomic\(jsonb\) from public, anon, authenticated;/);
  assert.match(sql, /grant execute on function public\.correct_waiver_participant_display_name_atomic\(jsonb\) to service_role;/);
});

test("staff search and same-day conflicts resolve latest corrected display names", () => {
  assert.match(sql, /drop function if exists public\.search_waiver_participants_for_staff\(text, integer\);/);
  assert.match(sql, /create function public\.search_waiver_participants_for_staff/);
  assert.match(sql, /coalesce\(c\.corrected_first_name, p\.first_name\) as first_name/);
  assert.match(sql, /grant execute on function public\.search_waiver_participants_for_staff\(text, integer\) to service_role;/);
  assert.match(sql, /create or replace function public\.list_open_play_same_day_conflicts/);
  assert.match(sql, /where a\.business_day_ymd = p_business_day_ymd/);
  assert.match(sql, /and a\.status = 'active'/);
  assert.match(sql, /grant execute on function public\.list_open_play_same_day_conflicts\(text, uuid\[\]\) to service_role;/);
});
