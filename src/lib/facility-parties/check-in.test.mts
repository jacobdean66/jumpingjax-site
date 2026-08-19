import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFacilityPartyCheckInUrl,
  buildFacilityPartyWaiverSignUrl,
  cleanPartyCheckInText,
  normalizeGuestDob,
  partyCheckInArrivalMessage,
  partyCheckInSigningMessage,
} from "./check-in";

test("builds public party check-in and waiver signing URLs", () => {
  const checkIn = new URL(
    buildFacilityPartyCheckInUrl({
      siteUrl: "http://localhost:3000",
      bookingId: "booking-123",
      partyDate: "September 12, 2026",
    }),
  );
  assert.equal(checkIn.pathname, "/facility-party-check-in");
  assert.equal(checkIn.searchParams.get("booking"), "booking-123");
  assert.equal(checkIn.searchParams.get("date"), "September 12, 2026");

  const waiver = new URL(
    buildFacilityPartyWaiverSignUrl({
      siteUrl: "http://localhost:3000",
      bookingId: "booking-123",
      partyDate: "September 12, 2026",
    }),
  );
  assert.equal(waiver.pathname, "/waiver");
  assert.equal(waiver.searchParams.get("source"), "facility-party");
  assert.equal(waiver.searchParams.get("booking"), "booking-123");
  assert.equal(waiver.searchParams.get("date"), "September 12, 2026");
});

test("normalizes public party check-in fields", () => {
  assert.equal(cleanPartyCheckInText("  Ava   Smith  "), "Ava Smith");
  assert.equal(normalizeGuestDob("2026-09-12"), "2026-09-12");
  assert.equal(normalizeGuestDob("09/12/2026"), "");
});

test("builds friendly arrival and signing messages", () => {
  assert.equal(
    partyCheckInArrivalMessage("September 12, 2026"),
    "You are checked in for the party on September 12, 2026. When you arrive, just tell staff your name and walk on through.",
  );
  assert.equal(
    partyCheckInSigningMessage("September 12, 2026"),
    "We did not find your waiver yet. Sign the waiver and we will check you in for the party on September 12, 2026.",
  );
});
