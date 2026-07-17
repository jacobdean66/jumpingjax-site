import assert from "node:assert/strict";

import {
  BOOKING_HORIZON_END_YMD,
  bookingHorizonAvailabilityWindow,
  bookingHorizonMaxMonthCursor,
  bookingHorizonMonthsAhead,
  canNavigateBookingMonth,
  getBookingHorizonEndDate,
  isDateWithinBookingHorizon,
  isYmdWithinBookingHorizon,
} from "./booking-horizon";
import { unavailableYmdsFromBookings } from "./unavailableDates";
import { getLocalDayOfWeek } from "../facility-parties/time";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

const TODAY = new Date(2026, 6, 17, 12, 0, 0, 0); // July 17, 2026

await test("January 2027 is reachable via month navigation", () => {
  assert.equal(canNavigateBookingMonth(2027, 0, TODAY), true);
  assert.equal(bookingHorizonMaxMonthCursor().getFullYear(), 2027);
  assert.equal(bookingHorizonMaxMonthCursor().getMonth(), 11);
});

await test("December 31, 2027 is within the allowed booking horizon", () => {
  assert.equal(BOOKING_HORIZON_END_YMD, "2027-12-31");
  assert.equal(isYmdWithinBookingHorizon("2027-12-31"), true);
  assert.equal(
    isDateWithinBookingHorizon(getBookingHorizonEndDate()),
    true,
  );
  const { winEnd } = bookingHorizonAvailabilityWindow(TODAY);
  assert.equal(
    `${winEnd.getFullYear()}-${String(winEnd.getMonth() + 1).padStart(2, "0")}-${String(winEnd.getDate()).padStart(2, "0")}`,
    "2027-12-31",
  );
});

await test("January 1, 2028 remains outside the allowed booking horizon", () => {
  assert.equal(isYmdWithinBookingHorizon("2028-01-01"), false);
  assert.equal(canNavigateBookingMonth(2028, 0, TODAY), false);
  assert.equal(
    isDateWithinBookingHorizon(new Date(2028, 0, 1, 12, 0, 0, 0)),
    false,
  );
});

await test("horizon months_ahead covers December 2027 and stays within API max", () => {
  const months = bookingHorizonMonthsAhead(TODAY);
  assert.ok(months >= 18);
  assert.ok(months <= 36);
});

await test("unavailable-date expansion still applies inside the horizon window", () => {
  const { winStart, winEnd } = bookingHorizonAvailabilityWindow(TODAY);
  const ymds = unavailableYmdsFromBookings(
    [{ event_date: "2027-06-15", span_days: 2 }],
    winStart,
    winEnd,
  );
  assert.deepEqual(ymds, ["2027-06-15", "2027-06-16"]);

  const outside = unavailableYmdsFromBookings(
    [{ event_date: "2028-01-01", span_days: 1 }],
    winStart,
    winEnd,
  );
  assert.deepEqual(outside, []);
});

await test("facility weekday restrictions still apply on 2027 dates", () => {
  // Sunday 2027-01-03 — public parties are Wed–Sat only
  assert.equal(getLocalDayOfWeek("2027-01-03"), 0);
  // Friday 2027-12-31 — public weekday allowed and within horizon
  assert.equal(getLocalDayOfWeek("2027-12-31"), 5);
  assert.equal(isYmdWithinBookingHorizon("2027-12-31"), true);
  // Monday 2027-01-04 — public weekday blocked
  assert.equal(getLocalDayOfWeek("2027-01-04"), 1);
});
