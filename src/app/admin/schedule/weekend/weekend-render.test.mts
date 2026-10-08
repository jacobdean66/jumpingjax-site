import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScheduleCalendar } from "../ScheduleCalendar";
import type { CalendarEvent } from "@/lib/admin/schedule";

const base = { weekend: true, days: [{ ymd: "2026-10-09", dayName: "Fri", label: "Oct 9" }, { ymd: "2026-10-10", dayName: "Sat", label: "Oct 10" }, { ymd: "2026-10-11", dayName: "Sun", label: "Oct 11" }], error: null, view: "week" as const, heading: "Weekend rentals: 2026-10-09 to 2026-10-11", rangeLabel: "2026-10-09 to 2026-10-11", previousHref: "/previous", nextHref: "/next", dayHref: "/day", weekHref: "/week", monthHref: "/month" };
function event(id: string, type: CalendarEvent["type"], status = "approved"): CalendarEvent {
  return { id, bookingId: id, type, status, date: "2026-10-09", sortTime: "10:00", displayTime: "10:00 AM", title: id, customer: id, phone: null, location: null, room: null, detailHref: "/admin/rentals", products: [], details: [] };
}
test("weekend screen and print agenda use the same rental-only scope", () => {
  const html = renderToStaticMarkup(createElement(ScheduleCalendar, { ...base, events: [event("RENTAL_INCLUDED", "rental"), event("FOAM_INCLUDED", "foam-party"), event("PARTY_EXCLUDED", "private-party", "confirmed"), event("CANCELLED_EXCLUDED", "rental", "cancelled")] }));
  assert.match(html, /Print weekend schedule/);
  assert.match(html, /RENTAL_INCLUDED/);
  assert.match(html, /FOAM_INCLUDED/);
  assert.doesNotMatch(html, /PARTY_EXCLUDED|CANCELLED_EXCLUDED/);
  assert.match(html, /Date range: Weekend rentals: 2026-10-09 to 2026-10-11/);
  assert.doesNotMatch(html, /Email this schedule|Print \/ email specific dates/);
});
test("failed weekend load disables printing and cannot produce a misleading valid agenda", () => {
  const html = renderToStaticMarkup(createElement(ScheduleCalendar, { ...base, events: [], error: "Could not load" }));
  assert.match(html, /disabled=""/);
  assert.match(html, /This is not a valid schedule/);
  assert.doesNotMatch(html, /Total visible bookings/);
});
