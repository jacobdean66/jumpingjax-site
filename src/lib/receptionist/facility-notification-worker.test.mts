import test from "node:test";
import assert from "node:assert/strict";
import {processOneFacilityNotification} from "./facility-notification-worker";

const booking="11111111-1111-4111-8111-111111111111",token="22222222-2222-4222-8222-222222222222";
const claim={booking_id:booking,kind:"customer" as const,execution_token:token,attempt:1,message_key:`receptionist-facility:${booking}:customer`};
const message={to:["alex@example.test"],subject:"Your party request",text:"Your request is pending review; this is not a confirmed booking."};
function fixture(){
  let claims=0,sends=0,finishes:{outcome:string;error:string|null}[]=[];
  const deps={enabled:true,claim:async()=>{claims++;return structuredClone(claim) as unknown;},prepare:async()=>structuredClone(message) as unknown,
    send:async(_message:unknown,key:string)=>{assert.equal(key,claim.message_key);sends++;return {accepted:true} as unknown;},
    finish:async(_claim:unknown,outcome:string,error:string|null)=>{finishes.push({outcome,error});return outcome==="not_attempted"?"pending":outcome as unknown;}};
  return {deps,stats:()=>({claims,sends,finishes})};
}

test("disabled workers never claim or send and an empty queue is idle",async()=>{
  const f=fixture();f.deps.enabled=false;assert.deepEqual(await processOneFacilityNotification(f.deps),{state:"disabled"});assert.equal(f.stats().claims,0);
  f.deps.enabled=true;f.deps.claim=async()=>null;assert.deepEqual(await processOneFacilityNotification(f.deps),{state:"idle"});assert.equal(f.stats().sends,0);
});
test("only a valid claim and explicit transport acceptance produce a sent result",async()=>{
  const f=fixture();assert.deepEqual(await processOneFacilityNotification(f.deps),{state:"sent"});assert.equal(f.stats().sends,1);assert.deepEqual(f.stats().finishes,[{outcome:"sent",error:null}]);
  const g=fixture();g.deps.claim=async()=>({...claim,message_key:"other-request"});assert.deepEqual(await processOneFacilityNotification(g.deps),{state:"unknown"});assert.equal(g.stats().sends,0);assert.deepEqual(g.stats().finishes,[]);
});
test("invalid or unavailable prepared data never reaches the transport",async()=>{
  for(const prepared of [null,{...message,to:["invalid"]},{...message,subject:"bad\r\nheader"},{...message,to:["alex@example.test","ALEX@example.test"]}]){
    const f=fixture();f.deps.prepare=async()=>prepared;assert.deepEqual(await processOneFacilityNotification(f.deps),{state:"unknown"});assert.equal(f.stats().sends,0);assert.deepEqual(f.stats().finishes,[{outcome:"unknown",error:"booking_unavailable"}]);
  }
  const f=fixture();f.deps.prepare=async()=>{throw Error("synthetic unavailable")};assert.deepEqual(await processOneFacilityNotification(f.deps),{state:"unknown"});assert.equal(f.stats().sends,0);
});
test("lost, conflicting and unrecordable outcomes stay unknown and are never retried here",async()=>{
  for(const result of [null,{accepted:false},{accepted:true,error:"conflict"}]){
    const f=fixture();f.deps.send=async()=>result;assert.deepEqual(await processOneFacilityNotification(f.deps),{state:"unknown"});assert.deepEqual(f.stats().finishes,[{outcome:"unknown",error:"provider_unknown"}]);
  }
  const f=fixture();f.deps.send=async()=>{throw Error("synthetic transport lost")};assert.deepEqual(await processOneFacilityNotification(f.deps),{state:"unknown"});assert.deepEqual(f.stats().finishes,[{outcome:"unknown",error:"transport_unknown"}]);
  const g=fixture();g.deps.finish=async()=>{throw Error("synthetic database lost")};assert.deepEqual(await processOneFacilityNotification(g.deps),{state:"unknown"});assert.equal(g.stats().sends,1);
});
