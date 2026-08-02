import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("availability, schedule, Route Planner, and Driver data share lifecycle constants", () => {
  assert.match(
    source("../../app/api/unavailable-dates/route.ts"),
    /RENTAL_INVENTORY_BLOCKING_STATUSES/,
  );
  assert.match(source("./schedule.ts"), /isCancelledStatus/);
  assert.match(source("./deliveries.ts"), /RENTAL_OPERATIONAL_STATUSES/);
  assert.match(
    source("../../app/api/admin/deliveries/route.ts"),
    /RENTAL_OPERATIONAL_STATUSES/,
  );
});

test("cancellation preserves Calendar ids and surfaces safe deletion failure", () => {
  const route = source("../../app/api/rentals/confirm/route.ts");
  assert.doesNotMatch(route, /clearedCalendarFields/);
  assert.doesNotMatch(route, /google_calendar_event_id\s*=\s*null/);
  assert.match(route, /calendarSyncFailed/);
  assert.match(route, /calendar_projection_failed/);
  assert.match(route, /retry cancellation from the Cancelled view/);
});

test("admin cancellation confirmation contains required booking context", () => {
  const client = source(
    "../../app/admin/rentals/RentalCancellationButton.tsx",
  );
  for (const field of [
    "Customer",
    "Rental dates",
    "Current status",
    "Affected items",
  ]) {
    assert.match(client, new RegExp(field));
  }
  assert.match(client, /Confirm cancellation/);
  assert.match(client, /min-h-12/);
  assert.match(client, /max-h-\[calc\(100dvh/);
});

test("existing approval and rejection transitions remain intact", () => {
  const route = source("../../app/api/rentals/confirm/route.ts");
  assert.match(route, /action === "reject" \? "rejected"/);
  assert.match(route, /: "approved"/);
  assert.match(route, /updateQuery\.eq\("status", "pending"\)/);
});

test("Cancelled tab exposes original details and restore action", () => {
  const page = source("../../app/admin/rentals/page.tsx");
  assert.match(page, /status=cancelled/);
  assert.match(page, /RentalRestoreButton/);
  for (const label of ["Address", "Subtotal", "Total"]) {
    assert.match(page, new RegExp(`label="${label}"`));
  }
});

test("route assignment writes are constrained by the shared operational status policy", () => {
  const route = source("../../app/api/admin/deliveries/route.ts");
  assert.match(route, /RENTAL_OPERATIONAL_STATUSES/);
  assert.match(route, /\.in\("status", RENTAL_OPERATIONAL_STATUSES\)/);
});
