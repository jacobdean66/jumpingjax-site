import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("composite staging route is owner-only, guarded, live-conflict-aware, and side-effect bounded", async () => {
  const source = await readFile(
    new URL("../../app/api/admin/agents/composite-booking-stage/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /verifyAdminOwnerAccess/);
  assert.match(source, /validateOwnerPost/);
  assert.match(source, /parseCompositeBookingRequest/);
  assert.match(source, /loadLiveCompositeAvailabilityBlocks/);
  assert.match(source, /buildStagedCompositeBookingIntent/);
  assert.match(source, /persistCompositeBookingIntent/);
  assert.match(source, /approvalRequired: true/);
  assert.match(source, /bookingWrites: 0/);
  assert.match(source, /externalCalendarWrites: 0/);
  assert.match(source, /customerMessages: 0/);
  assert.match(source, /paymentWrites: 0/);
  assert.doesNotMatch(source, /insertPendingBooking|create_rental_booking|create_facility_booking|syncGoogleCalendar|sendEmail|resend|stripe|openai|anthropic/i);
});

