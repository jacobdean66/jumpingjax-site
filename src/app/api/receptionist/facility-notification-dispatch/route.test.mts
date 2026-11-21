import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "./route";

test("dispatch is disabled by default and rejects unauthenticated requests",async()=>{
  const names=["RECEPTIONIST_FACILITY_NOTIFICATION_ENABLED","RECEPTIONIST_FACILITY_NOTIFICATION_KEY","RESEND_API_KEY"] as const;
  const prior=Object.fromEntries(names.map(name=>[name,process.env[name]]));
  try {
    delete process.env.RECEPTIONIST_FACILITY_NOTIFICATION_ENABLED;
    const req=()=>new Request("https://example.test/api/receptionist/facility-notification-dispatch",{method:"POST"});
    assert.equal((await POST(req())).status,503);
    process.env.RECEPTIONIST_FACILITY_NOTIFICATION_ENABLED="true";
    process.env.RECEPTIONIST_FACILITY_NOTIFICATION_KEY="fixture-key-only-12345678901234567890";
    assert.equal((await POST(req())).status,401);
    delete process.env.RESEND_API_KEY;
    const authorized=new Request(req(),{headers:{authorization:`Bearer ${process.env.RECEPTIONIST_FACILITY_NOTIFICATION_KEY}`}});
    assert.equal((await POST(authorized)).status,503);
  } finally {for(const name of names){if(prior[name]===undefined)delete process.env[name];else process.env[name]=prior[name];}}
});
