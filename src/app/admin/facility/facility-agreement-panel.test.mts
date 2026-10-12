import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FacilityAgreementPanel } from "./FacilityAgreementPanel.tsx";
import { buildFacilityAgreementSnapshot, calculateAgreementPricing, type AgreementPayment } from "../../../lib/facility-parties/agreement.ts";

const base = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", customerName: "Test Parent", email: "test@example.invalid",
  phone: null, parentName: null, childName: "Test Child", partyLabel: "Public Play Party", readableDate: "2026-10-31",
  readableTime: "2:00 PM - 3:30 PM", room: "room-20", partyKind: "public", facilityPackagePrice: 240,
  addonSubtotal: 0, subtotal: 240, tax: 16.8, addonText: "No add-ons", total: 256.8,
};

function amountAfter(html: string, label: string) {
  const match = html.match(new RegExp(`>${label}</p><p[^>]*>([^<]+)</p>`));
  assert.ok(match, `${label} must be rendered`);
  return match[1];
}

test("the rendered agreement preview matches the saved free, discounted and standard agreement", () => {
  for (const [subtotal, tax, total] of [[0, 0, 0], [100, 7, 107], [240, 16.8, 256.8]]) {
    const booking = { ...base, subtotal, tax, total };
    const server = buildFacilityAgreementSnapshot({ booking, additionalChildrenAge3Plus: 0, additionalChildrenAge2Under: 0 });
    const html = renderToStaticMarkup(React.createElement(FacilityAgreementPanel, { booking: { ...booking, agreementHistory: [], paymentHistory: [] } }));
    assert.equal(amountAfter(html, "Agreement total"), `$${server.total.toFixed(2)}`);
    assert.equal(amountAfter(html, "Balance due"), `$${server.balanceDue.toFixed(2)}`);
    assert.equal(server.total, total);
    assert.match(html, /Customer email:/);
    assert.doesNotMatch(html, /Sent to test/);
  }
});

test("price adjustments preserve existing payment credit in the rendered preview", () => {
  const payment: AgreementPayment = { id: "test-payment", amount: 50, paymentKind: "deposit", paymentMethod: "Cash", paidAt: "2026-10-12T14:00:00Z", posReceiptNumber: null, recordedBy: "Test Staff", notes: null };
  const html = renderToStaticMarkup(React.createElement(FacilityAgreementPanel, { booking: { ...base, subtotal: 100, tax: 7, total: 107, agreementHistory: [], paymentHistory: [payment] } }));
  assert.equal(amountAfter(html, "Agreement total"), "$107.00");
  assert.equal(amountAfter(html, "Recorded payments"), "$50.00");
  assert.equal(amountAfter(html, "Balance due"), "$57.00");
});

test("shared pricing applies additional-child charges on top of the adjusted base", () => {
  const pricing = calculateAgreementPricing({ packagePrice: 240, addonSubtotal: 0, storedSubtotal: 100, storedTax: 7, additionalChildrenAge3Plus: 2, additionalChildrenAge2Under: 3 });
  assert.equal(pricing.priceAdjustment, -140);
  assert.equal(pricing.additionalChildrenCharge, 41);
  assert.equal(pricing.subtotal, 141);
  assert.equal(pricing.total, 150.87);
});
