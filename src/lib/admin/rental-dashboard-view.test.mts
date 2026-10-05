import assert from "node:assert/strict";
import test from "node:test";
import { rentalDashboardToday, resolveRentalDashboardDates, rentalDashboardQueryBounds, rentalMatchesDashboardDates } from "./rental-dashboard-view.ts";

test("current is the default and has no upper cutoff on future bookings", () => {
  const dates = resolveRentalDashboardDates({}, "2026-10-05");
  assert.equal(dates.view, "current");
  assert.equal(rentalDashboardQueryBounds(dates).to, undefined);
  assert.equal(rentalMatchesDashboardDates("2026-10-04", 1, dates), false);
  assert.equal(rentalMatchesDashboardDates("2026-10-05", 1, dates), true);
  assert.equal(rentalMatchesDashboardDates("2027-11-15", 1, dates), true);
});
test("multi-day rentals stay current through their final reserved date", () => {
  const current = resolveRentalDashboardDates({}, "2026-10-05");
  const past = resolveRentalDashboardDates({ view: "past" }, "2026-10-05");
  assert.equal(rentalMatchesDashboardDates("2026-10-03", 3, current), true);
  assert.equal(rentalMatchesDashboardDates("2026-10-03", 3, past), false);
  assert.equal(rentalMatchesDashboardDates("2026-10-02", 3, current), false);
  assert.equal(rentalMatchesDashboardDates("2026-10-02", 3, past), true);
});
test("past has no default starting cutoff and orders newest first", () => {
  const dates = resolveRentalDashboardDates({ view: "past" }, "2026-10-05");
  assert.deepEqual(rentalDashboardQueryBounds(dates), { from: undefined, to: "2026-10-04", ascending: false });
  assert.equal(rentalMatchesDashboardDates("2024-01-01", 1, dates), true);
  assert.equal(rentalMatchesDashboardDates("2026-10-05", 1, dates), false);
});
test("date filters apply within the selected view and old historical links still work", () => {
  const dates = resolveRentalDashboardDates({ view: "current", from: "2026-10-09", to: "2026-10-11" }, "2026-10-05");
  assert.equal(rentalMatchesDashboardDates("2026-10-08", 3, dates), true);
  assert.equal(rentalMatchesDashboardDates("2026-10-08", 1, dates), false);
  assert.equal(rentalMatchesDashboardDates("2026-10-12", 1, dates), false);
  assert.equal(resolveRentalDashboardDates({ from: "2026-09-01", to: "2026-09-30" }, "2026-10-05").view, "past");
  assert.equal(resolveRentalDashboardDates({ from: "2026-02-31" }, "2026-10-05").from, null);
});
test("today follows Eastern midnight, including daylight-saving boundaries", () => {
  assert.equal(rentalDashboardToday(new Date("2026-10-06T03:59:59Z")), "2026-10-05");
  assert.equal(rentalDashboardToday(new Date("2026-10-06T04:00:00Z")), "2026-10-06");
  assert.equal(rentalDashboardToday(new Date("2026-11-02T04:59:59Z")), "2026-11-01");
});
test("undated legacy rows do not break or get misclassified in date views", () => {
  for (const view of ["current", "past"] as const) {
    assert.equal(rentalMatchesDashboardDates(null, 1, resolveRentalDashboardDates({ view }, "2026-10-05")), false);
    assert.equal(rentalMatchesDashboardDates("invalid", 1, resolveRentalDashboardDates({ view }, "2026-10-05")), false);
  }
});
