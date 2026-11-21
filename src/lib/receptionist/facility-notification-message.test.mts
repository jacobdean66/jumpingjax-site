import test from "node:test";
import assert from "node:assert/strict";
import {buildFacilityNotification} from "./facility-notification-message";
import {submitFacilityBooking} from "./facility-book";
import {quoteFacilityParty} from "./facility-quote";
import { FACILITY_BALANCE_DUE, FACILITY_DEPOSIT_CENTS, FACILITY_DEPOSIT_DUE } from "../facility-parties/booking-terms";
const facilityDepositTerms=()=>({schemaVersion:1,depositCents:FACILITY_DEPOSIT_CENTS,dueDescription:FACILITY_DEPOSIT_DUE,balanceDescription:FACILITY_BALANCE_DUE});

const now=new Date("2026-11-01T15:00:00Z"),id="11111111-1111-4111-8111-111111111111",token="22222222-2222-4222-8222-222222222222";
const settings={pricing:{publicRoom10:120,publicRoom20Weekday:165,publicRoom20Weekend:190,privateWeekday90:195,privateWeekday120:210,privateWeekend90:220,privateWeekend120:255,privateAny180:380,taxRate:0.07}};
const selection={schemaVersion:1,kind:"public",room:"room-10",date:"2026-11-14",startMinutes:600,durationMinutes:90,addons:{customBirthdayBalloons:true,goodieBagsQuantity:2,cottonCandyPackage:"none"}};
const details={customerName:"Alex Morgan",email:"alex@example.test",phone:"2025550146",childName:"Sam",childGender:"Girl",childAge:"8",drinkChoice:"Soda",paymentMethod:"Cash",partyTheme:"Space",balloonColors:"blue",tableClothColors:"white",notes:""};
const claim={booking_id:id,kind:"customer" as const,execution_token:token,attempt:1,message_key:`receptionist-facility:${id}:customer`};
async function fixture(){
  const request={schemaVersion:1,idempotencyKey:"synthetic-action",details,selection,confirmedQuote:quoteFacilityParty(selection,settings,now),confirmedTerms:facilityDepositTerms(),depositAcknowledged:true};
  let row:Record<string,unknown>|undefined;
  const result=await submitFacilityBooking(request,{now:()=>now,lookup:async()=>null,settings:async()=>({value:settings,version:"33333333-3333-4333-8333-333333333333"}),availability:async()=>({quote:request.confirmedQuote,availability:"open-for-review"}),create:async(_request,booking)=>{row=booking;return id;}});
  assert.equal(result.status,200);assert.ok(row);
  return {booking:{...row,id,status:"pending"},snapshot:{booking_id:id,confirmed_quote:structuredClone(request.confirmedQuote),confirmed_terms:structuredClone(request.confirmedTerms),selection:structuredClone(selection),confirmed_details:structuredClone(details)}};
}

test("notices use the saved confirmed amounts and deposit terms, and say the party needs review",async()=>{
  const f=await fixture(),customer=buildFacilityNotification(claim,f.booking,f.snapshot,["owner@example.test"]);
  assert.deepEqual(customer.to,["alex@example.test"]);assert.match(customer.text,/\$146\.59/);assert.match(customer.text,/pending review/);assert.match(customer.text,/does not confirm a booking or payment/);
  assert.ok(customer.text.includes(f.snapshot.confirmed_terms.dueDescription));
  const owner=buildFacilityNotification({...claim,kind:"owner"},f.booking,f.snapshot,["owner@example.test"]);
  assert.deepEqual(owner.to,["owner@example.test"]);assert.match(owner.text,/Alex Morgan/);assert.match(owner.text,/Goodie bags: 2/);assert.match(owner.text,/Sam/);
});
test("changed booking facts, missing snapshot or changed status prevent message preparation",async()=>{
  const f=await fixture();
  for(const booking of [{...f.booking,status:"confirmed"},{...f.booking,total:1},{...f.booking,email:"different@example.test"},{...f.booking,phone:"2025550199"},{...f.booking,start_time:"2026-11-14T16:00:00.000Z"},{...f.booking,addon_selections:{selections:{}}}])assert.throws(()=>buildFacilityNotification(claim,booking,f.snapshot,["owner@example.test"]));
  assert.throws(()=>buildFacilityNotification(claim,f.booking,null,["owner@example.test"]));
  const changed=structuredClone(f.snapshot);changed.confirmed_quote.total=1;assert.throws(()=>buildFacilityNotification(claim,f.booking,changed,["owner@example.test"]));
  assert.throws(()=>buildFacilityNotification({...claim,kind:"owner"},f.booking,f.snapshot,[]));
});
