import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { POST } from "./route";

test("facility availability rejects malformed input and never assumes open when storage is unavailable",async()=>{
  const request=(body:string,type="application/json")=>new Request("http://localhost/api/receptionist/facility-availability",{method:"POST",headers:{"content-type":type},body});
  assert.equal((await POST(request("{}","text/plain"))).status,415);
  assert.equal((await POST(request("{"))).status,400);
  assert.equal((await POST(request("x".repeat(4097)))).status,413);
  const savedUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,savedKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {const result=await POST(request("{}"));assert.equal(result.status,503);assert.equal(result.headers.get("cache-control"),"no-store");assert.equal((await result.json()).availability,undefined);}
  finally {if(savedUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=savedUrl;if(savedKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=savedKey;}
});

test("facility availability route uses saved prices and actual bounded conflict reads",async t=>{
  t.mock.timers.enable({apis:["Date"],now:Date.parse("2026-11-01T15:00:00Z")});
  const pricing={publicRoom10:140,publicRoom20Weekday:215,publicRoom20Weekend:240,privateWeekday90:270,privateWeekday120:305,privateWeekend90:270,privateWeekend120:305,privateAny180:450,taxRate:0.07};
  const input={schemaVersion:1,kind:"public",room:"room-10",date:"2026-11-14",startMinutes:600,durationMinutes:90,addons:{customBirthdayBalloons:false,goodieBagsQuantity:0,cottonCandyPackage:"none"}};
  let rows:unknown[]=[];let fail=false,reads=0,reportedTotal:number|null=null;
  const server=createServer((request,response)=>{
    const url=new URL(request.url??"/","http://127.0.0.1");
    if(url.pathname==="/storage/v1/object/site-settings/public-settings.json"){response.writeHead(200,{"content-type":"application/json"});response.end(JSON.stringify({facilityPricing:pricing}));return;}
    if(url.pathname==="/rest/v1/facility_bookings"){
      reads++;assert.ok(url.searchParams.get("start_time")?.startsWith("lt."));assert.ok(url.searchParams.get("end_time")?.startsWith("gt."));
      const total=reportedTotal??rows.length,range=rows.length?`0-${rows.length-1}/${total}`:`*/${total}`;
      response.writeHead(fail?503:200,{"content-type":"application/json","content-range":range});response.end(JSON.stringify(fail?{message:"fixture unavailable"}:rows));return;
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});const address=server.address();if(!address||typeof address==='string')throw Error("Fixture server unavailable");
  const savedUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,savedKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL=`http://127.0.0.1:${address.port}`;process.env.SUPABASE_SERVICE_ROLE_KEY="synthetic-fixture-only";
  const request=()=>new Request("http://localhost/api/receptionist/facility-availability",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(input)});
  try {
    const open=await POST(request());assert.equal(open.status,200);const openBody=await open.json();assert.equal(openBody.availability,"open-for-review");assert.equal(openBody.bookingGuaranteed,false);assert.equal(openBody.quote.total,149.8);
    rows=[{id:"synthetic",party_kind:"private",room:"room-20",start_time:"2026-11-14T14:15:00.000Z",end_time:"2026-11-14T14:45:00.000Z",status:"pending"}];
    const blocked=await POST(request());assert.equal(blocked.status,200);assert.equal((await blocked.json()).availability,"unavailable");
    reportedTotal=2;assert.equal((await POST(request())).status,503);reportedTotal=null;
    fail=true;const unknown=await POST(request());assert.equal(unknown.status,503);assert.equal((await unknown.json()).availability,undefined);assert.ok(reads>=3);
  } finally {
    if(savedUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=savedUrl;if(savedKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=savedKey;
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});
