import assert from "node:assert/strict";
import test from "node:test";
import { reconcileRentalLines } from "../invoices/rental-lines";
import { parseRentalPeriod, rentalDatePlusDays, rentalExtraTotal, rentalReservedDates } from "./rental-period";
import { unavailableYmdsFromBookings } from "../bookings/unavailableDates";
import { rentalRowsToEvents } from "../admin/schedule";
import { rentalCalendarDateTimes } from "./rental-pricing-text";
import { parseRentalEditInput } from "../admin/booking-edit";

test("historical multi-item invoice prices retain the agreed base subtotal", () => {
  for (const subtotal of [0, 100, 300, 475, 500.25]) {
    const lines = reconcileRentalLines([{id:"primary",description:"Slide",quantity:1,unitPrice:325}, {id:"extra",description:"Castle",quantity:1,unitPrice:150}],subtotal);
    assert.equal(lines.reduce((sum, line) => sum + line.unitPrice,0),subtotal);
    assert.ok(lines.every(line => line.unitPrice >= 0));
  }
});

test("every free/charged combination reserves the identical full period", () => {
  for (const span of [1,2,3]) for(let mask=0;mask < 2 ** (span-1);mask++) {
    const dayCharges = Array.from({length:span-1},(_,index) => ({ day:index+2,
      choice: mask & (1 << index) ? "charge" : "free", amount: mask & (1 << index) ? 80.25 : 0 }));
    const result = parseRentalPeriod({spanDays:span,dayCharges});
    assert.ok(result.ok);
    if (!result.ok) continue;
    assert.equal(rentalExtraTotal(result.dayCharges), dayCharges.reduce((sum,d)=>sum+d.amount,0));
    const dates = rentalReservedDates("2035-12-31",span);
    assert.equal(dates.length,span);
    assert.deepEqual(unavailableYmdsFromBookings([{event_date:"2035-12-31",span_days:span}],new Date(2035,11,31),new Date(2036,0,3)),dates);
  }
});

test("calendar days survive month/year/leap-day/DST boundaries", () => {
  assert.equal(rentalDatePlusDays("2026-12-31",2),"2027-01-02");
  assert.equal(rentalDatePlusDays("2028-02-28",2),"2028-03-01");
  assert.deepEqual(rentalReservedDates("2026-10-31",3),["2026-10-31","2026-11-01","2026-11-02"]);
  assert.deepEqual(rentalCalendarDateTimes("2026-10-31","09:00",3),{start:"2026-10-31T09:00:00",end:"2026-11-03T00:00:00"});
});

test("reject incomplete, hidden, duplicate, negative and fractional-cent charges", () => {
  for(const input of [
    {spanDays:4,dayCharges:[]}, {spanDays:2,dayCharges:[]},
    {spanDays:1,dayCharges:[{day:2,choice:"free",amount:0}]},
    {spanDays:2,dayCharges:[{day:2,choice:"charge",amount:0}]},
    {spanDays:2,dayCharges:[{day:2,choice:"charge",amount:1.001}]},
    {spanDays:2,dayCharges:[{day:2,choice:"free",amount:12}]},
    {spanDays:2,dayCharges:[{day:3,choice:"charge",amount:12}]},
    {spanDays:2,dayCharges:[{day:2,choice:"charge",amount:NaN}]},
  ]) assert.equal(parseRentalPeriod(input).ok,false);
});

test("old edit payloads preserve duration and new edits require stale-price protection", () => {
  const body={customerName:"Isolated test",eventDate:"2026-10-09",eventAddress:"Test",paymentMethod:"Cash"};
  const legacy=parseRentalEditInput(body); assert.ok(legacy.ok);
  if(legacy.ok) assert.equal(legacy.value.spanDays,undefined);
  assert.equal(parseRentalEditInput({...body,spanDays:2,dayCharges:[{day:2,choice:"free",amount:0}]}).ok,false);
  assert.equal(parseRentalEditInput({...body,spanDays:2,dayCharges:[{day:2,choice:"free",amount:0}],expectedPeriod:{}}).ok,true);
});

test("admin calendar projects each reserved day with unique IDs and original card link", () => {
  const row = {id:1,status:"approved",customer_name:"Test",customer_email:null,customer_phone:null,
    rental_item:"slide",rental_name:"Slide",event_address:null,event_date:"2035-12-31",span_days:3,
    event_start_time:null,requested_delivery_window:null,delivery_time:null,setup_location:null,setup_surface:null,
    setup_access:null,setup_notes:null,payment_method:null,total:335};
  const events=rentalRowsToEvents([row]);
  assert.deepEqual(events.map(e=>e.date),["2035-12-31","2036-01-01","2036-01-02"]);
  assert.equal(new Set(events.map(e=>e.id)).size,3);
  assert.ok(events.every(e=>e.detailHref.includes("from=2035-12-31")));
  assert.equal(rentalRowsToEvents([{...row,span_days:1}]).length,1);
});
