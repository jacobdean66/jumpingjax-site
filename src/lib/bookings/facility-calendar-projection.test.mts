import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { evaluateGoogleCalendarProjection } from "@/lib/google/calendar";

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("facility confirm treats only primary calendar failure as hard failure", () => {
  const text = source("../../app/api/facility/confirm/route.ts");
  assert.match(text, /evaluateGoogleCalendarProjection/);
  assert.match(text, /calendar_secondary_projection_failed/);
  assert.match(text, /claimCalendarRepairAttempt/);
  assert.match(text, /calendarRepairOnly/);
  // Decision emails must not run on calendar-only repair.
  const repairReturn = text.indexOf("if (calendarRepairOnly)");
  const decisionEmail = text.indexOf("decision_${action}");
  assert.ok(repairReturn > 0);
  assert.ok(decisionEmail > repairReturn);
});

test("facility calendar idempotency key is stable for a booking", () => {
  const bookingId = "1c2006dc-5b8c-4b18-bcb7-93a0609c5004";
  const first = createHash("sha256")
    .update(`facility-${bookingId}-calendar-v1`)
    .digest("hex");
  const second = createHash("sha256")
    .update(`facility-${bookingId}-calendar-v1`)
    .digest("hex");
  assert.equal(first, second);
  assert.equal(
    first,
    "ee3e91f3f06efa77cbb81bbc6d325ed0cc6041d17267cf9701798640b14e470d",
  );
});

test("retry after primary success is a no-op for hard-failure classification", () => {
  const first = evaluateGoogleCalendarProjection({
    primaryEventId: "event-1",
    secondaryEventId: null,
    primaryStatus: "created",
    secondaryStatus: "failed",
  });
  const retry = evaluateGoogleCalendarProjection({
    primaryEventId: "event-1",
    secondaryEventId: null,
    primaryStatus: "updated",
    secondaryStatus: "failed",
  });
  assert.equal(first.hardFailed, false);
  assert.equal(retry.hardFailed, false);
  assert.equal(first.primaryEventId, retry.primaryEventId);
});

test("database-id save failure path keeps known event ids for reconciliation", () => {
  const text = source("../../app/api/facility/confirm/route.ts");
  assert.match(
    text,
    /sync\.primaryEventId \?\? booking\.google_calendar_event_id/,
  );
  assert.match(
    text,
    /Never clear a known event id with null on a failed destination sync/,
  );
});

test("operational alert idempotency includes safe error class", () => {
  const text = source("./operational-alert.ts");
  assert.match(
    text,
    /alert-\$\{input\.kind\}-\$\{input\.bookingId\}-\$\{input\.step\}-\$\{input\.safeErrorClass\}-v1/,
  );
});

test("workflow outcome migration preserves operator_required across later successes", () => {
  const sql = source(
    "../../../supabase/migrations/20260718160000_fix_booking_workflow_outcome_operator_required.sql",
  );
  assert.match(sql, /operator_required = \(/);
  assert.match(sql, /calendar_status = 'failed'/);
  assert.match(sql, /when p_error_class is not null then p_error_class/);
  assert.match(sql, /else null/);
});

test("admin facility page exposes calendar-only retry without approval mutation copy", () => {
  const text = source("../../app/admin/facility/page.tsx");
  assert.match(text, /Retry calendar sync/);
  assert.match(text, /Primary calendar synced\. Backup calendar sync needs attention\./);
  assert.match(text, /Approval and customer email are unchanged/);
  assert.match(text, /calendarNeedsRepair/);
});

test("secondary-only failure keeps calendar workflow failed until backup succeeds", () => {
  const text = source("../../app/api/facility/confirm/route.ts");
  assert.match(text, /calendarStepIncomplete/);
  assert.match(text, /calendarStepIncomplete\s*\?\s*"failed"\s*:\s*"sent"/);
  assert.match(
    text,
    /Primary calendar synced\. Backup calendar sync needs attention\./,
  );
  assert.match(text, /bothDestinationsPresent/);
});

test("facility cancellation releases slots and exposes cancelled-view repair", () => {
  const route = source("../../app/api/facility/confirm/route.ts");
  const page = source("../../app/admin/facility/page.tsx");
  assert.match(route, /action !== "confirm" && action !== "reject" && action !== "cancel"/);
  assert.match(route, /updateQuery\.in\("status", \["pending", "confirmed"\]\)/);
  assert.match(route, /deleteGoogleCalendarDestinations/);
  assert.match(route, /allowCancel: true/);
  assert.match(route, /time slot is released/);
  assert.match(page, /status=cancelled/);
  assert.match(page, /FacilityCancellationButton/);
});

test("facility restore checks original slot before returning to pending", () => {
  const route = source("../../app/api/admin/facility/[id]/restore/route.ts");
  const migration = source(
    "../../../supabase/migrations/20260825120000_restore_cancelled_facility_booking_atomic.sql",
  );
  assert.match(route, /restore_cancelled_facility_booking_atomic/);
  assert.match(route, /Facility party restored to pending approval/);
  assert.match(migration, /f\.status in \('pending', 'confirmed'\)/);
  assert.match(migration, /'outcome', 'booking_conflict'/);
  assert.match(migration, /set status = 'pending'/);
});
