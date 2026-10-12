import { calculateInvoiceTotals, money, type BookingInvoice } from "./shared";

// Keep staff-written line descriptions and payments; reconcile charges to the booking total.
export function applyFacilityInvoiceTotal(invoice: BookingInvoice, total: number, tax: number): BookingInvoice {
  const lines = invoice.lineItems.filter(line => line.id !== "facility-price-adjustment");
  const base = calculateInvoiceTotals({ ...invoice, lineItems: lines, discount: 0, tax }).total;
  const adjustment = money(total - base);
  return { ...invoice, tax, discount: adjustment < 0 ? -adjustment : 0,
    lineItems: adjustment > 0 ? [...lines, { id: "facility-price-adjustment", description: "Party price adjustment", quantity: 1, unitPrice: adjustment }] : lines };
}
