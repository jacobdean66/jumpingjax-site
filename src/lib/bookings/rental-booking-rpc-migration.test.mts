import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260822220000_repair_and_version_rental_booking_atomic.sql",
    import.meta.url,
  ),
  "utf8",
);
const bookingData = readFileSync(
  new URL("../supabase/booking-data.ts", import.meta.url),
  "utf8",
);

test("rental bookings use the drift-resistant versioned RPC", () => {
  assert.match(bookingData, /\.rpc\("create_rental_booking_atomic_v2"/);
  assert.doesNotMatch(bookingData, /\.rpc\("create_rental_booking_atomic"/);
});

test("the versioned RPC preserves the production bigint cast and foam duration", () => {
  assert.match(
    migration,
    /create or replace function public\.create_rental_booking_atomic_v2/,
  );
  assert.match(
    migration,
    /b\.event_date \+ \(\(greatest\(coalesce\(b\.span_days, 1\), 1\) - 1\)::integer\)/,
  );
  assert.match(migration, /event_date, duration, foam_duration, span_days/);
  assert.match(migration, /rental_booking_atomic_v2 verification failed/);
});

test("the legacy RPC delegates to v2 during rollout", () => {
  assert.match(
    migration,
    /select public\.create_rental_booking_atomic_v2\(p_booking, p_items, p_idempotency_key\)/,
  );
});
