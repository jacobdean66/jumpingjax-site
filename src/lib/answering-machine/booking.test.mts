import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildAnsweringMachineBookingRequest } from "./booking.ts";
import type { AnsweringMachineCall } from "./types.ts";

function call(overrides: Partial<AnsweringMachineCall> = {}): AnsweringMachineCall {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    callReference: "WA-TEST1234", callerLabel: "Test caller", status: "needs_review",
    serviceKind: "rental", eventDate: "2027-02-15", facilityStartTime: null,
    rentalItems: ["18-ft-basic-waterslide"], transcript: "Complete test transcript.",
    transcriptComplete: true, voicemailAvailable: false, agentSummary: "", ownerNotes: "",
    bookingDetails: {
      customerName: "Taylor Test", customerEmail: "taylor@example.com", customerPhone: "555-555-0100",
      eventStartTime: "12:00", duration: "4 Hours", requestedDeliveryWindow: "8:00 AM - 10:00 AM",
      eventAddress: "100 Test Lane", distanceMiles: 12, setupSurface: "Grass",
      setupAccess: "Wide gate", setupNotes: "", paymentMethod: "Card",
      facilityPartyKind: "private", facilityRoom: "room-20", facilityDurationMinutes: 120,
      childName: "Avery", childGender: "Girl", childAge: "7", partyTheme: "Space", drinkChoice: "Capri-Sun",
    },
    bookingKind: null, bookingId: null, bookingCreatedAt: null, bookingError: "",
    revision: 2, createdAt: "2026-09-25T12:00:00.000Z", updatedAt: "2026-09-25T12:00:00.000Z",
    ...overrides,
  };
}

test("rental call builds the existing protected rental booking request", () => {
  const request = buildAnsweringMachineBookingRequest(call());
  assert.equal(request.path, "/api/book");
  assert.equal(request.body.idempotency_key, "answering-machine:11111111-1111-4111-8111-111111111111");
  assert.deepEqual(request.body.rental_items, [{ rental_item: "18-ft-basic-waterslide" }]);
  assert.equal(request.body.customer_email, "taylor@example.com");
});

test("facility call builds a valid private facility request", () => {
  const request = buildAnsweringMachineBookingRequest(call({
    serviceKind: "facility_party", facilityStartTime: "14:00", rentalItems: [],
  }));
  assert.equal(request.path, "/api/facility/book");
  assert.equal(request.body.start_minutes, 840);
  assert.equal(request.body.end_minutes, 960);
  assert.equal(request.body.room, "room-20");
});

test("booking creation stays blocked until required customer details are present", () => {
  const incomplete = call({ bookingDetails: { ...call().bookingDetails, customerEmail: "" } });
  assert.throws(() => buildAnsweringMachineBookingRequest(incomplete), /Customer email is required/);
});

test("finished migration repairs transcript completion and links one idempotent booking", async () => {
  const sql = await readFile(new URL("../../../supabase/migrations/20260925190000_finish_answering_machine_booking.sql", import.meta.url), "utf8");
  assert.match(sql, /transcript_complete = case when p_patch \? 'transcriptComplete'/i);
  assert.match(sql, /create or replace function public\.complete_answering_machine_booking/i);
  assert.match(sql, /unique index if not exists answering_machine_calls_booking_link_idx/i);
  assert.doesNotMatch(sql, /insert into public\.(bookings|facility_bookings)/i);
});

test("admin route delegates creation to the existing rental and facility booking APIs", async () => {
  const route = await readFile(new URL("../../app/api/admin/answering-machine/route.ts", import.meta.url), "utf8");
  assert.match(route, /app\/api\/book\/route/);
  assert.match(route, /app\/api\/facility\/book\/route/);
  assert.match(route, /completeAnsweringMachineBooking/);
});
