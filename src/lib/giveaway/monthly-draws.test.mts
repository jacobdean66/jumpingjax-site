import assert from "node:assert/strict";
import test from "node:test";
import { groupNominationsByDrawMonth } from "./monthly-draws.ts";
import { isGiveawayDrawMonth } from "./giveaway-campaigns.ts";
import type { NominationSubmission } from "./nomination-groups.ts";

function nomination(id: string, partyChoice: string): NominationSubmission {
  return {
    id, partyChoice, childName: "Test Child", birthMonth: 3, birthDay: 12,
    reason: "Fixture nomination", nominatorName: "Fixture Parent", createdAt: "2026-08-15T12:00:00Z",
  };
}

test("all twelve months remain available even with no nominations", () => {
  const months = groupNominationsByDrawMonth([]);
  assert.equal(months.length, 12);
  assert.equal(months[0].label, "January 2026");
  assert.equal(months[11].monthKey, "2026-12");
  assert.ok(months.every((month) => month.groups.length === 0 && month.submissionCount === 0));
});

test("campaign determines draw month, independent of birthday and submission date", () => {
  const months = groupNominationsByDrawMonth([nomination("oct", "october_halloween")]);
  assert.equal(months.find((month) => month.monthKey === "2026-10")?.groups.length, 1);
  assert.equal(months.find((month) => month.monthKey === "2026-03")?.groups.length, 0);
  assert.equal(months.find((month) => month.monthKey === "2026-08")?.groups.length, 0);
});

test("a child has one chance per month and only that month's nomination stories", () => {
  const months = groupNominationsByDrawMonth([
    nomination("sep-birthday", "september_birthday"),
    nomination("sep-school", "back_to_school"),
    nomination("oct-first", "october_halloween"),
    nomination("oct-second", "october_halloween"),
  ]);
  const september = months.find((month) => month.monthKey === "2026-09")!;
  const october = months.find((month) => month.monthKey === "2026-10")!;
  assert.equal(september.groups.length, 1);
  assert.equal(october.groups.length, 1);
  assert.equal(september.submissionCount, 2);
  assert.equal(october.submissionCount, 2);
  assert.deepEqual(september.groups[0].submissions.map((row) => row.id), ["sep-birthday", "sep-school"]);
  assert.deepEqual(october.groups[0].submissions.map((row) => row.id), ["oct-first", "oct-second"]);
  assert.equal(october.groups[0].partyChoice, "October Giveaway");
});

test("unrecognized campaigns fail visibly instead of silently omitting entries", () => {
  assert.throws(() => groupNominationsByDrawMonth([nomination("unknown", "unknown")]), /unrecognized campaign/);
});

test("only valid year-month keys are accepted for status updates", () => {
  for (const value of [undefined, null, "", "2026-00", "2026-13", "2026-1", "2026-10-01"]) {
    assert.equal(isGiveawayDrawMonth(value), false);
  }
  assert.equal(isGiveawayDrawMonth("2026-10"), true);
});
