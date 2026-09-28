import type { DailyReport, VisitAttendeeSnapshot } from "./daily-report";
import { ageInCompletedYearsOnDate, childClassificationForAge } from "./pricing";

export type FacilityAttendanceGuest = {
  id: string;
  bookingId: string;
  partyLabel: string;
  partyDate: string;
  participantId: string;
  firstName: string;
  lastName: string;
  dob: string;
  role: string;
  checkedInAt: string | null;
  waiverDetails?: VisitAttendeeSnapshot["waiverDetails"];
};

function nameKey(first: string | undefined, last: string | undefined, dob: string | undefined) {
  if (!first?.trim() || !last?.trim() || !dob) return null;
  return `${first} ${last}`.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase() + `|${dob}`;
}

export function includeFacilityAttendance(report: DailyReport, guests: FacilityAttendanceGuest[]): DailyReport {
  const present = report.visits.filter((visit) => visit.status !== "voided")
    .flatMap((visit) => visit.attendees.filter((attendee) => attendee.status === "active"));
  const nativeIds = new Set(present.filter((attendee) => attendee.source !== "legacy_smartwaiver")
    .map((attendee) => attendee.participantRecordId).filter(Boolean));
  const identities = new Set(present.flatMap((attendee) => [
    nameKey(attendee.firstName, attendee.lastName, attendee.birthDate),
    nameKey(attendee.originalFirstName, attendee.originalLastName, attendee.birthDate),
  ]).filter(Boolean));
  const facilityAttendance: VisitAttendeeSnapshot[] = [];
  let childrenAge2OrYounger = report.childrenAge2OrYounger;
  let childrenAge3OrOlder = report.childrenAge3OrOlder;
  let partyAdults = 0;
  for (const guest of guests) {
    if (!guest.checkedInAt || guest.partyDate !== report.businessDayYmd) continue;
    const identity = nameKey(guest.firstName, guest.lastName, guest.dob);
    if (nativeIds.has(guest.participantId) || (identity && identities.has(identity))) continue;
    nativeIds.add(guest.participantId);
    if (identity) identities.add(identity);
    const age = ageInCompletedYearsOnDate(guest.dob, report.businessDayYmd);
    const classification = guest.role === "child" ? childClassificationForAge(age) : "party_adult";
    if (classification === "child_2_or_under") childrenAge2OrYounger += 1;
    if (classification === "child_3_plus") childrenAge3OrOlder += 1;
    if (classification === "party_adult") partyAdults += 1;
    facilityAttendance.push({
      id: `facility-guest:${guest.id}`,
      visitId: `facility-party:${guest.bookingId}`,
      participantRecordId: guest.participantId,
      source: "native",
      firstName: guest.firstName,
      lastName: guest.lastName,
      fullName: `${guest.firstName} ${guest.lastName}`.trim(),
      birthDate: guest.dob,
      ageYearsOnVisit: age,
      classification,
      unitPriceCents: 0,
      status: "active",
      checkedInAt: guest.checkedInAt,
      facilityParty: { bookingId: guest.bookingId, label: guest.partyLabel },
      waiverDetails: guest.waiverDetails,
    });
  }
  return {
    ...report,
    facilityAttendance,
    totalAttendance: report.totalAttendance + facilityAttendance.length,
    childrenAge2OrYounger,
    childrenAge3OrOlder,
    partyAdults,
  };
}
