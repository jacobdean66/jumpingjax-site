import assert from "node:assert/strict";
import test from "node:test";

import {
  FACILITY_DEPOSIT_CENTS,
  dollarsToCents,
  processingFeeCents,
  remainingBookingBalanceCents,
  sumBookingPaymentCents,
} from "./booking-payments";

test("payment amounts preserve cents and reject malformed values", () => {
  assert.equal(dollarsToCents("50"), 5000);
  assert.equal(dollarsToCents("12.34"), 1234);
  assert.equal(dollarsToCents("12.345"), null);
  assert.equal(dollarsToCents("-1"), null);
});

test("card processing fee applies only to card payments", () => {
  assert.equal(processingFeeCents(FACILITY_DEPOSIT_CENTS, "card"), 150);
  assert.equal(processingFeeCents(FACILITY_DEPOSIT_CENTS, "cash"), 0);
});

test("partial payments leave the correct booking balance", () => {
  const paid = sumBookingPaymentCents([{ amountCents: 2500 }, { amountCents: 3500 }]);
  assert.equal(paid, 6000);
  assert.equal(remainingBookingBalanceCents(100, paid), 4000);
  assert.equal(remainingBookingBalanceCents(50, paid), 0);
});
