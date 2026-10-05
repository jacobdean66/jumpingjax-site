import assert from "node:assert/strict";
import test from "node:test";
import { calculateInflatableDiscount, isInflatablePromotionCategory } from "./ad-promotion";
import { estimateCartGrandTotal } from "./rental-pricing-text";

test("15% discount applies to eligible inflatable lines and leaves other fees and services intact", () => {
  const cart = [{ rental_item: "test-inflatable", starting_price: 325 }, { rental_item: "foam-party", starting_price: 300 }, { rental_item: "test-accessory", starting_price: 50 }];
  const discount = calculateInflatableDiscount("GOOGLE15", cart, ["test-inflatable"]);
  assert.equal(discount, 48.75);
  const gross = estimateCartGrandTotal(cart, "One Day", 1, 70, "1 hour");
  assert.ok(gross != null);
  assert.equal(gross! - discount, gross! - 48.75);
  assert.equal(calculateInflatableDiscount("GOOGLE15", cart, []), 0);
});

test("unknown codes cannot choose a percentage or a discount", () => {
  const cart = [{ rental_item: "test", starting_price: 333.33 }];
  for (const code of [undefined, "", "GOOGLE100", { percent: 100 }, 100]) assert.equal(calculateInflatableDiscount(code, cart, ["test"]), 0);
  // The existing rental estimator rounds this quote to $333 before discounting.
  assert.equal(calculateInflatableDiscount("GOOGLE15", cart, ["test"]), 49.95);
});

test("eligibility excludes non-inflatable services", () => {
  for (const category of ["bounce-houses", "combos", "water-slides", "slides", "inflatable-games", "obstacle-courses"]) assert.equal(isInflatablePromotionCategory(category), true);
  for (const category of ["foam-parties", "accessories", "yard-games", "facility-parties", "unknown"]) assert.equal(isInflatablePromotionCategory(category), false);
});
