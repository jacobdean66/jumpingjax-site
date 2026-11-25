import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { GET, POST } from "./route";

test("facility price endpoint fails closed when storage is not configured", async () => {
  const savedUrl=process.env.NEXT_PUBLIC_SUPABASE_URL, savedKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const result=await GET(new Request("http://localhost/api/receptionist/facility-pricing"));
    assert.equal(result.status,503);assert.equal(result.headers.get("cache-control"),"no-store");
    const body=await result.json();assert.equal(body.pricing,undefined);
  } finally {
    if(savedUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=savedUrl;
    if(savedKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=savedKey;
  }
});

test("facility quote rejects wrong, malformed and oversized bodies before accessing storage",async()=>{
  const request=(body:string,type:string)=>new Request("http://localhost/api/receptionist/facility-pricing",{method:"POST",headers:{"content-type":type},body});
  assert.equal((await POST(request("{}","text/plain"))).status,415);
  assert.equal((await POST(request("{","application/json"))).status,400);
  assert.equal((await POST(request("x".repeat(4097),"application/json"))).status,413);
});

test("facility quote uses saved site prices and never claims a slot is booked",async t=>{
  t.mock.timers.enable({apis:["Date"],now:Date.parse("2026-11-01T15:00:00Z")});
  const pricing={publicRoom10:140,publicRoom20Weekday:215,publicRoom20Weekend:240,privateWeekday90:270,privateWeekday120:305,privateWeekend90:270,privateWeekend120:305,privateAny180:450,taxRate:0.07};
  const server=createServer((request,response)=>{if(new URL(request.url??"/","http://127.0.0.1").pathname!=="/storage/v1/object/site-settings/public-settings.json"){response.writeHead(404).end();return;}response.writeHead(200,{"content-type":"application/json"});response.end(JSON.stringify({facilityPricing:pricing}));});
  await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});const address=server.address();if(!address||typeof address==='string')throw Error("Fixture server unavailable");
  const savedUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,savedKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL=`http://127.0.0.1:${address.port}`;process.env.SUPABASE_SERVICE_ROLE_KEY="synthetic-fixture-only";
  try {
    const input={schemaVersion:1,kind:"public",room:"room-10",date:"2026-11-14",startMinutes:600,durationMinutes:90,addons:{customBirthdayBalloons:true,goodieBagsQuantity:2,cottonCandyPackage:"none"}};
    const response=await POST(new Request("http://localhost/api/receptionist/facility-pricing",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(input)}));
    assert.equal(response.status,200);const body=await response.json();assert.equal(body.total,167.99);assert.equal(body.availability,"not-checked");assert.equal(body.finalReviewRequired,true);
  } finally {
    if(savedUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=savedUrl;if(savedKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=savedKey;
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});
