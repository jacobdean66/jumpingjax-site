import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = fileURLToPath(new URL(".", import.meta.url));

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, `file://${here}`), "utf8");
}

test("facility admin query filters by canonical start_time", () => {
  const source = read("./operations.ts");

  assert.match(source, /\.gte\("start_time", bounds\.start\)/);
  assert.match(source, /\.lt\("start_time", bounds\.endExclusive\)/);
  assert.doesNotMatch(source, /\.gte\("readable_date"/);
  assert.doesNotMatch(source, /\.lte\("readable_date"/);
});

test("rental pending insert checks child rental items for conflicts", () => {
  const source = read("../supabase/booking-data.ts");

  assert.match(source, /\.from\("booking_rental_items"\)/);
  assert.match(source, /\.select\("booking_id"\)/);
  assert.match(source, /child item conflict check failed/);
});

test("admin action buttons can call confirmation routes with POST", () => {
  assert.match(read("../../app/api/rentals/confirm/route.ts"), /export async function POST/);
  assert.match(read("../../app/api/facility/confirm/route.ts"), /export async function POST/);
});
