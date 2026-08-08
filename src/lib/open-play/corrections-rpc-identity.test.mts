import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const identityMigrationPath = path.join(
  root,
  "supabase/migrations/20260806160000_open_play_correction_rpc_entry_identity.sql",
);
const historicalMigrationPath = path.join(
  root,
  "supabase/migrations/20260804010000_create_native_waiver_open_play.sql",
);

const identitySql = readFileSync(identityMigrationPath, "utf8");
const historicalSql = readFileSync(historicalMigrationPath, "utf8");

function extractFunction(sql: string, name: string): string {
  const start = sql.indexOf(`create or replace function public.${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const next = sql.indexOf("create or replace function public.", start + 10);
  const endGrant = sql.indexOf("\nrevoke all on function public.", start + 10);
  const end = [next, endGrant]
    .filter((value) => value >= 0)
    .reduce((min, value) => Math.min(min, value), sql.length);
  return sql.slice(start, end);
}

function sectionAfter(fn: string, marker: string): string {
  const at = fn.indexOf(marker);
  assert.ok(at >= 0, `missing section ${marker}`);
  return fn.slice(at);
}

test("identity migration replaces correction RPC without editing historical migration", () => {
  assert.match(
    identitySql,
    /create or replace function public\.apply_open_play_visit_correction_atomic\(p_payload jsonb\)/,
  );
  // Historical success entries still omit identity (forward-only fix).
  const historicalFn = extractFunction(
    historicalSql,
    "apply_open_play_visit_correction_atomic",
  );
  const historicalEntries = historicalFn.match(
    /v_entries := jsonb_build_array\([\s\S]*?\);/g,
  );
  assert.ok(historicalEntries && historicalEntries.length >= 4);
  for (const block of historicalEntries) {
    assert.doesNotMatch(block, /'attendee_id'/);
    assert.doesNotMatch(block, /'related_entry_id'/);
  }
});

test("identity migration preserves signature, security definer, and search_path", () => {
  const fn = extractFunction(
    identitySql,
    "apply_open_play_visit_correction_atomic",
  );
  assert.match(
    fn,
    /^create or replace function public\.apply_open_play_visit_correction_atomic\(p_payload jsonb\)\s+returns jsonb\s+language plpgsql\s+security definer\s+set search_path = public, pg_temp/m,
  );
});

test("identity migration preserves service_role execute grant", () => {
  assert.match(
    identitySql,
    /grant execute on function public\.apply_open_play_visit_correction_atomic\(jsonb\) to service_role;/,
  );
  assert.match(
    identitySql,
    /revoke all on function public\.apply_open_play_visit_correction_atomic\(jsonb\) from public, anon, authenticated;/,
  );
});

test("identity migration dollar-quote delimiters are balanced", () => {
  const opens = identitySql.match(/\bas\s+\$\$/g) ?? [];
  const closes = identitySql.match(/\$\$;/g) ?? [];
  assert.equal(opens.length, 1);
  assert.equal(closes.length, 1);
});

test("method_correction success entries include ledger attendee_id and related_entry_id", () => {
  const fn = extractFunction(
    identitySql,
    "apply_open_play_visit_correction_atomic",
  );
  const methodSection = sectionAfter(fn, "if v_type = 'method_correction'");
  const next = methodSection.search(/\n  elsif v_type =/);
  const block = methodSection.slice(0, next);
  const entriesAt = block.indexOf("v_entries := jsonb_build_array");
  assert.ok(entriesAt > 0);
  const entries = block.slice(entriesAt);
  assert.match(entries, /'attendee_id',\s*v_related\.attendee_id/);
  assert.match(entries, /'related_entry_id',\s*v_related_id/);
  // Debit and credit both carry identity.
  assert.equal(
    (entries.match(/'attendee_id',\s*v_related\.attendee_id/g) ?? []).length,
    2,
  );
  assert.equal(
    (entries.match(/'related_entry_id',\s*v_related_id/g) ?? []).length,
    2,
  );
  assert.doesNotMatch(entries, /p_payload\s*->>\s*'attendee_id'/);
});

test("void success entry includes ledger attendee_id and related_entry_id", () => {
  const fn = extractFunction(
    identitySql,
    "apply_open_play_visit_correction_atomic",
  );
  const voidSection = sectionAfter(fn, "elsif v_type = 'void'");
  const next = voidSection.search(/\n  elsif v_type =/);
  const block = voidSection.slice(0, next);
  const entriesAt = block.indexOf("v_entries := jsonb_build_array");
  const entries = block.slice(entriesAt);
  assert.match(entries, /'attendee_id',\s*v_related\.attendee_id/);
  assert.match(entries, /'related_entry_id',\s*v_related_id/);
  assert.doesNotMatch(entries, /p_payload\s*->>\s*'attendee_id'/);
});

test("refund success entry includes ledger attendee_id and related_entry_id", () => {
  const fn = extractFunction(
    identitySql,
    "apply_open_play_visit_correction_atomic",
  );
  const refundSection = sectionAfter(fn, "elsif v_type = 'refund'");
  const next = refundSection.search(/\n  elsif v_type =/);
  const block = refundSection.slice(0, next);
  const entriesAt = block.indexOf("v_entries := jsonb_build_array");
  const entries = block.slice(entriesAt);
  assert.match(entries, /'attendee_id',\s*v_related\.attendee_id/);
  assert.match(entries, /'related_entry_id',\s*v_related_id/);
  assert.doesNotMatch(entries, /p_payload\s*->>\s*'attendee_id'/);
});

test("remove_attendee void success entry uses v_attendee_id and v_related_id", () => {
  const fn = extractFunction(
    identitySql,
    "apply_open_play_visit_correction_atomic",
  );
  const removeSection = sectionAfter(fn, "elsif v_type = 'remove_attendee'");
  const entriesAt = removeSection.indexOf("v_entries := jsonb_build_array");
  assert.ok(entriesAt > 0);
  const entries = removeSection.slice(entriesAt);
  assert.match(entries, /'attendee_id',\s*v_attendee_id/);
  assert.match(entries, /'related_entry_id',\s*v_related_id/);
  assert.doesNotMatch(entries, /'attendee_id',\s*v_related\.attendee_id/);
  assert.doesNotMatch(entries, /p_payload\s*->>\s*'attendee_id'/);
});

test("remove_attendee financial_reversal_required does not emit success entries", () => {
  const fn = extractFunction(
    identitySql,
    "apply_open_play_visit_correction_atomic",
  );
  const removeSection = sectionAfter(fn, "elsif v_type = 'remove_attendee'");
  assert.match(
    removeSection,
    /return jsonb_build_object\(\s*'outcome',\s*'financial_reversal_required',\s*'related_entry_id',\s*v_related_id\s*\)/,
  );
  // No success-entry assignment before financial_reversal_required return.
  const reversalAt = removeSection.indexOf("financial_reversal_required");
  const before = removeSection.slice(0, reversalAt);
  assert.doesNotMatch(before, /v_entries := jsonb_build_array/);
});

test("success entry identity is not fabricated from request-body attendee_id", () => {
  const fn = extractFunction(
    identitySql,
    "apply_open_play_visit_correction_atomic",
  );
  const entryBlocks = fn.match(/v_entries := jsonb_build_array\([\s\S]*?\);/g);
  assert.ok(entryBlocks && entryBlocks.length === 4);
  for (const block of entryBlocks) {
    assert.match(block, /'attendee_id'/);
    assert.match(block, /'related_entry_id',\s*v_related_id/);
    assert.doesNotMatch(block, /p_payload/);
    assert.doesNotMatch(block, /nullif\(p_payload/);
  }
});
