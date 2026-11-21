import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { POST } from "./route";
import { quoteFacilityParty } from "../../../../lib/receptionist/facility-quote";
import { FACILITY_BALANCE_DUE, FACILITY_DEPOSIT_CENTS, FACILITY_DEPOSIT_DUE } from "../../../../lib/facility-parties/booking-terms";
const facilityDepositTerms=()=>({schemaVersion:1,depositCents:FACILITY_DEPOSIT_CENTS,dueDescription:FACILITY_DEPOSIT_DUE,balanceDescription:FACILITY_BALANCE_DUE});
import { FACILITY_POLICY_DIGEST } from "../../../../lib/receptionist/facility-policy-version";

test("authenticated route reconciles lost responses and fails closed using only a fictional loopback backend",async t=>{
  t.mock.timers.enable({apis:["Date"],now:Date.parse("2026-11-01T15:00:00Z")});
  const key="synthetic-fixture-credential-only-12345",names=["RECEPTIONIST_FACILITY_WRITE_ENABLED","RECEPTIONIST_FACILITY_API_KEY","NEXT_PUBLIC_SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY"] as const;
  const saved=Object.fromEntries(names.map(name=>[name,process.env[name]]));
  const pricing={publicRoom10:120,publicRoom20Weekday:165,publicRoom20Weekend:190,privateWeekday90:195,privateWeekday120:210,privateWeekend90:220,privateWeekend120:255,privateAny180:380,taxRate:0.07};
  const selection={schemaVersion:1,kind:"public",room:"room-10",date:"2026-11-14",startMinutes:600,durationMinutes:90,addons:{customBirthdayBalloons:false,goodieBagsQuantity:0,cottonCandyPackage:"none"}};
  const requestBody={schemaVersion:1,idempotencyKey:"synthetic-action-1",selection,details:{customerName:"Alex Morgan",email:"alex@example.test",phone:"2025550146",childName:"Sam",childGender:"Girl",childAge:"8",drinkChoice:"Soda",paymentMethod:"Cash",partyTheme:"",balloonColors:"",tableClothColors:"",notes:""},confirmedQuote:quoteFacilityParty(selection,{pricing},new Date()),confirmedTerms:facilityDepositTerms(),depositAcknowledged:true};
  let receipt:unknown=null,lookupCalls=0,storageCalls=0,createCalls=0,availabilityCalls=0,price=120,blocked=false,loseResponse=false,lastRow:Record<string,unknown>|undefined;
  let settingsVersion="11111111-1111-4111-8111-111111111111",changeDuringDownload=false,changeBeforeCreate=false,changePolicyBeforeCreate=false;
  const nextVersion="22222222-2222-4222-8222-222222222222";
  const fake=createServer((req,res)=>{
    const target=new URL(req.url??"/","http://127.0.0.1"),path=target.pathname;let body="";
    req.on("data",chunk=>body+=chunk);req.on("end",()=>{
      if(path==="/rest/v1/rpc/lookup_receptionist_facility_booking_v3") {lookupCalls++;const input=JSON.parse(body);if(receipt&&!assertDeepEqual(input.p_request,receipt)){res.writeHead(400,{"content-type":"application/json"}).end(JSON.stringify({message:"mismatch"}));return;}res.writeHead(200,{"content-type":"application/json"}).end(JSON.stringify(receipt?"synthetic-booking":null));return;}
      if(path==="/rest/v1/rpc/receptionist_facility_settings_version_v1"){res.writeHead(200,{"content-type":"application/json"}).end(JSON.stringify(settingsVersion));return;}
      if(path==="/storage/v1/object/site-settings/public-settings.json"){storageCalls++;assert.match(target.searchParams.get("cacheNonce")??"",/^[0-9a-f-]{36}$/i);if(changeDuringDownload){settingsVersion=nextVersion;changeDuringDownload=false;}res.writeHead(200,{"content-type":"application/json"}).end(JSON.stringify({facilityPricing:{...pricing,publicRoom10:price}}));return;}
      if(path==="/rest/v1/facility_bookings"){availabilityCalls++;const rows=blocked?[{id:"fixture",party_kind:"private",room:"room-20",start_time:"2026-11-14T15:00:00.000Z",end_time:"2026-11-14T16:30:00.000Z",status:"pending"}]:[];res.writeHead(200,{"content-type":"application/json","content-range":rows.length?"0-0/1":"*/0"}).end(JSON.stringify(rows));return;}
      if(path==="/rest/v1/rpc/create_receptionist_facility_booking_guarded_v4"){createCalls++;const input=JSON.parse(body);assert.equal(input.p_policy_digest,FACILITY_POLICY_DIGEST);if(changePolicyBeforeCreate){changePolicyBeforeCreate=false;res.writeHead(400,{"content-type":"application/json"}).end(JSON.stringify({message:"policy changed"}));return;}if(changeBeforeCreate){settingsVersion=nextVersion;changeBeforeCreate=false;}if(input.p_settings_version!==settingsVersion){res.writeHead(400,{"content-type":"application/json"}).end(JSON.stringify({message:"settings changed"}));return;}receipt=input.p_request;lastRow=input.p_booking;if(loseResponse){res.writeHead(503,{"content-type":"application/json"}).end(JSON.stringify({message:"lost"}));return;}res.writeHead(200,{"content-type":"application/json"}).end(JSON.stringify("synthetic-booking"));return;}
      res.writeHead(404).end();
    });
  });
  function assertDeepEqual(a:unknown,b:unknown){try{assert.deepEqual(a,b);return true;}catch{return false;}}
  await new Promise<void>((resolve,reject)=>{fake.once("error",reject);fake.listen(0,"127.0.0.1",resolve);});const address=fake.address();if(!address||typeof address==="string")throw Error("Missing fixture address");
  process.env.RECEPTIONIST_FACILITY_API_KEY=key;process.env.RECEPTIONIST_FACILITY_WRITE_ENABLED="true";process.env.NEXT_PUBLIC_SUPABASE_URL=`http://127.0.0.1:${address.port}`;process.env.SUPABASE_SERVICE_ROLE_KEY="synthetic-loopback-only";
  const send=(value:unknown,auth=key)=>POST(new Request("http://localhost/api/receptionist/facility-book",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${auth}`},body:JSON.stringify(value)}));
  try {
    assert.equal((await send(requestBody,"wrong-credential")).status,401);assert.equal(lookupCalls,0);
    process.env.RECEPTIONIST_FACILITY_WRITE_ENABLED="false";assert.equal((await send(requestBody)).status,503);process.env.RECEPTIONIST_FACILITY_WRITE_ENABLED="true";assert.equal(lookupCalls,0);
    const invalidType=await POST(new Request("http://localhost/api/receptionist/facility-book",{method:"POST",headers:{"content-type":"application/jsonp",authorization:`Bearer ${key}`},body:"{}"}));assert.equal(invalidType.status,415);assert.equal(lookupCalls,0);
    const oversize=await POST(new Request("http://localhost/api/receptionist/facility-book",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${key}`},body:"x".repeat(32769)}));assert.equal(oversize.status,413);assert.equal(lookupCalls,0);
    price=121;const changed=await send(requestBody);assert.equal(changed.status,409);assert.equal((await changed.json()).code,"FACILITY_QUOTE_CHANGED");assert.equal(createCalls,0);
    price=120;blocked=true;const occupied=await send(requestBody);assert.equal(occupied.status,409);assert.equal((await occupied.json()).code,"FACILITY_SLOT_UNAVAILABLE");assert.equal(createCalls,0);
    blocked=false;changeDuringDownload=true;const changedWhileReading=await send(requestBody);assert.equal(changedWhileReading.status,503);assert.equal((await changedWhileReading.json()).code,"FACILITY_CONFIG_UNAVAILABLE");assert.equal(createCalls,0);
    settingsVersion="11111111-1111-4111-8111-111111111111";changeBeforeCreate=true;const changedBeforeSave=await send(requestBody);assert.equal(changedBeforeSave.status,503);assert.equal((await changedBeforeSave.json()).code,"FACILITY_STATUS_UNKNOWN");assert.equal(createCalls,1);assert.equal(receipt,null);
    settingsVersion="11111111-1111-4111-8111-111111111111";changePolicyBeforeCreate=true;const changedPolicy=await send(requestBody);assert.equal(changedPolicy.status,503);assert.equal((await changedPolicy.json()).code,"FACILITY_STATUS_UNKNOWN");assert.equal(createCalls,2);assert.equal(receipt,null);
    loseResponse=true;const uncertain=await send(requestBody);assert.equal(uncertain.status,503);const unknown=await uncertain.json();assert.equal(unknown.code,"FACILITY_STATUS_UNKNOWN");assert.equal(unknown.writeAttempted,undefined);assert.equal(createCalls,3);
    assert.equal(lastRow?.customer_name,"Alex Morgan");assert.equal(lastRow?.total,128.4);assert.equal(lastRow?.deposit_acknowledged,true);
    const oldStorage=storageCalls,oldAvailability=availabilityCalls;price=300;
    const replay=await send(requestBody);assert.equal(replay.status,200);assert.deepEqual(await replay.json(),{ok:true,status:"pending",id:"synthetic-booking"});assert.equal(createCalls,3);assert.equal(storageCalls,oldStorage);assert.equal(availabilityCalls,oldAvailability);
    const changedPayload={...requestBody,details:{...requestBody.details,phone:"2025550199"}};
    const mismatch=await send(changedPayload);assert.equal(mismatch.status,503);assert.equal((await mismatch.json()).code,"FACILITY_STATUS_UNKNOWN");assert.equal(createCalls,3);
  } finally {
    for(const name of names){if(saved[name]===undefined)delete process.env[name];else process.env[name]=saved[name];}
    await new Promise<void>((resolve,reject)=>fake.close(error=>error?reject(error):resolve()));
  }
});
