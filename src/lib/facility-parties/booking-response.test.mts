import assert from "node:assert/strict";
import test from "node:test";
import { readFacilityBookingResponse } from "./booking-response";

test("booking failures preserve server explanations and retry timing", async () => {
  await assert.rejects(readFacilityBookingResponse(Response.json({error:"Facility pricing is not configured for this party option"}, {status:400})), /Facility pricing is not configured/);
  await assert.rejects(readFacilityBookingResponse(Response.json({error:"Booking window is unavailable"}, {status:409})), /Booking window is unavailable/);
  await assert.rejects(readFacilityBookingResponse(Response.json({error:"Too many requests"}, {status:429, headers:{"Retry-After":"2175"}})), /wait 37 minute/);
  await assert.rejects(readFacilityBookingResponse(new Response("Gateway unavailable", {status:503})), /could not submit/);
});

test("success requires a saved booking identifier", async () => {
  assert.equal(await readFacilityBookingResponse(Response.json({id:"booking-1"})), "booking-1");
  for (const body of [{}, {id:""}, {id:null}]) {
    await assert.rejects(readFacilityBookingResponse(Response.json(body)), /could not confirm whether your request was saved/);
  }
});
