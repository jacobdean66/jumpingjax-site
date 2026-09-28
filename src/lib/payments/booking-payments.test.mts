import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  FACILITY_DEPOSIT_CENTS,
  dollarsToCents,
  mergeFacilityAgreementPayments,
  mergeFacilityPaymentEntries,
  normalizeBookingPaymentMethod,
  normalizeBookingPaymentIdempotencyKey,
  paymentStatusLabel,
  projectBookingPaymentStatus,
  processingFeeCents,
  receiptAuditLabel,
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
    idempotencyKey: "booking-payment:party-1:receipt-123",
    recordedBy: "Office",
    receiptEmail: null,
    receiptRequestedAt: null,
    receiptEmailSentAt: null,
    receiptErrorClass: null,
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

test("booking payment projection centralizes status and balances", () => {
  assert.deepEqual(projectBookingPaymentStatus(100, []), {
    totalCents: 10000,
    paidCents: 0,
    balanceCents: 10000,
    status: "unpaid",
  });
  assert.deepEqual(projectBookingPaymentStatus(100, [{ amountCents: 5000 }]), {
    totalCents: 10000,
    paidCents: 5000,
    balanceCents: 5000,
    status: "partial",
  });
  assert.equal(
    projectBookingPaymentStatus(100, [{ amountCents: 10000 }]).status,
    "paid",
  );
  assert.equal(
    projectBookingPaymentStatus(100, [{ amountCents: 10500 }]).status,
    "overpaid",
  );
  assert.equal(paymentStatusLabel("partial"), "Partially paid");
});

test("payment idempotency keys are scoped and bounded", () => {
  assert.equal(
    normalizeBookingPaymentIdempotencyKey("booking-payment:123:abc_def-456"),
    "booking-payment:123:abc_def-456",
  );
  assert.equal(normalizeBookingPaymentIdempotencyKey("other:123"), null);
  assert.equal(normalizeBookingPaymentIdempotencyKey("booking-payment:short"), null);
  assert.equal(normalizeBookingPaymentIdempotencyKey("booking-payment:bad key"), null);
  assert.equal(
    normalizeBookingPaymentIdempotencyKey(
      "booking-payment:123:abc_def-456",
      "different-booking",
    ),
    null,
  );
});

test("receipt audit labels distinguish skipped, queued, sent, and failed receipts", () => {
  assert.equal(receiptAuditLabel({ receiptRequestedAt: null, receiptEmailSentAt: null, receiptErrorClass: null }), "receipt not requested");
  assert.equal(receiptAuditLabel({ receiptRequestedAt: "2026-09-26T10:00:00.000Z", receiptEmailSentAt: null, receiptErrorClass: null }), "receipt queued");
  assert.equal(receiptAuditLabel({ receiptRequestedAt: "2026-09-26T10:00:00.000Z", receiptEmailSentAt: "2026-09-26T10:01:00.000Z", receiptErrorClass: null }), "receipt emailed");
  assert.equal(receiptAuditLabel({ receiptRequestedAt: "2026-09-26T10:00:00.000Z", receiptEmailSentAt: null, receiptErrorClass: "email_not_configured" }), "receipt failed (email_not_configured)");
});

test("payment hardening migration is additive and keeps the ledger private", () => {
  const sql = readFileSync(
    new URL("../../../supabase/migrations/20260928130000_harden_booking_payment_entries.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /add column if not exists idempotency_key text/i);
  assert.match(sql, /booking_payment_entries_idempotency_uidx/i);
  assert.match(sql, /add column if not exists receipt_requested_at timestamptz/i);
  assert.match(sql, /add column if not exists receipt_error_class text/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on public\.booking_payment_entries from anon, authenticated/i);
  assert.doesNotMatch(sql, /card_number|card_last_four|cvv|password|secret/i);
});
