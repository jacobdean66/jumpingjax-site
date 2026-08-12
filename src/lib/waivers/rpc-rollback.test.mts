import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { BodyTooLargeError, readRequestTextWithLimit } from "./read-body";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const migration = readFileSync(
  path.join(root, "supabase/migrations/20260804010000_create_native_waiver_open_play.sql"),
  "utf8",
);

function extractFunction(name: string): string {
  const start = migration.indexOf(`create or replace function public.${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const next = migration.indexOf("create or replace function public.", start + 10);
  return next >= 0 ? migration.slice(start, next) : migration.slice(start);
}

test("create_open_play_visit_atomic raises after DML instead of soft-returning", () => {
  const fn = extractFunction("create_open_play_visit_atomic");
  const insertVisitAt = fn.indexOf("insert into public.open_play_visits");
  assert.ok(insertVisitAt > 0);
  const afterDml = fn.slice(insertVisitAt);
  const exceptionAt = afterDml.lastIndexOf("\nexception");
  assert.ok(exceptionAt > 0);
  const mainBodyAfterDml = afterDml.slice(0, exceptionAt);
  // Soft outcome returns after visit insert must not remain in the main body.
  assert.doesNotMatch(
    mainBodyAfterDml,
    /return jsonb_build_object\(\s*'outcome',\s*'(duplicate_same_day_attendee|payment_method_required|free_attendee_cannot_have_payment_method)'/,
  );
  assert.match(mainBodyAfterDml, /raise exception using errcode = 'P0001'/);
  assert.match(fn, /when sqlstate 'P0001'/);
  // Pre-validation still soft-returns before DML.
  const beforeDml = fn.slice(0, insertVisitAt);
  assert.match(beforeDml, /payment_method_required/);
  assert.match(beforeDml, /free_attendee_cannot_have_payment_method/);
});

test("apply_open_play_visit_correction_atomic raises on post-DML attendee failure", () => {
  const fn = extractFunction("apply_open_play_visit_correction_atomic");
  assert.match(fn, /raise exception using errcode = 'P0001',\s*message = 'attendee_not_found_or_removed'/);
  assert.match(fn, /when sqlstate 'P0001'/);
  // Void path validates attendee before inserting void.
  const voidSection = fn.slice(fn.indexOf("elsif v_type = 'void'"));
  const voidInsert = voidSection.indexOf("insert into public.open_play_payment_entries");
  assert.ok(voidInsert > 0);
  assert.match(voidSection.slice(0, voidInsert), /attendee_not_found_or_removed/);
});

test("submit RPC validates consent and DOB in SQL before DML", () => {
  const fn = extractFunction("submit_native_waiver_atomic");
  const insertAt = fn.indexOf("insert into public.waiver_submissions");
  const before = fn.slice(0, insertAt);
  assert.match(before, /consent_required/);
  assert.match(before, /future_dob/);
  assert.match(before, /invalid_dob/);
  assert.match(fn, /when sqlstate 'P0001'/);
  assert.doesNotMatch(fn, /error_message',\s*SQLERRM/);
});

test("charge insert must match attendee unit_price_cents", () => {
  assert.match(migration, /charge_amount_mismatch/);
  assert.match(
    migration,
    /a\.unit_price_cents = new\.amount_cents/,
  );
});

test("open_play_visits identity fields are immutable except supported status transitions", () => {
  assert.match(migration, /prevent_open_play_visit_rewrite/);
  assert.match(migration, /unsupported open_play_visit status transition/);
});

test("bounded body reader rejects oversized streams early", async () => {
  const encoder = new TextEncoder();
  const chunks = [encoder.encode("a".repeat(100)), encoder.encode("b".repeat(100))];
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(chunks[i++]);
    },
  });
  const req = new Request("http://localhost/api/waiver/submit", {
    method: "POST",
    body: stream,
    // @ts-expect-error undici duplex for streaming body in Node
    duplex: "half",
  });
  await assert.rejects(
    () => readRequestTextWithLimit(req, 150),
    BodyTooLargeError,
  );
});
