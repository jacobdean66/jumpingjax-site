import assert from "node:assert/strict";
import test from "node:test";

import {
  dobMatchesAge,
  parseSelfCheckInInput,
  parseSelfCheckInSelection,
  SelfCheckInValidationError,
} from "./self-check-in";

test("public self check-in requires an explicit cash or card choice", () => {
  assert.throws(
    () => parseSelfCheckInSelection({ source: "native", participantId: "child-1" }),
    SelfCheckInValidationError,
  );
  assert.deepEqual(
    parseSelfCheckInSelection({
      source: "native",
      participantId: "child-1",
      paymentMethod: "card",
    }),
    { source: "native", participantId: "child-1", paymentMethod: "card" },
  );
});

test("public lookup validates name and exact current age", () => {
  assert.deepEqual(
    parseSelfCheckInInput({ firstName: " Ava ", lastName: " Smith ", age: 6 }),
    { firstName: "Ava", lastName: "Smith", ageYears: 6 },
  );
  assert.equal(dobMatchesAge("2020-08-18", "2026-08-18", 6), true);
  assert.equal(dobMatchesAge("2020-08-19", "2026-08-18", 6), false);
});

test("public lookup allows age to be omitted", () => {
  assert.deepEqual(
    parseSelfCheckInInput({ firstName: "ava", lastName: "SMITH", age: null }),
    { firstName: "ava", lastName: "SMITH", ageYears: null },
  );
  assert.equal(dobMatchesAge("2020-08-19", "2026-08-18", null), true);
});
