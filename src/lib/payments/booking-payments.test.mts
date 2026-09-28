import assert from "node:assert/strict";
import test from "node:test";

import {
  FACILITY_DEPOSIT_CENTS,
  dollarsToCents,
  mergeFacilityAgreementPayments,
  mergeFacilityPaymentEntries,
  normalizeBookingPaymentMethod,
  processingFeeCents,
  remainingBookingBalanceCents,
  sumBookingPaymentCents,
  type BookingPaymentEntry,
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

test("facility payment reconciliation includes legacy agreement deposits", () => {
  const merged = mergeFacilityPaymentEntries({
    bookingEntries: [],
    legacyPayments: [{
      id: "legacy-1",
      amount: 50,
      paymentKind: "deposit",
      paymentMethod: "Card by phone (facility POS)",
      paidAt: "2026-09-12T14:00:00.000Z",
      posReceiptNumber: null,
      recordedBy: "Office",
      notes: null,
    }],
  });

  assert.equal(sumBookingPaymentCents(merged), FACILITY_DEPOSIT_CENTS);
  assert.equal(merged[0]?.entryType, "facility_deposit");
  assert.equal(merged[0]?.paymentMethod, "card");
});

test("facility payment reconciliation does not double-count duplicate deposits", () => {
  const bookingEntry: BookingPaymentEntry = {
    id: "booking-1",
    bookingKind: "facility",
    bookingId: "party-1",
    entryType: "facility_deposit",
    paymentMethod: "card",
    amountCents: FACILITY_DEPOSIT_CENTS,
    processingFeeCents: 150,
    processorReference: "receipt-123",
    recordedBy: "Office",
    receiptEmail: null,
    receiptEmailSentAt: null,
    createdAt: "2026-09-20T18:00:00.000Z",
  };
  const legacyPayment = {
    id: "legacy-1",
    amount: 50,
    paymentKind: "deposit",
    paymentMethod: "Card by phone (facility POS)",
    paidAt: "2026-09-12T14:00:00.000Z",
    posReceiptNumber: "receipt-123",
    recordedBy: "Office",
    notes: null,
  };

  assert.equal(
    sumBookingPaymentCents(mergeFacilityPaymentEntries({
      bookingEntries: [bookingEntry],
      legacyPayments: [legacyPayment],
    })),
    FACILITY_DEPOSIT_CENTS,
  );
  assert.equal(
    mergeFacilityAgreementPayments({
      bookingEntries: [bookingEntry],
      legacyPayments: [legacyPayment],
    }).length,
    1,
  );
  const total = (entries: BookingPaymentEntry[], legacyPayments: typeof legacyPayment[]) => {
    const input = { bookingEntries: entries, legacyPayments };
    const cardTotal = sumBookingPaymentCents(mergeFacilityPaymentEntries(input));
    const agreementTotal = Math.round(mergeFacilityAgreementPayments(input).reduce((sum, payment) => sum + payment.amount, 0) * 100);
    assert.equal(cardTotal, agreementTotal, "all views must reconcile identically");
    return cardTotal;
  };
  assert.equal(total([bookingEntry], [{ ...legacyPayment, posReceiptNumber: "different-receipt" }]), 10000);
  assert.equal(total([{ ...bookingEntry, processorReference: null }], [{ ...legacyPayment, posReceiptNumber: null }]), 10000);
  assert.equal(total([], [legacyPayment, { ...legacyPayment, id: "legacy-2" }]), 10000);
  assert.equal(total([bookingEntry, { ...bookingEntry, id: "booking-2" }], [legacyPayment]), 10000);
  assert.equal(total([bookingEntry], [legacyPayment, { ...legacyPayment, id: "legacy-2" }]), 10000);
  assert.equal(total([{ ...bookingEntry, processorReference: null }], [{ ...legacyPayment, posReceiptNumber: null, paidAt: bookingEntry.createdAt }]), 5000);
});

test("facility payment method normalization recognizes POS card text", () => {
  assert.equal(normalizeBookingPaymentMethod("Card by phone (facility POS)"), "card");
  assert.equal(normalizeBookingPaymentMethod("cash"), "cash");
  assert.equal(normalizeBookingPaymentMethod("paper check"), "check");
});
