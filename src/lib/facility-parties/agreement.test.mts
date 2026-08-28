import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AGREEMENT_POLICIES,
  buildFacilityAgreementSnapshot,
  calculateAgreementPricing,
  includedChildrenForRoom,
} from "./agreement";

test("agreement pricing charges additional children by age and applies configured tax", () => {
  const pricing = calculateAgreementPricing({
    packagePrice: 270,
    addonSubtotal: 10,
    storedSubtotal: 280,
    storedTax: 19.6,
    additionalChildrenAge3Plus: 2,
    additionalChildrenAge2Under: 3,
  });
  assert.deepEqual(pricing, {
    additionalChildrenAge3Plus: 2,
    additionalChildrenAge2Under: 3,
    additionalChildrenCharge: 41,
    packagePrice: 270,
    addonSubtotal: 10,
    subtotal: 321,
    taxRate: 0.07,
    tax: 22.47,
    total: 343.47,
  });
});

test("agreement snapshot preserves the customer, party, pricing, and accepted policies", () => {
  const snapshot = buildFacilityAgreementSnapshot({
    booking: {
      id: "3bf98fd5-8309-4f98-8232-2fbffb52f354",
      customerName: "Alexis Barrett",
      email: "alexis@example.com",
      phone: "864-555-0100",
      parentName: "Alexis Barrett",
      childName: "Hampton Barrett",
      partyLabel: "Private Party",
      readableDate: "October 11, 2026",
      readableTime: "2:30 PM - 4:30 PM",
      room: "room-20",
      partyKind: "private",
      facilityPackagePrice: 305,
      addonSubtotal: 10,
      subtotal: 315,
      tax: 22.05,
      addonText: "Custom Birthday Balloons — $10.00",
    },
    additionalChildrenAge3Plus: 1,
    additionalChildrenAge2Under: 1,
  });
  assert.equal(snapshot.parentName, "Alexis Barrett");
  assert.equal(snapshot.includedChildren, 20);
  assert.equal(snapshot.additionalChildrenCharge, 17);
  assert.equal(snapshot.total, 355.24);
  assert.deepEqual(snapshot.policies, AGREEMENT_POLICIES);
});

test("room capacity follows the booked 10- or 20-child package", () => {
  assert.equal(includedChildrenForRoom("room-10", "public"), 10);
  assert.equal(includedChildrenForRoom("room-20", "public"), 20);
  assert.equal(includedChildrenForRoom(null, "private"), 20);
});

test("agreement migration is service-role only and versions signatures", async () => {
  const sql = await readFile(
    new URL("../../../supabase/migrations/20260828190000_facility_party_agreements.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /enable row level security/gi);
  assert.match(sql, /revoke all on public\.facility_party_agreements from public, anon, authenticated/i);
  assert.match(sql, /create_facility_party_agreement_version/i);
  assert.match(sql, /sign_facility_party_agreement/i);
  assert.match(sql, /status = 'superseded'/i);
  assert.doesNotMatch(sql, /card_number|card_last_four|cvv/i);
});

test("facility cards expose a printable single-page physical agreement and receipt", async () => {
  const [panel, printPage] = await Promise.all([
    readFile(new URL("../../app/admin/facility/FacilityAgreementPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/admin/facility/[id]/agreement/print/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(panel, /Print agreement \/ receipt/);
  assert.match(printPage, /One-page party receipt and agreement/);
  assert.match(printPage, /What this party is paying for/);
  assert.doesNotMatch(printPage, /JUMPING JAX FACILITY COPY|break-before-page/);
});
