import assert from "node:assert/strict";
import test from "node:test";
import { prepareRentalBooking } from "../rental-agreements/prepare-booking";
import { insertPendingBooking } from "../supabase/booking-data";

test("minimal rental requests persist without timing, setup, payment, distance, or signature", async context => {
  const names = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://minimal-rental-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "isolated-test-key";
  const saved: Record<string, unknown>[] = [];
  context.mock.method(globalThis, "fetch", async (source: string | Request, init?: RequestInit) => {
    const request = new Request(source, init);
    const url = new URL(request.url);
    assert.equal(url.hostname, "minimal-rental-test.supabase.co", "No live service traffic");
    if (request.method === "GET") return Response.json([]);
    assert.equal(url.pathname, "/rest/v1/rpc/create_rental_booking_atomic_v2");
    const payload = await request.json();
    assert.equal(payload.p_agreement, undefined, "Do not create a signed agreement for a contact-only request");
    saved.push(payload.p_booking);
    return Response.json(123);
  });
  const base = { rental_item: "castle", event_date: "2028-12-31", customer_name: "Test Customer", customer_phone: "(864) 555-0100", customer_email: "test@example.invalid", event_address: "Test street, Greenwood, SC" };
  const optional = ["event_start_time", "requested_delivery_window", "setup_surface", "setup_access", "setup_notes", "payment_method", "distance_miles"];
  try {
    const cases = [{}, Object.fromEntries(optional.map(name => [name, ""])), Object.fromEntries(optional.map(name => [name, null])), {event_start_time:"14:00",requested_delivery_window:"10 AM - 1 PM",setup_surface:"Grass",setup_access:"Driveway",payment_method:"Cash",distance_miles:5}];
    for (const [index, extra] of cases.entries()) {
      const prepared = await prepareRentalBooking({...base,...extra,idempotency_key:`minimal-${index}`});
      assert.ok(!(prepared instanceof Response));
      assert.equal(prepared.input.spanDays, 1);
      assert.equal(prepared.input.subtotal, 150, "Use catalog pricing");
      assert.deepEqual(await insertPendingBooking(prepared.input), {ok:true,id:"123"});
      assert.equal(saved[index].event_address, base.event_address);
      assert.equal(saved[index].customer_name, base.customer_name);
      assert.equal(saved[index].status, "pending");
      assert.equal(saved[index].event_start_time, index === 3 ? "14:00" : undefined);
      assert.equal(saved[index].setup_surface, index === 3 ? "Grass" : "");
      assert.equal(saved[index].payment_method, index === 3 ? "Cash" : "");
    }
    for (const extra of [{customer_name:""},{customer_phone:""},{customer_phone:"123"},{customer_email:""},{customer_email:"invalid"},{event_address:""},{event_date:"invalid"},{event_start_time:"25:00"}]) {
      const prepared = await prepareRentalBooking({...base,...extra,idempotency_key:"invalid-test"});
      assert.ok(prepared instanceof Response);
      assert.equal(prepared.status, 400);
    }
    assert.equal(saved.length, 4, "Invalid requests must not persist");
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
