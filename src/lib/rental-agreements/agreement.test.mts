import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createPreviewToken, verifyPreviewToken, agreementToken, hashToken } from "./security.ts";
import { signerNameMatches, validSignerName, SIGNATURE_ACKNOWLEDGMENT } from "./types.ts";
import { buildRentalAgreementSnapshot } from "./snapshot.ts";

const template = { version: 1, title: "Rental agreement", terms: "Follow the equipment instructions and safety rules.", updated_at: "2026-10-02", updated_by: "Owner" };
const input = { idempotencyKey: "test", rental_items: [{ rental_item: "bounce", rental_name: "Bounce house" }], customerName: "Jane Doe", email: "jane@example.invalid", phone: "8645550100", eventDateYmd: "2026-11-12", durationLabel: "One day", spanDays: 1, eventAddress: "Test address", event_start_time: "12:00", requested_delivery_window: "10 AM – 1 PM", delivery_fee: 30, mileage_fee: 0, setup_location: "Backyard", setup_surface: "Grass", setup_access: "Gate", setup_notes: "Electricity available", payment_method: "Cash", subtotal: 100, total: 130 };
const snapshot = buildRentalAgreementSnapshot(input, template);
process.env.ADMIN_SESSION_SECRET = "rental-agreement-tests-only-secret-1234567890";

test("preview binds every rental detail and the exact terms shown", () => {
  const now = 100000;
  const token = createPreviewToken(snapshot, now);
  assert.equal(verifyPreviewToken(token, snapshot, now + 1000), true);
  for (const change of [{ total: 1 }, { customerName: "Someone Else" }, { eventDate: "2026-11-13" }, { terms: "Different terms" }, { templateVersion: 2 }, { items: [] }, { setupSurface: "Concrete" }, { eventAddress: "Different address" }]) {
    assert.equal(verifyPreviewToken(token, { ...snapshot, ...change }, now + 1000), false);
  }
  assert.equal(verifyPreviewToken(token, snapshot, now + 31 * 60 * 1000), false);
  assert.equal(verifyPreviewToken(token.slice(0,-1) + (token.endsWith("0") ? "1" : "0"), snapshot, now), false);
  assert.equal(verifyPreviewToken(null, snapshot, now), false);
});
test("signing links are domain-separated and only hashed values are stored", () => {
  const token = agreementToken("one");
  assert.equal(token.length, 43); assert.equal(agreementToken("one"), token);
  assert.notEqual(agreementToken("two"), token); assert.equal(hashToken(token).length, 64);
});
test("name comparison permits case and whitespace differences but flags a different name", () => {
  assert.equal(signerNameMatches("Jane Doe", "  JANE   DOE  "), true);
  assert.equal(signerNameMatches("Jane Doe", "John Doe"), false);
  assert.equal(signerNameMatches("Jane Doe", null), false);
  for (const name of ["Jane Doe", "José O’Neill", "李明"]) assert.equal(validSignerName(name), true);
  for (const name of ["", " ", "a", "123", "Jane\nDoe", "x".repeat(121), null]) assert.equal(validSignerName(name), false);
});
test("snapshot preserves requested timing and charges without asserting payment or confirmed delivery", () => {
  assert.equal(snapshot.total, 130); assert.equal(snapshot.paidTotal, 0); assert.equal(snapshot.balanceDue, 130);
  assert.equal(snapshot.deliveryWindow, input.requested_delivery_window); assert.equal(snapshot.setupNotes, input.setup_notes);
  assert.match(snapshot.pricingLabel, /Estimated/); assert.match(snapshot.pickup, /confirmed/);
});
test("booking and signing boundaries require consent and disallow changed previews", () => {
  const booking = readFileSync(new URL("../../app/api/book/route.ts",import.meta.url),"utf8");
  const signing = readFileSync(new URL("../../app/api/rental-agreement/[token]/sign/route.ts",import.meta.url),"utf8");
  assert.match(booking,/agreement_acknowledged !== true/); assert.match(booking,/verifyPreviewToken/);
  assert.match(booking,/agreementRefreshRequired: true/); assert.match(signing,/acknowledged !== true/);
  assert.match(signing,/validSignerName/); assert.match(SIGNATURE_ACKNOWLEDGMENT,/electronic signature/);
});
test("dashboard mutations require authentication and template editing requires owner access", () => {
  const admin = readFileSync(new URL("../../app/api/admin/rentals/[id]/agreement/route.ts",import.meta.url),"utf8");
  const templateRoute = readFileSync(new URL("../../app/api/admin/rental-agreement-template/route.ts",import.meta.url),"utf8");
  assert.match(admin,/verifyAdminAccess/); assert.match(admin,/\.eq\("booking_id", id\)|loadAgreementById\(id,/);
  const delivery = readFileSync(new URL("./delivery.ts",import.meta.url),"utf8");
  assert.match(templateRoute,/verifyAdminOwnerAccess/); assert.match(admin,/emailRentalAgreement/);
  assert.match(delivery,/sendDurableBookingEmail/);
});
