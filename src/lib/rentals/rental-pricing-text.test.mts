import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { RENTALS } from "../../data/rentals";
import {
  FOAM_DURATION_OPTIONS,
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
  foamDurationLabelForBooking,
  resolveNewFoamDurationLabel,
  resolveNewRentalDuration,
} from "./rental-pricing-text";
import {
  DEFAULT_FACILITY_PRICING,
  priceFacilityParty,
} from "../facility-parties/pricing";
import { PRIVATE_DURATION_OPTIONS } from "../facility-parties/constants";

const standardRentals = RENTALS.filter((rental) => rental.slug !== "foam-party");
const foamRental = RENTALS.find((rental) => rental.slug === "foam-party")!;
const first = standardRentals[0]!;
const second = standardRentals[1]!;
const cart = [
  { rental_item: first.slug, rental_name: first.title },
  { rental_item: second.slug, rental_name: second.title },
];
const mixedFoamCart = [
  { rental_item: first.slug, rental_name: first.title },
  { rental_item: foamRental.slug, rental_name: foamRental.title },
];
const foamOnlyCart = [
  { rental_item: foamRental.slug, rental_name: foamRental.title },
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

test("a missing catalog price cannot silently become a zero-dollar line", () => {
  const inventoryOnlyItem = {
    rental_item: "inventory-only-water-slide",
    rental_name: "Inventory-only Water Slide",
  };

  assert.equal(
    estimateRentalLineSubtotal(inventoryOnlyItem, "One Day", 1),
    null,
  );
  assert.equal(
    estimateCartRentalSubtotal([inventoryOnlyItem], "One Day", 1),
    null,
  );
  assert.equal(
    estimateCartGrandTotal([inventoryOnlyItem], "One Day", 1),
    null,
  );

  const pricedInventoryItem = { ...inventoryOnlyItem, starting_price: 291 };
  assert.equal(
    estimateCartRentalSubtotal([pricedInventoryItem], "One Day", 1),
    291,
  );
  assert.equal(
    estimateCartGrandTotal([pricedInventoryItem], "One Day", 1),
    291 + RENTAL_DELIVERY_BASE_FEE,
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

test("mixed foam + inflatable carts keep One Day rental duration and accept foam time", () => {
  assert.deepEqual(resolveNewRentalDuration(mixedFoamCart, "1 hour"), {
    label: "One Day",
    spanDays: 1,
  });
  assert.equal(
    resolveNewFoamDurationLabel(mixedFoamCart, "1 hour", "One Day"),
    "1 hour",
  );
  assert.equal(
    resolveNewFoamDurationLabel(mixedFoamCart, "", "One Day"),
    FOAM_DURATION_OPTIONS[0]!.label,
  );
});

test("mixed foam carts price foam from foam duration and inflatables from One Day", () => {
  const oneHour = FOAM_DURATION_OPTIONS.find((option) => option.label === "1 hour")!;
  const expectedFoam = Math.round(
    foamRental.startingPrice * oneHour.priceMultiplier,
  );
  assert.equal(
    estimateRentalLineSubtotal(mixedFoamCart[1]!, "One Day", 1, "1 hour"),
    expectedFoam,
  );
  assert.equal(
    estimateRentalLineSubtotal(mixedFoamCart[0]!, "One Day", 1, "1 hour"),
    first.startingPrice,
  );
  assert.equal(
    estimateCartRentalSubtotal(mixedFoamCart, "One Day", 1, "1 hour"),
    first.startingPrice + expectedFoam,
  );
  assert.equal(
    estimateCartGrandTotal(
      mixedFoamCart,
      "One Day",
      1,
      RENTAL_DELIVERY_BASE_FEE,
      "1 hour",
    ),
    first.startingPrice + expectedFoam + RENTAL_DELIVERY_BASE_FEE,
  );
});

test("foam-only carts still use booking duration as foam time", () => {
  assert.deepEqual(resolveNewRentalDuration(foamOnlyCart, "2 hours"), {
    label: "2 hours",
    spanDays: 1,
  });
  assert.equal(
    resolveNewFoamDurationLabel(foamOnlyCart, "", "2 hours"),
    "2 hours",
  );
  assert.equal(
    foamDurationLabelForBooking(foamOnlyCart, "2 hours", null),
    "2 hours",
  );
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
