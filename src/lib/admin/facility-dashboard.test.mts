import assert from "node:assert/strict";
import test from "node:test";
import { facilityDashboardBounds, matchesFacilityPartySearch } from "./facility-dashboard";
import { facilityAdminDay, facilityAdminNextMidnight } from "./facility-admin-date";

test("parties move to history at Eastern midnight, including on a UTC server", () => {
  const before = new Date("2026-10-06T03:59:59Z");
  const after = new Date("2026-10-06T04:00:00Z");
  assert.equal(facilityAdminDay(before), "2026-10-05");
  assert.equal(facilityAdminDay(after), "2026-10-06");
  const partyStart = "2026-10-05T19:00:00.000Z";
  assert.ok(partyStart >= facilityDashboardBounds({ view: "upcoming", today: facilityAdminDay(before) }).start!);
  assert.ok(partyStart < facilityDashboardBounds({ view: "past", today: facilityAdminDay(after) }).endExclusive!);
  assert.equal(facilityAdminNextMidnight(before), after.toISOString());
});

test("cutoff and refresh follow both daylight saving transitions", () => {
  assert.equal(facilityAdminNextMidnight(new Date("2026-03-08T05:00:00Z")), "2026-03-09T04:00:00.000Z");
  assert.equal(facilityAdminNextMidnight(new Date("2026-11-01T04:00:00Z")), "2026-11-02T05:00:00.000Z");
});

test("date filters cannot put past parties in upcoming or future parties in history", () => {
  assert.deepEqual(facilityDashboardBounds({ view: "upcoming", today: "2026-10-05", from: "2026-09-01" }), { start: "2026-10-05T04:00:00.000Z", endExclusive: undefined });
  assert.deepEqual(facilityDashboardBounds({ view: "past", today: "2026-10-05", to: "2026-12-01" }), { start: undefined, endExclusive: "2026-10-05T04:00:00.000Z" });
  assert.deepEqual(facilityDashboardBounds({ view: "past", today: "2026-10-05", from: "2026-09-01", to: "2026-09-30" }), { start: "2026-09-01T04:00:00.000Z", endExclusive: "2026-10-01T04:00:00.000Z" });
});

const party = { childName: "Sam Rivera", parentName: "Taylor Rivera", customerName: "Jamie Rivera", phone: "+1 (864) 555-1234", startTime: "2026-10-05T01:00:00Z", readableDate: null };
test("history searches child, parent, contact, formatted phone, and local party date", () => {
  for (const query of [" sam ", "TAYLOR", "Jamie", "8645551234", "(864) 555-1234", "2026-10-04", "10/04/2026", "10/4/2026", "October 4", ""]) {
    assert.equal(matchesFacilityPartySearch(party, query), true, query);
  }
  for (const query of ["unrelated", "2026-10-05", "864ABC5551234"]) assert.equal(matchesFacilityPartySearch(party, query), false, query);
});
