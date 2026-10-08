import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { adminNavigation, isAdminNavActive } from "../admin/navigation";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("the admin has a dedicated invoice page and navigation option", () => {
  const navigation = adminNavigation("employee");
  const invoicePage = source("../../app/admin/invoices/page.tsx");
  assert.ok(!navigation.primary.some(item => item.href === "/admin/invoices"));
  const invoice = navigation.groups.flatMap(group => group.items).find(item => item.href === "/admin/invoices")!;
  assert.equal(invoice.label, "Invoices");
  assert.ok(isAdminNavActive(invoice, "/admin/invoices"));
  assert.match(invoicePage, /title="Invoices"/);
  assert.match(invoicePage, /Create new invoice/);
  assert.match(invoicePage, /Saved standalone invoices/);
});

test("every rental card, including foam bookings, exposes invoice creation", () => {
  const page = source("../../app/admin/rentals/page.tsx");
  const cardStart = page.indexOf("function RentalCard");
  const pageStart = page.indexOf("export default async function", cardStart);
  const card = page.slice(cardStart, pageStart);

  assert.ok(cardStart >= 0 && pageStart > cardStart, "RentalCard should exist");
  assert.match(card, /<BookingInvoiceButton kind="rental" bookingId=\{booking\.id\} \/>/);
  assert.match(card, /booking\.foamDuration/);
  assert.match(page, /bookings\.map\(\(booking\) => [({]/);
  assert.match(page, /<RentalCard\b[^>]*\bbooking=\{booking\}[^>]*\bagreements=/);
});

test("every facility booking card exposes invoice creation", () => {
  const page = source("../../app/admin/facility/page.tsx");
  const cardStart = page.indexOf("function FacilityCard");
  const pageStart = page.indexOf("export default async function", cardStart);
  const card = page.slice(cardStart, pageStart);

  assert.ok(cardStart >= 0 && pageStart > cardStart, "FacilityCard should exist");
  assert.match(card, /<BookingInvoiceButton kind="facility" bookingId=\{booking\.id\} \/>/);
  assert.match(page, /displayedBookings\.map\(\(booking\) => \(/);
  assert.match(page, /<FacilityExpandableCard key=\{booking\.id\} booking=\{booking\} \/>/);
  assert.match(page, /<FacilityCard booking=\{booking\} \/>/);
});

test("invoice APIs require admin access", () => {
  const invoiceRoute = source("../../app/api/admin/invoices/[kind]/[id]/route.ts");
  const emailRoute = source("../../app/api/admin/invoices/[kind]/[id]/email/route.ts");

  for (const route of [invoiceRoute, emailRoute]) {
    assert.match(route, /verifyAdminAccess/);
    assert.match(route, /Admin authentication required/);
  }
});
