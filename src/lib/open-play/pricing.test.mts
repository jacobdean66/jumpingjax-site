import assert from "node:assert/strict";
import test from "node:test";

import {
  assertClientPriceMatches,
  classifyAdultAdmission,
  classifyChildAdmission,
  PricingMismatchError,
} from "./pricing";

test("child age 2 is $7", () => {
  const result = classifyChildAdmission("2024-08-03", "2026-08-03");
  assert.equal(result.ageYears, 2);
  assert.equal(result.classification, "child_2_or_under");
  assert.equal(result.unitPriceCents, 700);
});

test("day before third birthday remains $7", () => {
  const result = classifyChildAdmission("2023-08-04", "2026-08-03");
  assert.equal(result.ageYears, 2);
  assert.equal(result.classification, "child_2_or_under");
  assert.equal(result.unitPriceCents, 700);
});

test("third birthday becomes $10", () => {
  const result = classifyChildAdmission("2023-08-03", "2026-08-03");
  assert.equal(result.ageYears, 3);
  assert.equal(result.classification, "child_3_plus");
  assert.equal(result.unitPriceCents, 1000);
});

test("child age 3 is $10", () => {
  const result = classifyChildAdmission("2022-01-01", "2026-08-03");
  assert.equal(result.ageYears, 4);
  assert.equal(result.classification, "child_3_plus");
  assert.equal(result.unitPriceCents, 1000);
});

test("playing adult is $7", () => {
  const result = classifyAdultAdmission("playing", "1990-05-01", "2026-08-03");
  assert.equal(result.classification, "playing_adult");
  assert.equal(result.unitPriceCents, 700);
});

test("watching adult is free", () => {
  const result = classifyAdultAdmission("watching", "1990-05-01", "2026-08-03");
  assert.equal(result.classification, "watching_adult");
  assert.equal(result.unitPriceCents, 0);
});

test("client price mismatch is rejected", () => {
  assert.throws(
    () => assertClientPriceMatches(700, 1000),
    (error: unknown) => error instanceof PricingMismatchError,
  );
});
