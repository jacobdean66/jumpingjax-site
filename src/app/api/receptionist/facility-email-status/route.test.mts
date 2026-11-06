import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { POST } from "./route";

test("email status is authenticated and only reports provider acceptance state",async()=>{
  const key="fixture-status-key-only-12345678901234567890",id="11111111-1111-4111-8111-111111111111";
  const names=["RECEPTIONIST_FACILITY_STATUS_ENABLED","RECEPTIONIST_FACILITY_STATUS_KEY","NEXT_PUBLIC_SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY"] as const;
  const prior=Object.fromEntries(names.map(name=>[name,process.env[name]]));let reads=0,state="sent";
  const fake=createServer((_req,res)=>{reads++;res.writeHead(200,{"content-type":"application/json"}).end(JSON.stringify([{state}]));});
  await new Promise<void>((resolve,reject)=>{fake.once("error",reject);fake.listen(0,"127.0.0.1",resolve);});
  const address=fake.address();if(!address||typeof address==="string")throw Error("Missing loopback address");
  process.env.RECEPTIONIST_FACILITY_STATUS_ENABLED="true";process.env.RECEPTIONIST_FACILITY_STATUS_KEY=key;
  process.env.NEXT_PUBLIC_SUPABASE_URL=`http://127.0.0.1:${address.port}`;process.env.SUPABASE_SERVICE_ROLE_KEY="fixture-loopback-only";
  const send=(authorization:string,body:unknown)=>POST(new Request("http://localhost/api/receptionist/facility-email-status",{method:"POST",headers:{authorization, "content-type":"application/json"},body:JSON.stringify(body)}));
  try {
    assert.equal((await send("Bearer wrong",{bookingId:id})).status,401);assert.equal(reads,0);
    const ok=await send(`Bearer ${key}`,{bookingId:id});assert.equal(ok.status,200);assert.deepEqual(await ok.json(),{status:"sent"});
    state="invalid";assert.equal((await send(`Bearer ${key}`,{bookingId:id})).status,503);
  } finally {for(const name of names){if(prior[name]===undefined)delete process.env[name];else process.env[name]=prior[name];}await new Promise<void>((resolve,reject)=>fake.close(e=>e?reject(e):resolve()));}
});
