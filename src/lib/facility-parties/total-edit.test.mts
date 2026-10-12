import assert from "node:assert/strict";
import test from "node:test";
import { parsePartyTotal, overridePartyTotal } from "./total-edit";
import { priceFacilityParty, formatFacilityPricingLines } from "./pricing";
import { calculateAgreementPricing } from "./agreement";
import { parseFacilityEditInput } from "../admin/booking-edit";
import { applyFacilityInvoiceTotal } from "../invoices/facility-total";
import { createTestInvoice, calculateInvoiceTotals } from "../invoices/shared";

test("staff totals accept zero and exact cents, and reject invalid monetary input", () => {
  for (const [value, expected] of [[0,0],["0.00",0],["203.30",203.3],[" 123.45 ",123.45],[1000000,1000000]] as const) assert.equal(parsePartyTotal(value), expected);
  for (const value of ["",null,undefined,true,-1,"-0.01",NaN,Infinity,"12.345","1e3","1,000",1000000.01,{},[]]) assert.equal(parsePartyTotal(value),null,String(value));
});

test("free, discounted, and increased totals reconcile tax, agreement and invoice without losing payments", () => {
  const standard = priceFacilityParty({ partyKind:"public",roomId:"room-20",date:"2026-10-31",durationMinutes:90,addonSubtotal:15 });
  for (const total of [0,0.01,107,123.45,500]) {
    const pricing = overridePartyTotal(standard,total);
    assert.equal(Math.round((pricing.subtotal+pricing.tax)*100),Math.round(total*100));
    const agreement = calculateAgreementPricing({packagePrice:pricing.packagePrice,addonSubtotal:pricing.addonSubtotal,storedSubtotal:pricing.subtotal,storedTax:pricing.tax,additionalChildrenAge3Plus:0,additionalChildrenAge2Under:0});
    assert.equal(agreement.total,total);
    const original = createTestInvoice();
    const invoice = applyFacilityInvoiceTotal(original,total,pricing.tax);
    assert.equal(calculateInvoiceTotals(invoice).total,total);
    assert.equal(calculateInvoiceTotals(invoice).balanceDue,Math.max(0,Math.round((total-original.paymentsReceived)*100)/100));
    assert.equal(invoice.paymentsReceived,original.paymentsReceived);
    assert.equal(invoice.lineItems[0].description,original.lineItems[0].description);
    assert.deepEqual(applyFacilityInvoiceTotal(invoice,total,pricing.tax),invoice,"Repeated reads must not accumulate adjustments");
  }
  assert.match(formatFacilityPricingLines(overridePartyTotal(standard,0)).join("\n"),/Price adjustment: \$-205.00/);
});

test("details-only edits preserve costs and price edits require the current total and reason", () => {
  const details={customerName:"Test Parent",paymentMethod:"Giveaway"};
  const unchanged=parseFacilityEditInput(details);
  assert.equal(unchanged.ok,true);
  if(unchanged.ok) assert.equal(unchanged.value.total,undefined);
  const free=parseFacilityEditInput({...details,total:"0",expectedTotal:203.3,priceChangeReason:"Giveaway winner"});
  assert.equal(free.ok,true);
  if(free.ok) assert.equal(free.value.total,0);
  for(const extra of [{total:"0"},{total:"0",expectedTotal:203.3},{total:"-1",expectedTotal:203.3,priceChangeReason:"Correction"}]) assert.equal(parseFacilityEditInput({...details,...extra}).ok,false);
});
