import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const bookingRoute = readFileSync(
  new URL("../../app/api/book/route.ts", import.meta.url),
  "utf8",
);
const availabilityRoute = readFileSync(
  new URL("../../app/api/unavailable-dates/route.ts", import.meta.url),
  "utf8",
);

test("rental API resolves every item from the server catalog and rejects duplicates", () => {
  assert.match(bookingRoute, /getWebsiteRentalBySlug\(slug\.trim\(\)\)/);
  assert.match(bookingRoute, /new Set\(normalizedRentalItems\.map/);
  assert.match(bookingRoute, /normalizedRentalItems\.length !== requestedRentalItems\.length/);
});

test("client monetary projections are never authoritative", () => {
  for (const clientField of ["subtotal", "total", "delivery_fee", "mileage_fee"]) {
    assert.doesNotMatch(bookingRoute, new RegExp(`body\\.${clientField}`));
  }
  assert.match(bookingRoute, /estimateCartRentalSubtotal/);
  assert.match(bookingRoute, /estimateCartGrandTotal/);
  assert.match(bookingRoute, /estimateRentalDeliveryFee/);
});

test("server resolves foam duration independently for mixed rental carts", () => {
  assert.match(bookingRoute, /body\.foam_duration/);
  assert.match(bookingRoute, /resolveNewFoamDurationLabel/);
  assert.match(bookingRoute, /foamDurationLabel/);
});

test("availability includes secondary cart items and fails closed", () => {
  assert.match(availabilityRoute, /from\("booking_rental_items"\)/);
  assert.match(availabilityRoute, /status: 503/);
  assert.doesNotMatch(availabilityRoute, /test: "NEW_DEPLOY"/);
});
