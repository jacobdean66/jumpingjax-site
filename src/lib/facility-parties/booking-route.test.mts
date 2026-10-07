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

test("contact-only bookings save with blank optional details and preserve supplied details", async context => {
  const envNames = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "APPROVAL_TOKEN_SECRET"] as const;
  const previous = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
  process.env.APPROVAL_TOKEN_SECRET = "isolated-facility-test-secret-at-least-32-characters";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://facility-minimal-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";
  const bookings: Record<string, unknown>[] = [];
  const notifications: Record<string, unknown>[] = [];
  context.mock.method(globalThis, "fetch", async (source: string | Request, init?: RequestInit) => {
    const request = new Request(source, init);
    const url = new URL(request.url);
    assert.equal(url.hostname, "facility-minimal-test.supabase.co", "No live database, email, or calendar traffic");
    if (url.pathname.endsWith("public-settings.json")) return Response.json({});
    if (url.pathname === "/rest/v1/rpc/create_facility_booking_atomic") {
      const body = await request.json();
      bookings.push(body.p_booking);
      return Response.json("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    }
    if (url.pathname === "/rest/v1/facility_bookings" && request.method === "GET") return Response.json([]);
    if (url.pathname === "/rest/v1/booking_notification_outbox") {
      if(request.method === "POST") notifications.push(await request.json());
      if(request.method === "GET") return Response.json({status:"sent"});
      return new Response(null, {status:204});
    }
    assert.ok(["/rest/v1/facility_bookings", "/rest/v1/booking_integration_workflows", "/rest/v1/rpc/record_booking_workflow_outcome"].includes(url.pathname), url.pathname);
    return new Response(null, {status:204});
  });
  try {
    const base = {party_kind:"public",room:"room-10",booking_date:"2027-01-09",start_minutes:600,end_minutes:690,customer_name:"Test Customer",email:"test@example.invalid",phone:"8645550100"};
    const optionalNames = ["child_name","child_gender","child_age","party_theme","balloon_colors","table_cloth_colors","drink_choice","payment_method"];
    const cases = [{}, Object.fromEntries(optionalNames.map(name=>[name, ""])), Object.fromEntries(optionalNames.map(name=>[name, null])), {child_name:"Test Child",child_age:"5",child_gender:"Boy",party_theme:"Sports",balloon_colors:"Blue",table_cloth_colors:"White",drink_choice:"Water",payment_method:"Cash"}];
    for (const [index, details] of cases.entries()) {
      const response = await POST(new NextRequest("https://example.com/api/facility/book", {method:"POST",headers:{"content-type":"application/json","x-forwarded-for":`minimal-${index}`},body:JSON.stringify({...base,...details,idempotency_key:`minimal-${index}`})}));
      assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
      assert.equal((await response.json()).id,"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
      const saved = bookings[index];
      assert.equal(saved.customer_name,base.customer_name);
      assert.equal(saved.readable_date,base.booking_date);
      for(const name of optionalNames) assert.equal(saved[name], index===3 ? details[name as keyof typeof details] : "", name);
      assert.equal(saved.deposit_acknowledged,false);
    }
    assert.equal(bookings.length,4);
    assert.equal(notifications.filter(row => row.purpose === "initial_customer_receipt").length,4, "Every saved request gets a receipt even without confirmed theme artwork");
    for (const receipt of notifications.filter(row => row.purpose === "initial_customer_receipt")) {
      assert.match(String(receipt.body), /View your party guest list: https:\/\/[^\s]+\/facility-parties\/guest-list\?booking=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&token=/);
      assert.match(String(receipt.html_body), /href="https:\/\/[^\s]+\/facility-parties\/guest-list\?booking=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&amp;token=/);
    }
    for(const notification of notifications) assert.doesNotMatch(String(notification.body), /undefined|null/);
    for(const [index, missing] of [{customer_name:""},{phone:""},{email:""},{email:"bad-email"},{booking_date:""}].entries()) {
      const response = await POST(new NextRequest("https://example.com/api/facility/book", {method:"POST",headers:{"x-forwarded-for":`missing-${index}`},body:JSON.stringify({...base,...missing,idempotency_key:`missing-${index}`})}));
      assert.equal(response.status,400);
    }
    assert.equal(bookings.length,4,"Invalid required fields must never save");
  } finally {
    for(const name of envNames) {if(previous[name]===undefined) delete process.env[name]; else process.env[name]=previous[name];}
  }
});
