import test from "node:test";
import assert from "node:assert/strict";
import {POST} from "./route";

test("receipt resend is disabled by default and rejects unauthorized service requests",async()=>{
  const names=["RECEPTIONIST_FACILITY_RESEND_ENABLED","RECEPTIONIST_FACILITY_RESEND_KEY"] as const;
  const prior=Object.fromEntries(names.map(name=>[name,process.env[name]]));
  const request=()=>new Request("https://example.test/api/receptionist/facility-receipt-resend",{method:"POST"});
  try {
    delete process.env.RECEPTIONIST_FACILITY_RESEND_ENABLED;
    assert.equal((await POST(request())).status,503);
    process.env.RECEPTIONIST_FACILITY_RESEND_ENABLED="true";
    process.env.RECEPTIONIST_FACILITY_RESEND_KEY="fixture-resend-key-only-123456789012345";
    assert.equal((await POST(request())).status,401);
  } finally {for(const name of names){if(prior[name]===undefined)delete process.env[name];else process.env[name]=prior[name];}}
});
