import assert from "node:assert/strict";
import test from "node:test";
import { buildDailyReport, type VisitSnapshot } from "./daily-report";
import { includeFacilityAttendance, type FacilityAttendanceGuest } from "./facility-attendance";
import { isEmptyReport } from "./daily-report-client";
import { isValidDailyReportForCorrections } from "./corrections-client";

const day = "2026-09-27";
const guest: FacilityAttendanceGuest = {
  id: "guest", bookingId: "party", partyLabel: "Birthday party", partyDate: day,
  participantId: "native-participant", firstName: "Alex", lastName: "Guest",
  dob: "1990-01-01", role: "adult_signer", checkedInAt: "2026-09-27T17:00:00Z",
};
const visit: VisitSnapshot = {
  id: "visit", source: "legacy_smartwaiver", businessDayYmd: day, visitDate: day,
  createdAt: "2026-09-27T16:00:00Z", status: "open", notes: null,
  attendees: [{ id: "attendee", visitId: "visit", participantRecordId: "legacy-person", source: "legacy_smartwaiver", firstName: "Alex", lastName: "Guest", birthDate: "1990-01-01", classification: "playing_adult", unitPriceCents: 700, status: "active" }],
  payments: [{ id: "charge", visitId: "visit", attendeeId: "attendee", entryType: "charge", method: "cash", amountCents: 700, relatedEntryId: null, reason: null, createdByStaffId: "staff", createdAt: "2026-09-27T16:00:00Z" }],
};

test("party-only attendance includes adults and children without charges or editable ledger visits", () => {
  const report = includeFacilityAttendance(buildDailyReport(day, []), [guest, { ...guest, id: "child", participantId: "child", firstName: "Sam", dob: "2024-01-01", role: "child" }]);
  assert.equal(report.totalAttendance, 2);
  assert.equal(report.partyAdults, 1);
  assert.equal(report.childrenAge2OrYounger, 1);
  assert.equal(report.paidAttendance, 0);
  assert.equal(report.combinedTotalCents, 0);
  assert.equal(report.facilityAttendance?.[0].unitPriceCents, 0);
  assert.equal(report.facilityAttendance?.[0].classification, "party_adult");
  assert.equal(report.visits.length, 0);
  assert.equal(isEmptyReport(report), false);
  assert.equal(isValidDailyReportForCorrections(report), true);
});

test("native party guests already checked in through legacy waivers count once and retain payments", () => {
  const original = buildDailyReport(day, [visit]);
  const report = includeFacilityAttendance(original, [guest]);
  assert.equal(report.totalAttendance, 1);
  assert.equal(report.facilityAttendance?.length, 0);
  assert.equal(report.paidAttendance, 1);
  assert.equal(report.cashTotalCents, 700);
  assert.deepEqual(report.visits, original.visits);
});

test("participant identity wins over name changes and repeated party marks do not double-count", () => {
  const nativeVisit: VisitSnapshot = { ...visit, source: "native", attendees: [{ ...visit.attendees[0], source: "native", participantRecordId: guest.participantId, firstName: "Corrected" }] };
  assert.equal(includeFacilityAttendance(buildDailyReport(day, [nativeVisit]), [guest]).totalAttendance, 1);
  assert.equal(includeFacilityAttendance(buildDailyReport(day, []), [guest, { ...guest, id: "other-party-guest", bookingId: "other-party" }]).totalAttendance, 1);
});

test("attendance uses the party date even when Here was marked early, and excludes unchecked guests", () => {
  const report = includeFacilityAttendance(buildDailyReport(day, []), [
    { ...guest, checkedInAt: null },
    { ...guest, partyDate: "2026-09-26" },
    { ...guest, partyDate: "2026-09-28" },
    { ...guest, checkedInAt: "2026-09-22T17:00:00Z" },
  ]);
  assert.equal(report.totalAttendance, 1);
  assert.equal(report.facilityAttendance?.[0].checkedInAt, "2026-09-22T17:00:00Z");
});

test("removed and voided admissions do not hide an independently present party guest", () => {
  const removed = { ...visit, attendees: [{ ...visit.attendees[0], status: "removed" as const }] };
  assert.equal(includeFacilityAttendance(buildDailyReport(day, [removed]), [guest]).totalAttendance, 1);
  assert.equal(includeFacilityAttendance(buildDailyReport(day, [{ ...visit, status: "voided" }]), [guest]).totalAttendance, 1);
});

test("matching names with different birthdays remain distinct", () => {
  const report = includeFacilityAttendance(buildDailyReport(day, [visit]), [{ ...guest, dob: "1991-01-01" }]);
  assert.equal(report.totalAttendance, 2);
});
