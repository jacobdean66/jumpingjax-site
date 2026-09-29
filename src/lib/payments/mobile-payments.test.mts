import assert from "node:assert/strict";
import test from "node:test";
import { parseMobilePayment } from "./mobile-payments";

const now = Date.parse("2026-09-28T23:00:00Z");
const receipt = { requestId: "b78121d0-c340-4f0e-82bb-5deca20f2744", reference: "12345-6789", payerName: "Actual payer", amount: "50.00", fee: "1.50", paidAt: "2026-09-28T16:10:00-04:00", purpose: "payment", approved: true };

test("mobile receipts preserve the actual fee and convert local offset to UTC", () => {
  const payment = parseMobilePayment(receipt, now);
  assert.equal(payment.amountCents, 5000);
  assert.equal(payment.feeCents, 150);
  assert.equal(payment.paidAt, "2026-09-28T20:10:00.000Z");
  assert.equal(payment.bookingKind, null);
  assert.equal(parseMobilePayment({ ...receipt, fee: "0" }, now).feeCents, 0);
});

test("unapproved or future payments cannot be recorded", () => {
  assert.throws(() => parseMobilePayment({ ...receipt, approved: false }, now), /approved/);
  assert.throws(() => parseMobilePayment({ ...receipt, paidAt: "2026-09-29T23:00:00Z" }, now), /actual payment date/);
  assert.throws(() => parseMobilePayment({ ...receipt, paidAt: "2026-09-28T16:10" }, now), /actual payment date/);
});

test("money inputs reject negative, fractional-cent, nonfinite, and unreasonable fees", () => {
  for (const amount of ["-50", "50.001", "Infinity", "0", "100000.01"]) assert.throws(() => parseMobilePayment({ ...receipt, amount }, now));
  for (const fee of ["-1", "0.001", "51"]) assert.throws(() => parseMobilePayment({ ...receipt, fee }, now));
});

test("a booking requires both a supported kind and an exact ID", () => {
  assert.throws(() => parseMobilePayment({ ...receipt, bookingKind: "facility" }, now), /booking/);
  assert.throws(() => parseMobilePayment({ ...receipt, bookingId: "123" }, now), /booking/);
  assert.throws(() => parseMobilePayment({ ...receipt, bookingKind: "customer", bookingId: "123" }, now), /booking/);
  assert.equal(parseMobilePayment({ ...receipt, bookingKind: "rental", bookingId: "123" }, now).bookingId, "123");
});
