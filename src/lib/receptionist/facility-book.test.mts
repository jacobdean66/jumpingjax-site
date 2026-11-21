import test from "node:test";
import assert from "node:assert/strict";
import { submitFacilityBooking } from "./facility-book";
import { quoteFacilityParty } from "./facility-quote";
import { FACILITY_BALANCE_DUE, FACILITY_DEPOSIT_CENTS, FACILITY_DEPOSIT_DUE } from "../facility-parties/booking-terms";
const facilityDepositTerms=()=>({schemaVersion:1,depositCents:FACILITY_DEPOSIT_CENTS,dueDescription:FACILITY_DEPOSIT_DUE,balanceDescription:FACILITY_BALANCE_DUE});

const now=new Date("2026-11-01T15:00:00Z");
const settingsVersion="11111111-1111-4111-8111-111111111111";
const settings={pricing:{publicRoom10:120,publicRoom20Weekday:165,publicRoom20Weekend:190,privateWeekday90:195,privateWeekday120:210,privateWeekend90:220,privateWeekend120:255,privateAny180:380,taxRate:0.07}};
const selection={schemaVersion:1,kind:"public",room:"room-10",date:"2026-11-14",startMinutes:600,durationMinutes:90,addons:{customBirthdayBalloons:true,goodieBagsQuantity:2,cottonCandyPackage:"none"}};
const details={customerName:"Alex Morgan",email:"alex@example.test",phone:"2025550146",childName:"Sam",childGender:"Girl",childAge:"8",drinkChoice:"Soda",paymentMethod:"Cash",partyTheme:"Space",balloonColors:"blue",tableClothColors:"white",notes:""};
const makeRequest=()=>({schemaVersion:1,idempotencyKey:"synthetic-request-1",details:structuredClone(details),selection:structuredClone(selection),confirmedQuote:quoteFacilityParty(selection,settings,now),confirmedTerms:facilityDepositTerms(),depositAcknowledged:true});
function fixture(){
  let existing:string|null=null,reads=0,created=0,row:Record<string,unknown>|undefined,offline=false,blocked=false,changed=false,lost=false;
  return {deps:{now:()=>now,lookup:async()=>existing,settings:async()=>{reads++;if(offline)throw Error("offline");return {value:changed?{pricing:{...settings.pricing,publicRoom10:121}}:settings,version:settingsVersion};},
    availability:async()=>({quote:quoteFacilityParty(selection,settings,now),availability:blocked?"unavailable":"open-for-review"}),
    create:async(_request:unknown,booking:Record<string,unknown>,_key:string,version:string)=>{assert.equal(version,settingsVersion);created++;row=booking;if(lost)throw Error("lost response");return "fictional-booking";}},
    existing:(v:string|null)=>{existing=v;},offline:()=>{offline=true;},changed:()=>{changed=true;},blocked:()=>{blocked=true;},lost:()=>{lost=true;},stats:()=>({reads,created,row})};
}

test("maps only a valid confirmed request into a pending party and queues via the adapter",async()=>{
  const f=fixture(),request=makeRequest(),result=await submitFacilityBooking(request,f.deps);
  assert.deepEqual(result,{status:200,body:{ok:true,status:"pending",id:"fictional-booking"}});
  const {created,row}=f.stats();assert.equal(created,1);assert.equal(row?.customer_name,"Alex Morgan");assert.equal(row?.total,146.59);assert.equal(row?.deposit_acknowledged,true);assert.equal(row?.start_time,"2026-11-14T15:00:00.000Z");assert.equal(row?.end_time,"2026-11-14T16:30:00.000Z");
  assert.deepEqual((row?.addon_selections as {selections:unknown}).selections,selection.addons);
});

test("reconciles an exact previous receipt before price, terms, input mapping or storage",async()=>{
  const f=fixture(),request=makeRequest();f.existing("prior-fixture");f.offline();
  assert.deepEqual(await submitFacilityBooking(request,f.deps),{status:200,body:{ok:true,status:"pending",id:"prior-fixture"}});
  assert.equal(f.stats().reads,0);assert.equal(f.stats().created,0);
});

test("changed quotes, terms, slots and unsafe input never issue a create",async()=>{
  const cases:[ReturnType<typeof fixture>,unknown,string][]=[];
  {const f=fixture();f.changed();cases.push([f,makeRequest(),"FACILITY_QUOTE_CHANGED"]);}
  {const f=fixture(),r=makeRequest();r.confirmedTerms={...r.confirmedTerms,depositCents:1};cases.push([f,r,"FACILITY_TERMS_CHANGED"]);}
  {const f=fixture();f.blocked();cases.push([f,makeRequest(),"FACILITY_SLOT_UNAVAILABLE"]);}
  {const f=fixture(),r=makeRequest();r.details.paymentMethod="crypto";cases.push([f,r,"FACILITY_OPTIONS_CHANGED"]);}
  {const f=fixture(),r=makeRequest();r.details.childAge="999";cases.push([f,r,"FACILITY_INPUT_REJECTED"]);}
  {const f=fixture(),r=makeRequest();r.depositAcknowledged=false;cases.push([f,r,"FACILITY_INPUT_REJECTED"]);}
  {const f=fixture(),r={...makeRequest(),admin:true};cases.push([f,r,"FACILITY_INPUT_REJECTED"]);}
  for(const [f,r,code] of cases){const result=await submitFacilityBooking(r,f.deps);assert.equal(result.body.code,code);assert.equal(result.body.writeAttempted,undefined);assert.equal(f.stats().created,0);}
});

test("lookup, configuration and write uncertainty never claim a known absence of booking",async()=>{
  const f=fixture();f.offline();const unavailable=await submitFacilityBooking(makeRequest(),f.deps);assert.equal(unavailable.body.code,"FACILITY_CONFIG_UNAVAILABLE");assert.equal(unavailable.body.writeAttempted,undefined);
  const g=fixture();g.lost();const lost=await submitFacilityBooking(makeRequest(),g.deps);assert.equal(lost.body.code,"FACILITY_STATUS_UNKNOWN");assert.equal(lost.body.writeAttempted,undefined);assert.equal(g.stats().created,1);
  const h=fixture();h.deps.lookup=async()=>{throw Error("database unavailable")};const unknown=await submitFacilityBooking(makeRequest(),h.deps);assert.equal(unknown.body.code,"FACILITY_STATUS_UNKNOWN");assert.equal(h.stats().created,0);
});

