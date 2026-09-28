import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../../app/api/facility/book/route";
import { GET } from "../../app/api/facility/unavailable/route";
import { listPrivateSlotDispositions, listPublicSaturdaySlotDispositions } from "./availability";

test("all offered party combinations pass the real route's pricing and time validation", async context => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://facility-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";
  let conflictQueries = 0;
  context.mock.method(globalThis, "fetch", async (source: string | Request, init?: RequestInit) => {
    const request = new Request(source, init);
    const url = new URL(request.url);
    assert.equal(url.hostname, "facility-test.supabase.co", "No real service traffic");
    assert.equal(request.method, "GET", "No writes or notifications during this validation test");
    if (url.pathname.endsWith("public-settings.json")) return Response.json({});
    assert.equal(url.pathname, "/rest/v1/facility_bookings");
    conflictQueries++;
    // Stop after successful validation, before any booking can be written.
    return Response.json({message:"Test database unavailable", code:"TEST"}, {status:400});
  });
  try {
    let attempts = 0;
    for (const date of ["2027-01-03","2027-01-04","2027-01-05","2027-01-06","2027-01-07","2027-01-08","2027-01-09"]) {
      const options = [
        ...(["room-10","room-20"] as const).map(room => ({party_kind:"public",room,slots:listPublicSaturdaySlotDispositions(date,room,[])})),
        ...([90,120,180] as const).map(duration => ({party_kind:"private",room:"room-20",slots:listPrivateSlotDispositions(date,duration,[])})),
      ];
      for (const option of options) {
        const slot = option.slots[0];
        if (!slot) continue;
        attempts++;
        const response = await POST(new NextRequest("https://example.com/api/facility/book", {
          method:"POST", headers:{"content-type":"application/json","x-forwarded-for":`test-${attempts}`},
          body:JSON.stringify({party_kind:option.party_kind,room:option.room,booking_date:date,start_minutes:slot.startMinutes,end_minutes:slot.endMinutes,idempotency_key:`test-${attempts}`,parent_name:"Test Parent",email:"test@example.invalid",phone:"test",child_name:"Test Child",child_age:"5",child_gender:"Boy",drink_choice:"Water",payment_method:"Cash"}),
        }));
        assert.equal(response.status,503,`${date} ${option.party_kind} ${slot.endMinutes-slot.startMinutes}`);
        assert.deepEqual(await response.json(),{error:"Unable to verify facility availability"});
      }
    }
    assert.equal(attempts,29);
    assert.equal(conflictQueries,29);
    context.mock.method(console,"error",()=>{});
    const unavailable = await GET(new Request("https://example.com/api/facility/unavailable?date=2027-01-07"));
    assert.equal(unavailable.status,503,"A database failure must not advertise an empty, available calendar");
    assert.equal(Array.isArray(await unavailable.json()),false);
  } finally {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL=oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;
  }
});
