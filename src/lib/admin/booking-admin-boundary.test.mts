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

test("rental pending insert delegates parent and child writes to one atomic RPC", () => {
  const source = read("../supabase/booking-data.ts");

  assert.match(source, /\.rpc\("create_rental_booking_atomic"/);
  assert.doesNotMatch(source, /\.from\("bookings"\)\s*\.insert/);
});

test("admin action buttons can call confirmation routes with POST", () => {
  assert.match(read("../../app/api/rentals/confirm/route.ts"), /export async function POST/);
  assert.match(read("../../app/api/facility/confirm/route.ts"), /export async function POST/);
});

test("website settings submenu exposes owner inventory tools; rentals submenu keeps ops tools", () => {
  const navigation = `${read("../../app/admin/_components.tsx")}\n${read("../../app/admin/page.tsx")}`;
  assert.match(navigation, /label: "Rentals"/);
  assert.match(navigation, /\/admin\/inventory/);
  assert.match(navigation, /\/admin\/reports\/tax-export/);
  assert.match(navigation, /Website Settings submenu/);
  assert.match(navigation, /Rentals submenu/);
  assert.match(navigation, /\/admin\/damage-log/);
  assert.match(navigation, /\/admin\/end-of-day/);
  for (const route of [
    "/admin/tasks",
    "/admin/staff",
    "/admin/employee-schedule",
  ]) {
    assert.doesNotMatch(navigation, new RegExp(route.replaceAll("/", "\\/")));
  }
});

test("facility name mapping uses one parent contact and one birthday child", () => {
  const form = read("../../components/facility-parties/FacilityPartyBookingForm.tsx");
  const route = read("../../app/api/facility/book/route.ts");
  assert.equal((form.match(/Parent\/Guardian Full Name/g) ?? []).length, 1);
  assert.equal((form.match(/Birthday Child(?:â€™|'|&apos;)s Full Name/g) ?? []).length, 1);
  assert.match(route, /customer_name: bookingContactName/);
  assert.match(route, /parent_name: bookingContactName/);
  assert.match(route, /child_name: String\(child_name\)\.trim\(\)/);
});
