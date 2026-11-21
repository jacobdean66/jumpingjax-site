import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchOneFacilityNotification, scheduleFacilityNotifications } from "./facility-notification-dispatch";
import { submitFacilityBooking } from "./facility-book";
import { quoteFacilityParty } from "./facility-quote";
import { FACILITY_BALANCE_DUE, FACILITY_DEPOSIT_CENTS, FACILITY_DEPOSIT_DUE } from "../facility-parties/booking-terms";

test("dispatches the saved customer request once with a guest-list link and retains unknown outcomes",async()=>{
  const id="11111111-1111-4111-8111-111111111111", token="22222222-2222-4222-8222-222222222222",now=new Date("2026-11-01T15:00:00Z");
  const pricing={pricing:{publicRoom10:120,publicRoom20Weekday:165,publicRoom20Weekend:190,privateWeekday90:195,privateWeekday120:210,privateWeekend90:220,privateWeekend120:255,privateAny180:380,taxRate:0.07}};
  const selection={schemaVersion:1,kind:"public",room:"room-10",date:"2026-11-14",startMinutes:600,durationMinutes:90,addons:{customBirthdayBalloons:false,goodieBagsQuantity:0,cottonCandyPackage:"none"}};
  const details={customerName:"Alex Morgan",email:"alex@example.test",phone:"2025550146",childName:"Sam",childGender:"Girl",childAge:"8",drinkChoice:"Soda",paymentMethod:"Cash",partyTheme:"",balloonColors:"",tableClothColors:"",notes:""};
  const quote=quoteFacilityParty(selection,pricing,now),terms={schemaVersion:1,depositCents:FACILITY_DEPOSIT_CENTS,dueDescription:FACILITY_DEPOSIT_DUE,balanceDescription:FACILITY_BALANCE_DUE};
  let row:Record<string,unknown>={};
  await submitFacilityBooking({schemaVersion:1,idempotencyKey:"synthetic",details,selection,confirmedQuote:quote,confirmedTerms:terms,depositAcknowledged:true},{now:()=>now,lookup:async()=>null,settings:async()=>({value:pricing,version:"33333333-3333-4333-8333-333333333333"}),availability:async()=>({quote,availability:"open-for-review"}),create:async(_r,booking)=>{row=booking;return id;}});
  const snapshot={booking_id:id,confirmed_quote:quote,confirmed_terms:terms,selection,confirmed_details:details};
  let state="pending",sends=0;const messages:string[]=[];
  const db={rpc:async(name:string,args?:Record<string,unknown>)=>{
    if(name==="claim_receptionist_facility_notification_v1") {
      if(state!=="pending")return {data:[],error:null};state="sending";
      return {data:[{booking_id:id,kind:"customer",execution_token:token,attempt:1,message_key:`receptionist-facility:${id}:customer`}],error:null};
    }
    if(name==="finish_receptionist_facility_notification_v1"){state=String(args?.p_outcome);return {data:state,error:null};}
    throw Error("Unexpected RPC");
  },from:(table:string)=>({select:()=>({eq:()=>({single:async()=>({data:table==="facility_bookings"?{...row,id,status:"pending"}:snapshot,error:null})})})})} as unknown as SupabaseClient;
  const saved=process.env.INVITATION_THEME_TOKEN_SECRET;process.env.INVITATION_THEME_TOKEN_SECRET="test-only-host-signing-key";
  const sender=async(input:{text:string;messageKey:string})=>{sends++;messages.push(input.text);assert.match(input.messageKey,/:customer:0$/);return {error:null};};
  try {
    assert.deepEqual(await dispatchOneFacilityNotification(db,true,sender),{state:"sent"});
    assert.match(messages[0],/pending review/);assert.match(messages[0],/\/facility-parties\/guest-list/);
    assert.deepEqual(await dispatchOneFacilityNotification(db,true,sender),{state:"idle"});assert.equal(sends,1);
    state="pending";
    assert.deepEqual(await dispatchOneFacilityNotification(db,true,async()=>{throw Error("lost");}),{state:"unknown"});
    assert.deepEqual(await dispatchOneFacilityNotification(db,true,sender),{state:"idle"});assert.equal(sends,1);
  } finally {if(saved===undefined)delete process.env.INVITATION_THEME_TOKEN_SECRET;else process.env.INVITATION_THEME_TOKEN_SECRET=saved;}
});

test("background dispatch targets the saved booking even when one notification fails",async()=>{
  let scheduled:(()=>Promise<void>)|undefined;const targets:string[]=[];
  scheduleFacilityNotifications("fixture-booking",work=>{scheduled=work;},async target=>{
    targets.push(`${target.bookingId}:${target.kind}`);if(target.kind==="customer")throw Error("transport unavailable");
  });
  assert.ok(scheduled);await scheduled();
  assert.deepEqual(targets,["fixture-booking:customer","fixture-booking:owner"]);
  assert.doesNotThrow(()=>scheduleFacilityNotifications("fixture-booking",()=>{throw Error("no background context");},async()=>{}));
});
