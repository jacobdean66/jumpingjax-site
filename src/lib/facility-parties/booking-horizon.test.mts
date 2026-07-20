import assert from "node:assert/strict";

import {
  FACILITY_BOOKING_HORIZON_END_YMD,
  canNavigateFacilityBookingMonth,
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
