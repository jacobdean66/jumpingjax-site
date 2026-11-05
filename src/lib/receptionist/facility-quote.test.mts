import test from "node:test";
import assert from "node:assert/strict";
import { FacilityQuoteInputError, matchesConfirmedFacilityQuote, quoteFacilityParty } from "./facility-quote";
import { verifiedFacilityPricing } from "./facility-pricing";
const now=new Date("2026-11-01T15:00:00Z");
const settings={pricing:{publicRoom10:140,publicRoom20Weekday:215,publicRoom20Weekend:240,privateWeekday90:270,privateWeekday120:305,privateWeekend90:270,privateWeekend120:305,privateAny180:450,taxRate:0.07}};
const input={schemaVersion:1,kind:"public",room:"room-10",date:"2026-11-14",startMinutes:600,durationMinutes:90,addons:{customBirthdayBalloons:true,goodieBagsQuantity:2,cottonCandyPackage:"none"}};
test("calculates site-owned base, add-ons and tax without claiming availability",()=>{
  const quote=quoteFacilityParty(input,settings,now);assert.equal(quote.packagePrice,140);assert.equal(quote.addonSubtotal,17);assert.equal(quote.subtotal,157);assert.equal(quote.tax,10.99);assert.equal(quote.total,167.99);
  assert.equal(quote.availability,"not-checked");assert.equal(quote.finalReviewRequired,true);
  const room20={...input,room:"room-20",addons:{customBirthdayBalloons:false,goodieBagsQuantity:0,cottonCandyPackage:"none"}};
  assert.equal(quoteFacilityParty(room20,settings,now).total,256.8);
  assert.equal(quoteFacilityParty({...room20,date:"2026-11-18",startMinutes:720},settings,now).total,230.05);
});

test("confirmed facility quote detects changed prices, fields, add-ons and extra data",()=>{
  const quote=quoteFacilityParty(input,settings,now);assert.equal(matchesConfirmedFacilityQuote(quote,input,settings,now),true);
  assert.equal(matchesConfirmedFacilityQuote(quote,input,{pricing:{...settings.pricing,publicRoom10:141}},now),false);
  const revisionedQuote = quoteFacilityParty(input, { ...settings, revision: 4 }, now);
  assert.equal(revisionedQuote.pricingRevision, 4);
  assert.equal(matchesConfirmedFacilityQuote(revisionedQuote, input, { ...settings, revision: 5 }, now), false);
  assert.equal(matchesConfirmedFacilityQuote(quote,{...input,addons:{...input.addons,goodieBagsQuantity:3}},settings,now),false);
  assert.equal(matchesConfirmedFacilityQuote({...quote,total:1},input,settings,now),false);
  assert.equal(matchesConfirmedFacilityQuote({...quote,extra:true},input,settings,now),false);
  assert.equal(matchesConfirmedFacilityQuote(quote,{...input,startMinutes:615},settings,now),false);
});
test("rejects caller prices, invalid choices, invalid slots and missing site configuration",()=>{
  for(const value of [{...input,price:1},{...input,date:"2026-02-30"},{...input,startMinutes:615},{...input,room:"room-30"},
    {...input,kind:"private",room:"room-10"},{...input,durationMinutes:120},{...input,addons:{...input.addons,goodieBagsQuantity:101}},
    {...input,addons:{...input.addons,cottonCandyPackage:"surprise"}}])assert.throws(()=>quoteFacilityParty(value,settings,now),FacilityQuoteInputError);
  assert.throws(()=>verifiedFacilityPricing({facilityPricing:{}}),/unavailable/);
  assert.throws(()=>quoteFacilityParty(input,settings,new Date("2026-11-14T17:00:00Z")),FacilityQuoteInputError);
});
