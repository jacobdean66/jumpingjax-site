import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  FACILITY_BOOKING_HORIZON_END_YMD,
  canNavigateFacilityBookingMonth,
  facilityTodayYmd,
  isCanonicalFacilityBookingYmd,
  isFacilityBookingYmdWithinHorizon,
  isDateWithinFacilityBookingHorizon,
} from "./booking-horizon";
import {
  listPrivateSlotDispositions,
  listPublicSaturdaySlotDispositions,
} from "./availability";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

const july19 = new Date(2026, 6, 19, 12);
const july19InNewYork = new Date("2026-07-20T03:30:00.000Z");

await test("facility requests are open through December 31, 2027", () => {
  assert.equal(FACILITY_BOOKING_HORIZON_END_YMD, "2027-12-31");
  assert.equal(
    isDateWithinFacilityBookingHorizon(new Date(2027, 11, 31, 23, 59), july19),
    true,
  );
});

await test("past dates are outside the facility booking horizon", () => {
  assert.equal(
    isDateWithinFacilityBookingHorizon(new Date(2026, 6, 18, 23, 59), july19),
    false,
  );
});

await test("January 1, 2028 is outside the facility booking horizon", () => {
  assert.equal(
    isDateWithinFacilityBookingHorizon(new Date(2028, 0, 1), july19),
    false,
  );
});

await test("month navigation can advance beyond the current month", () => {
  assert.equal(
    canNavigateFacilityBookingMonth(
      new Date(2026, 6, 1),
      "next",
      july19,
    ),
    true,
  );
  assert.equal(
    canNavigateFacilityBookingMonth(
      new Date(2026, 6, 1),
      "previous",
      july19,
    ),
    false,
  );
});

await test("month navigation stops after December 2027", () => {
  assert.equal(
    canNavigateFacilityBookingMonth(
      new Date(2027, 11, 1),
      "next",
      july19,
    ),
    false,
  );
  assert.equal(
    canNavigateFacilityBookingMonth(
      new Date(2027, 11, 1),
      "previous",
      july19,
    ),
    true,
  );
});

await test("August 2026 dates continue through facility availability logic", () => {
  const publicSlots = listPublicSaturdaySlotDispositions(
    "2026-08-01",
    "room-10",
    [],
  );
  const privateSlots = listPrivateSlotDispositions("2026-08-02", 90, []);

  assert.equal(publicSlots.some((slot) => slot.available), true);
  assert.equal(privateSlots.some((slot) => slot.available), true);
});

await test("server horizon uses the current New York calendar date", () => {
  assert.equal(facilityTodayYmd(july19InNewYork), "2026-07-19");
  assert.equal(
    isFacilityBookingYmdWithinHorizon("2026-07-19", july19InNewYork),
    true,
  );
  assert.equal(
    isFacilityBookingYmdWithinHorizon("2026-08-01", july19InNewYork),
    true,
  );
  assert.equal(
    isFacilityBookingYmdWithinHorizon("2027-12-31", july19InNewYork),
    true,
  );
});

await test("server horizon rejects yesterday and dates after 2027", () => {
  assert.equal(
    isFacilityBookingYmdWithinHorizon("2026-07-18", july19InNewYork),
    false,
  );
  assert.equal(
    isFacilityBookingYmdWithinHorizon("2028-01-01", july19InNewYork),
    false,
  );
});

await test("server horizon rejects impossible and noncanonical dates", () => {
  for (const invalidDate of [
    "2026-02-31",
    "2026-13-01",
    "2026-8-1",
    "not-a-date",
    "",
  ]) {
    assert.equal(isCanonicalFacilityBookingYmd(invalidDate), false);
    assert.equal(
      isFacilityBookingYmdWithinHorizon(invalidDate, july19InNewYork),
      false,
    );
  }
});

await test("facility booking API enforces the shared horizon before side effects", () => {
  const route = readFileSync(
    new URL("../../app/api/facility/book/route.ts", import.meta.url),
    "utf8",
  );
  const validationIndex = route.indexOf(
    "isFacilityBookingYmdWithinHorizon(booking_date, new Date())",
  );

  assert.ok(validationIndex > 0);
  for (const laterOperation of [
    "resolveFacilityAddons(addon_selections)",
    "createServiceRoleClient()",
    "priceFacilityPartyWithConfig(",
    "listPublicSaturdaySlotDispositions(",
    'supabase.rpc("create_facility_booking_atomic"',
    "initializeBookingWorkflow(",
    "sendDurableBookingEmail(",
  ]) {
    assert.ok(
      route.indexOf(laterOperation) > validationIndex,
      `${laterOperation} must occur after horizon validation`,
    );
  }
});
