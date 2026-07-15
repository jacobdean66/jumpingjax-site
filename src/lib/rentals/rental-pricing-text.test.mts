import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { RENTALS } from "../../data/rentals";
import {
  MOCK_DURATION_OPTIONS,
  ONE_DAY_RENTAL_DURATION,
  rangeHasBlocked,
} from "../mockBooking";
import {
  RENTAL_DELIVERY_BASE_FEE,
  durationMultiplierForBooking,
  estimateCartGrandTotal,
  estimateCartRentalSubtotal,
  estimateRentalLineSubtotal,
  resolveNewRentalDuration,
} from "./rental-pricing-text";
import {
  DEFAULT_FACILITY_PRICING,
  priceFacilityParty,
} from "../facility-parties/pricing";
import { PRIVATE_DURATION_OPTIONS } from "../facility-parties/constants";

const standardRentals = RENTALS.filter((rental) => rental.slug !== "foam-party");
const first = standardRentals[0]!;
const second = standardRentals[1]!;
const cart = [
  { rental_item: first.slug, rental_name: first.title },
  { rental_item: second.slug, rental_name: second.title },
];

test("standard rental customers can select only One Day", () => {
  assert.deepEqual(MOCK_DURATION_OPTIONS, [ONE_DAY_RENTAL_DURATION]);
  assert.equal(ONE_DAY_RENTAL_DURATION.label, "One Day");
  assert.equal(ONE_DAY_RENTAL_DURATION.spanDays, 1);
  assert.equal(ONE_DAY_RENTAL_DURATION.priceMultiplier, 1);
  assert.equal(
    MOCK_DURATION_OPTIONS.some((option) => /half/i.test(option.label)),
    false,
  );
});

test("new standard bookings canonicalize duration even when legacy input is supplied", () => {
  assert.deepEqual(resolveNewRentalDuration(cart, "Half Day"), {
    label: "One Day",
    spanDays: 1,
  });
});

test("one rental uses its catalog price with no duration multiplier", () => {
  assert.equal(
    estimateRentalLineSubtotal(cart[0]!, "One Day", 1),
    first.startingPrice,
  );
  assert.equal(durationMultiplierForBooking("One Day", 1), 1);
});

test("a realistic multi-item cart sums one-day prices and preserves delivery fees", () => {
  const expectedSubtotal = first.startingPrice + second.startingPrice;
  assert.equal(estimateCartRentalSubtotal(cart, "One Day", 1), expectedSubtotal);
  assert.equal(
    estimateCartGrandTotal(cart, "One Day", 1),
    expectedSubtotal + RENTAL_DELIVERY_BASE_FEE,
  );
});

test("one-day bookings block exactly the selected event date", () => {
  const blocked = new Set(["2026-08-15"]);
  assert.equal(rangeHasBlocked("2026-08-15", 1, blocked), true);
  assert.equal(rangeHasBlocked("2026-08-14", 1, blocked), false);
});

test("legacy half-day records remain readable without changing new options", () => {
  assert.equal(durationMultiplierForBooking("Half Day", 1), 0.72);
  assert.equal(MOCK_DURATION_OPTIONS.length, 1);

  const confirmationRoute = readFileSync(
    new URL("../../app/api/rentals/confirm/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(confirmationRoute, /booking\.duration/);
  assert.doesNotMatch(confirmationRoute, /duration\s*!==\s*["']One Day/);
});

test("facility-party duration and pricing defaults remain unchanged", () => {
  assert.deepEqual(
    PRIVATE_DURATION_OPTIONS.map((option) => option.minutes),
    [90, 120, 180],
  );
  assert.equal(DEFAULT_FACILITY_PRICING.privateAny180, 380);
  assert.deepEqual(
    priceFacilityParty({
      partyKind: "private",
      roomId: "room-20",
      date: "2026-07-19",
      durationMinutes: 180,
      addonSubtotal: 20,
    }),
    {
      packagePrice: 380,
      addonSubtotal: 20,
      subtotal: 400,
      tax: 28,
      total: 428,
      taxRate: 0.07,
      missingPrice: null,
    },
  );
});
