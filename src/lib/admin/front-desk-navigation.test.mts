import assert from "node:assert/strict";
import test from "node:test";
import { adminNavigation, isAdminNavActive } from "./navigation";
import { rentalWeekend, validCalendarDate, WEEKEND_RENTAL_FILTERS } from "./weekend";
import { filterScheduleEvents, type CalendarEvent } from "./schedule";
import { agentNavigationSummary, UNKNOWN_AGENT_SUMMARY } from "../agent-manager/navigation-summary";

test("weekend stays Friday-Sunday and advances after Sunday in the business timezone", () => {
  for (const day of ["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]) assert.deepEqual(rentalWeekend(day).dates, ["2026-10-09", "2026-10-10", "2026-10-11"]);
  assert.equal(rentalWeekend("2026-10-12").from, "2026-10-16");
  assert.equal(rentalWeekend(undefined, new Date("2026-10-12T03:59:59Z")).from, "2026-10-09");
  assert.equal(rentalWeekend(undefined, new Date("2026-10-12T04:00:00Z")).from, "2026-10-16");
});

test("weekends survive DST, year rollover and invalid date input", () => {
  assert.deepEqual(rentalWeekend("2026-03-08").dates, ["2026-03-06", "2026-03-07", "2026-03-08"]);
  assert.deepEqual(rentalWeekend("2026-11-01").dates, ["2026-10-30", "2026-10-31", "2026-11-01"]);
  assert.deepEqual(rentalWeekend("2026-12-31").dates, ["2027-01-01", "2027-01-02", "2027-01-03"]);
  assert.equal(validCalendarDate("2026-02-30"), false);
  assert.equal(validCalendarDate("2026-2-3"), false);
  assert.equal(validCalendarDate("2028-02-29"), true);
  assert.equal(rentalWeekend("bad", new Date("2026-10-08T12:00:00Z")).from, "2026-10-09");
});

test("weekend scope includes foam rentals and excludes facility and cancelled bookings", () => {
  const events = ([
    ["rental", "approved"], ["foam-party", "approved"], ["rental", "pending"],
    ["rental", "cancelled"], ["public-party", "confirmed"], ["private-party", "confirmed"],
  ] as const).map(([type, status], index) => ({ id: String(index), type, status }) as CalendarEvent);
  assert.deepEqual(filterScheduleEvents(events, WEEKEND_RENTAL_FILTERS, false).map(event => event.id), ["0", "1", "2"]);
});

test("front-desk tasks remain available without granting owner agent or security access", () => {
  const employee = adminNavigation("employee");
  assert.deepEqual(employee.primary.map(item => item.id), ["home", "open-play", "deposits", "invitations", "weekend"]);
  const employeeHrefs = [...employee.primary, ...employee.groups.flatMap(group => group.items)].map(item => item.href);
  for (const ownerHref of ["/admin/agents#supervisor", "/admin/security", "/admin/staff", "/admin/site-settings", "/admin/ai-ads", "/admin/deliveries", "/admin/inventory", "/admin/reports/tax-export"]) assert.ok(!employeeHrefs.includes(ownerHref));
  assert.ok(employeeHrefs.includes("/admin/payments"));
  assert.equal(adminNavigation("owner").primary.at(-1)?.label, "Permanent Agent");
});

test("invitation and weekend detail paths select their correct destinations", () => {
  const items = adminNavigation("owner").primary;
  assert.ok(isAdminNavActive(items.find(item => item.id === "invitations")!, "/admin/facility/abc/invitations"));
  assert.ok(isAdminNavActive(items.find(item => item.id === "weekend")!, "/admin/schedule/weekend"));
  const schedule = adminNavigation("owner").groups[0].items.find(item => item.id === "schedule")!;
  assert.equal(isAdminNavActive(schedule, "/admin/schedule/weekend"), false);
});

test("agent summary keeps unknown checks unknown and only exposes validated counts", () => {
  assert.deepEqual(agentNavigationSummary(null), UNKNOWN_AGENT_SUMMARY);
  assert.deepEqual(agentNavigationSummary({ generatedAt: "not a date", issues: [] }), UNKNOWN_AGENT_SUMMARY);
  const result = agentNavigationSummary({ generatedAt: "2026-10-08T14:00:00Z", issues: [{ severity: "warning", summary: "private details" }, { severity: "critical" }], agents: { approvalsWaiting: 2 }, services: [{ state: "connected" }, { state: "unavailable" }], credential: "never expose", customer: "never expose" });
  assert.deepEqual(result, { checkedAt: "2026-10-08T14:00:00Z", critical: 1, warnings: 1, approvals: 2, coverage: { checked: 1, total: 2 } });
  assert.equal(agentNavigationSummary({ generatedAt: "2026-10-08T14:00:00Z" }).critical, null);
});
