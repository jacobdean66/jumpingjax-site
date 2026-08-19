import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("unauthorized facility edit and cancel require admin authentication", () => {
  const edit = source("../../app/api/admin/facility/[id]/route.ts");
  const cancel = source("../../app/api/admin/facility/[id]/cancel/route.ts");
  for (const route of [edit, cancel]) {
    assert.match(route, /verifyAdminAccess/);
    assert.match(route, /Admin authentication required/);
    assert.doesNotMatch(route, /createServiceRoleClient\(\)[\s\S]*verifyAdminAccess/);
  }
  assert.match(edit, /status: auth\.reason === "missing_config" \? 503 : 401/);
  assert.match(cancel, /status: auth\.reason === "missing_config" \? 503 : 401/);
});

test("facility dashboard shows Edit and Cancel only through the shared upcoming mutation helper", () => {
  const page = source("../../app/admin/facility/page.tsx");
  assert.match(page, /facilityBookingCanMutate/);
  assert.match(page, /FacilityEditButton/);
  assert.match(page, /FacilityCancelButton/);
  assert.match(page, /status=cancelled/);
});

test("edit form is pre-populated and cancel confirmation names the party", () => {
  const edit = source("../../app/admin/facility/FacilityEditButton.tsx");
  const cancel = source("../../app/admin/facility/FacilityCancelButton.tsx");
  assert.match(edit, /defaultValue=\{clock\?\.date/);
  assert.match(edit, /name="bookingDate"/);
  assert.match(edit, /name="bookingStartTime"/);
  assert.match(edit, /defaultValue=\{booking\.customerName\}/);
  assert.match(edit, /isWorking \? "Saving\.\.\."/);
  assert.match(edit, /max-h-\[calc\(100dvh/);
  assert.match(edit, /router\.refresh\(\)/);
  assert.match(cancel, /Cancel this facility party\?/);
  assert.match(cancel, /Date and time/);
  assert.match(cancel, /readableDate/);
  assert.match(cancel, /Confirm cancellation/);
  assert.match(cancel, /retryCalendarOnly/);
  assert.match(cancel, /"Cancelling\.\.\."|"Retrying\.\.\."/);
  assert.match(cancel, /Retry Calendar removal/);
  assert.match(cancel, /already cancelled/);
  assert.match(cancel, /router\.refresh\(\)/);
  assert.match(cancel, /min-h-12/);
  assert.match(cancel, /max-h-\[calc\(100dvh/);
});

test("cancelled facility bookings can retry calendar removal from the dashboard", () => {
  const page = source("../../app/admin/facility/page.tsx");
  const operations = source("../admin/operations.ts");
  const cancelRoute = source("../../app/api/admin/facility/[id]/cancel/route.ts");
  assert.match(page, /canRetryCancelledCalendarRemoval/);
  assert.match(page, /retryCalendarOnly/);
  assert.match(operations, /google_calendar_secondary_event_id/);
  assert.match(operations, /status === "cancelled"/);
  assert.match(cancelRoute, /already cancelled and Calendar removal was retried successfully/);
});

test("edit and cancel mutate through atomic RPCs then verify the public availability source", () => {
  const edit = source("../../app/api/admin/facility/[id]/route.ts");
  const cancel = source("../../app/api/admin/facility/[id]/cancel/route.ts");
  const unavailable = source("../../app/api/facility/unavailable/route.ts");
  assert.match(edit, /reschedule_facility_booking_atomic/);
  assert.match(edit, /loadPublicFacilityAvailabilityRows/);
  assert.match(edit, /verifyFacilityReschedule/);
  assert.match(edit, /planFacilityReschedule/);
  assert.match(cancel, /cancel_facility_booking_atomic/);
  assert.match(cancel, /loadPublicFacilityAvailabilityRows/);
  assert.match(cancel, /verifyFacilityCancellation/);
  assert.match(cancel, /status = 'cancelled'|already_cancelled/);
  assert.doesNotMatch(cancel, /\.delete\(/);
  assert.match(unavailable, /loadPublicFacilityAvailabilityRows/);
});

test("atomic migration locks dates, excludes the edited booking, and soft-cancels", () => {
  const sql = source(
    "../../../supabase/migrations/20260819180000_facility_booking_reschedule_cancel_atomic.sql",
  );
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /f\.id <> v_booking\.id/);
  assert.match(sql, /status in \('pending', 'confirmed'\)/);
  assert.match(sql, /for update/);
  assert.match(sql, /set status = 'cancelled'/);
  assert.match(sql, /already_cancelled/);
  assert.match(sql, /hashtextextended\('facility:'/);
  assert.doesNotMatch(sql, /delete from public\.facility_bookings/);
});

test("customer booking and public availability share the blocking-status constant", () => {
  const book = source("../../app/api/facility/book/route.ts");
  assert.match(book, /FACILITY_AVAILABILITY_BLOCKING_STATUSES/);
  assert.match(
    source("../facility-parties/availability-source.ts"),
    /"pending",\s*"confirmed"/,
  );
});
