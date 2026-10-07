import { allocateTicketPayments, personIdentity, type DeskState } from "./desk";
import {
  buildDailyReport,
  type DailyReport,
  type VisitAttendeeSnapshot,
  type VisitSnapshot,
} from "./daily-report";
import {
  ageInCompletedYearsOnDate,
  childClassificationForAge,
} from "./pricing";

/** Existing ledger history and new tickets share a report; a person counts once. */
export function includeDeskReport(
  report: DailyReport,
  state: DeskState,
): DailyReport {
  const visits: VisitSnapshot[] = report.visits.map((visit) => ({
    id: visit.visitId,
    ...visit,
    visitDate: report.businessDayYmd,
    businessDayYmd: report.businessDayYmd,
    attendees: visit.attendees.map((attendee) => ({ ...attendee })),
    payments: [...visit.payments],
  }));
  const byIdentity = new Map<
    string,
    { visit: VisitSnapshot; attendee: VisitAttendeeSnapshot }
  >();
  for (const visit of visits) {
    if (visit.status === "voided") continue;
    for (const attendee of visit.attendees) {
      if (attendee.status !== "active" || !attendee.birthDate) continue;
      const key = personIdentity(
        attendee.originalFirstName || attendee.firstName || "",
        attendee.originalLastName || attendee.lastName || "",
        attendee.birthDate,
      );
      if (byIdentity.has(key)) {
        attendee.status = "removed";
        continue;
      }
      byIdentity.set(key, { visit, attendee });
    }
  }
  const mapped = new Map<
    string,
    { visit: VisitSnapshot; attendee: VisitAttendeeSnapshot }
  >();
  for (const person of state.people) {
    const line = state.tickets
      .flatMap((ticket) => ticket.items)
      .find((item) => item.attendance_id === person.id);
    let classification: VisitAttendeeSnapshot["classification"] =
      line?.classification ?? "admission_pending";
    let age: number | undefined;
    if (person.dob) {
      try {
        age = ageInCompletedYearsOnDate(person.dob, report.businessDayYmd);
      } catch {}
    }
    if (!line?.classification && person.role === "child" && age !== undefined)
      classification = childClassificationForAge(age);
    if (person.facility_party_booking_id && person.role !== "child")
      classification = "party_adult";
    let existing = byIdentity.get(person.identity_key);
    if (!existing) {
      const visit: VisitSnapshot = {
        id: `desk:${person.id}`,
        source: person.source,
        visitDate: report.businessDayYmd,
        businessDayYmd: report.businessDayYmd,
        status: "open",
        notes: "Front desk arrival — payment tracked on checkout ticket",
        createdAt: person.checked_in_at,
        attendees: [],
        payments: [],
      };
      const attendee: VisitAttendeeSnapshot = {
        id: `desk:${person.id}`,
        visitId: visit.id,
        source: person.source,
        participantRecordId:
          person.participant_id ?? person.legacy_participant_id ?? undefined,
        firstName: person.first_name,
        lastName: person.last_name,
        fullName: `${person.first_name} ${person.last_name}`,
        birthDate: person.dob ?? undefined,
        ageYearsOnVisit: age,
        classification,
        unitPriceCents: line?.amount_cents ?? 0,
        status: "active",
        checkedInAt: person.checked_in_at,
        facilityParty: person.facility_party_booking_id
          ? {
              bookingId: person.facility_party_booking_id,
              label: "Facility party",
            }
          : undefined,
      };
      visit.attendees.push(attendee);
      visits.push(visit);
      existing = { visit, attendee };
      byIdentity.set(person.identity_key, existing);
    }
    existing.attendee.deskAttendanceId = person.id;
    existing.attendee.checkoutTicketId = line?.ticket_id;
    existing.attendee.checkedOutAt = person.checked_out_at;
    existing.attendee.firstName = person.first_name;
    existing.attendee.lastName = person.last_name;
    existing.attendee.fullName = `${person.first_name} ${person.last_name}`;
    if (
      line?.classification &&
      !(person.facility_party_booking_id && person.role !== "child")
    )
      existing.attendee.classification = line.classification;
    mapped.set(person.id, existing);
  }
  for (const ticket of state.tickets) {
    for (const { payment, item, amount } of allocateTicketPayments(ticket)) {
      const target = mapped.get(item.attendance_id);
      if (!target) continue;
      target.visit.payments.push({
        id: `ticket:${payment.id}:${item.id}`,
        visitId: target.visit.id,
        attendeeId: target.attendee.id,
        entryType: payment.entry_type === "void" ? "void" : "charge",
        method: payment.method,
        amountCents: amount,
        relatedEntryId: payment.related_payment_id
          ? `ticket:${payment.related_payment_id}:${item.id}`
          : null,
        reason: payment.reason || `Checkout ticket ${ticket.id}`,
        createdByStaffId: payment.created_by_staff_id,
        createdAt: payment.created_at,
      });
    }
  }
  const merged = buildDailyReport(report.businessDayYmd, visits);
  merged.freePassAttendance = state.freePasses?.length ?? 0;
  merged.freePassTotalCents =
    state.freePasses?.reduce((sum, pass) => sum + pass.amount_cents, 0) ?? 0;
  merged.partyAdults = visits
    .flatMap((visit) => visit.attendees)
    .filter(
      (attendee) =>
        attendee.status === "active" &&
        attendee.classification === "party_adult",
    ).length;
  // A group receipt void is one operation, regardless of the number of allocated lines.
  merged.voids =
    report.voids +
    state.tickets
      .flatMap((ticket) => ticket.payments)
      .filter((payment) => payment.entry_type === "void").length;
  return merged;
}
