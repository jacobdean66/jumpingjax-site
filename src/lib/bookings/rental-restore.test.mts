import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260819143000_fix_restore_rental_span_days_date_cast.sql",
    import.meta.url,
  ),
  "utf8",
);
const route = readFileSync(
  new URL("../../app/api/admin/rentals/[id]/restore/route.ts", import.meta.url),
  "utf8",
);
const button = readFileSync(
  new URL("../../app/admin/rentals/RentalRestoreButton.tsx", import.meta.url),
  "utf8",
);

test("restore checks every stored item across the complete date span under shared locks", () => {
  assert.match(migration, /array_agg\(distinct rental_item[\s\S]*booking_rental_items/);
  assert.match(
    migration,
    /v_span_days integer[\s\S]*greatest\(coalesce\(v_booking\.span_days, 1\), 1\)::integer/,
  );
  assert.match(migration, /foreach v_item in array v_items/);
  assert.match(migration, /generate_series\([\s\S]*v_booking\.event_date \+ \(v_span_days - 1\)/);
  assert.match(migration, /hashtextextended\(v_item \|\| ':' \|\| v_lock_date::text, 0\)/);
});

test("one active item or one overlapping day prevents restore", () => {
  assert.match(migration, /other\.status[\s\S]*'pending', 'approved', 'blocked'/);
  assert.match(migration, /other\.event_date <=[\s\S]*v_span_days - 1/);
  assert.match(
    migration,
    /other\.event_date \+ \(\(greatest\(coalesce\(other\.span_days, 1\), 1\) - 1\)::integer\) >=[\s\S]*v_booking\.event_date/,
  );
  assert.match(migration, /other_item\.rental_item = proposed\.item/);
  assert.match(migration, /'outcome', 'booking_conflict'/);
  assert.match(route, /is unavailable on \$\{date\}/);
});

test("disabled inventory prevents restore without requiring public visibility", () => {
  assert.match(migration, /rental_inventory_items/);
  assert.match(migration, /rii\.is_active is false/);
  assert.doesNotMatch(migration, /public_visible is false/);
  assert.match(migration, /'outcome', 'inventory_unavailable'/);
});

test("successful restore updates the original booking to pending and clears stale routes", () => {
  assert.match(migration, /update public\.bookings[\s\S]*set status = 'pending'/);
  assert.match(migration, /update public\.booking_rental_items/);
  for (const field of [
    "delivery_truck = null",
    "trailer_load = null",
    "pickup_truck = null",
    "pickup_trailer_load = null",
  ]) {
    assert.match(migration, new RegExp(field));
  }
  assert.doesNotMatch(migration, /insert into public\.bookings/);
});

test("restore is idempotent and duplicate button presses are disabled", () => {
  assert.match(migration, /'outcome', 'already_restored'/);
  assert.match(button, /if \(isWorking\) return/);
  assert.match(button, /disabled=\{isWorking\}/);
  assert.match(button, /Confirm restore/);
});

test("restore requires owner access and does not invoke email or calendar integrations", () => {
  assert.match(route, /verifyAdminOwnerAccess/);
  assert.doesNotMatch(route, /sendEmail|resend|GoogleCalendar|calendar/i);
  assert.match(route, /restore_cancelled_rental_atomic/);
});
