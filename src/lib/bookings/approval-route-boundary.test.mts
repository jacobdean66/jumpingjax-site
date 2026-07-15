import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

for (const [kind, path] of [
  ["facility", "../../app/api/facility/confirm/route.ts"],
  ["rental", "../../app/api/rentals/confirm/route.ts"],
] as const) {
  test(`${kind} approval GET is review-only and POST owns the transition`, () => {
    const text = source(path);
    const getBody = text.slice(text.indexOf("export async function GET"), text.indexOf("export async function POST"));
    assert.match(getBody, /renderApprovalReview/);
    assert.doesNotMatch(getBody, /handle.*Confirm|\.update\(|emails\.send|createGoogleCalendarEvent/);
    assert.match(text.slice(text.indexOf("export async function POST")), /resolveDecisionRequest/);
  });
}

test("atomic migration locks, checks, and writes rental cart rows transactionally", () => {
  const sql = source("../../../supabase/migrations/20260715190000_atomic_booking_creation.sql");
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /insert into public\.booking_rental_items/);
  assert.match(sql, /booking_conflict/);
  assert.match(sql, /idempotency_key/);
});
