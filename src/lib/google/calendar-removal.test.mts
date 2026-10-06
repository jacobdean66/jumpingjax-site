import assert from "node:assert/strict";
import test from "node:test";
import { removeCalendarEvent, removalRetryDelay } from "./calendar-removal.ts";

function api(deleteStatus?: number, accessStatus?: number) {
  return {
    events: { delete: async () => { if (deleteStatus) throw { response: { status: deleteStatus } }; } },
    calendars: { get: async () => { if (accessStatus) throw { response: { status: accessStatus } }; } },
  };
}
test("successful deletion and an already deleted event complete removal", async () => {
  assert.equal(await removeCalendarEvent(api(), "calendar", "event"), "removed");
  assert.equal(await removeCalendarEvent(api(410), "calendar", "event"), "removed");
});
test("404 only completes when calendar access is verified", async () => {
  assert.equal(await removeCalendarEvent(api(404), "calendar", "event"), "removed");
  assert.equal(await removeCalendarEvent(api(404, 404), "calendar", "event"), "access_required");
  assert.equal(await removeCalendarEvent(api(404, 503), "calendar", "event"), "retry");
});
test("temporary errors retry and lost credentials need attention", async () => {
  assert.equal(await removeCalendarEvent(api(503), "calendar", "event"), "retry");
  assert.equal(await removeCalendarEvent(api(429), "calendar", "event"), "retry");
  assert.equal(await removeCalendarEvent(api(401), "calendar", "event"), "access_required");
  assert.equal(removalRetryDelay(1), 30);
  assert.equal(removalRetryDelay(4), 240);
  assert.equal(removalRetryDelay(20), 3600);
});
