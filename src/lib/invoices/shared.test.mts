import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateInvoiceTotals,
  createTestInvoice,
  normalizeInvoice,
  type BookingInvoice,
} from "./shared.ts";

const baseInvoice: BookingInvoice = {
  kind: "rental",
  bookingId: "booking-1",
  invoiceNumber: "JJ-R-booking-1",
  invoiceDate: "2026-09-01",
  dueDate: "2026-09-10",
  customerName: "Customer",
  customerEmail: "customer@example.com",
  customerPhone: "864-555-0100",
  billingAddress: "10 Main Street",
  eventDate: "2026-09-10",
  eventAddress: "10 Main Street",
  eventDetails: "Birthday party",
  lineItems: [{ id: "slide", description: "Waterslide", quantity: 1, unitPrice: 400 }],
  deliveryFee: 25,
  discount: 50,
  tax: 10,
  paymentsReceived: 100,
  notes: "",
};

test("editable prices, discounts, and payments recalculate the balance", () => {
  assert.deepEqual(calculateInvoiceTotals(baseInvoice), {
    subtotal: 400,
    total: 385,
    balanceDue: 285,
  });

  const withAnotherRental = {
    ...baseInvoice,
    lineItems: [
      ...baseInvoice.lineItems,
      { id: "chairs", description: "Extra chairs", quantity: 10, unitPrice: 2.5 },
    ],
  };
  assert.deepEqual(calculateInvoiceTotals(withAnotherRental), {
    subtotal: 425,
    total: 410,
    balanceDue: 310,
  });
});

test("saved invoice input is normalized and unsafe numeric values are bounded", () => {
  const normalized = normalizeInvoice({
    customerName: "Updated Customer",
    lineItems: [{ id: "extra", description: "Foam add-on", quantity: 2, unitPrice: 75 }],
    discount: -500,
    deliveryFee: "30.255",
  }, baseInvoice);

  assert.equal(normalized.customerName, "Updated Customer");
  assert.equal(normalized.lineItems[0]?.description, "Foam add-on");
  assert.equal(normalized.discount, 0);
  assert.equal(normalized.deliveryFee, 30.26);
});

test("the visible test invoice has the expected printable and email balance", () => {
  assert.deepEqual(calculateInvoiceTotals(createTestInvoice()), {
    subtotal: 425,
    total: 425,
    balanceDue: 325,
  });
});
