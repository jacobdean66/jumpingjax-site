import assert from "node:assert/strict";
import test from "node:test";
import { buildDailyReport } from "./daily-report";
import { includeDeskReport } from "./desk-report";
import { allocateTicketPayments, dollarsToCents, personIdentity, ticketTotals, type DeskState } from "./desk";

function fixture(): DeskState {
  const names = ["Casey QA", "Jamie Quinn", "Riley Parker", "Morgan Lee", "Avery White", "Cameron Green"];
  const people = names.map((name, index) => {
    const [first_name, last_name] = name.split(" "); const dob = index === 5 ? "2024-01-01" : "2018-01-01";
    return { id: `person-${index}`, business_day_ymd: "2026-10-06", source: index < 3 ? "native" as const : "legacy_smartwaiver" as const,
      participant_id: index < 3 ? `participant-${index}` : null, legacy_participant_id: index < 3 ? null : `participant-${index}`,
      identity_key: personIdentity(first_name, last_name, dob), first_name, last_name, dob, role: "child" as const,
      waiver_expires_on: "2029-10-06", checked_in_at: "2026-10-06T18:00:00Z", checked_out_at: null, created_by_staff_id: "staff" };
  });
  return { people, tickets: [{ id: "ticket", business_day_ymd: "2026-10-06", payer_name: "One payer", created_at: "2026-10-06T18:00:00Z", created_by_staff_id: "staff",
    items: people.map((person, index) => ({ id: `line-${index}`, ticket_id: "ticket", attendance_id: person.id,
      classification: index === 5 ? "child_2_or_under" as const : "child_3_plus" as const, amount_cents: index === 5 ? 700 : 1000, credited_cents: 0, reason: "" })), payments: [] }] };
}
const empty = () => buildDailyReport("2026-10-06", []);

test("money entry preserves exact cents and rejects fractional cents", () => {
  assert.equal(dollarsToCents("10.01"), 1001); assert.equal(dollarsToCents("7"), 700);
  assert.equal(dollarsToCents("1.005"), null); assert.equal(dollarsToCents("-1"), null);
  assert.equal(dollarsToCents("NaN"), null);
});

test("six arrivals count before payment, across both waiver sources", () => {
  const state = fixture(), report = includeDeskReport(empty(), state);
  assert.equal(report.totalAttendance, 6); assert.equal(report.paidAttendance, 0); assert.equal(report.combinedTotalCents, 0);
  assert.equal(ticketTotals(state.tickets[0]).due, 5700);
});

test("birthday party guests count once with no admission revenue or free passes", () => {
  const state: DeskState = fixture();
  for (const person of state.people) person.facility_party_booking_id = "birthday-party";
  state.people[0].role = "adult_signer";
  state.tickets[0].items[0].classification = "playing_adult";
  for (const item of state.tickets[0].items) item.credited_cents = item.amount_cents!;
  const report = includeDeskReport(empty(), state);
  assert.equal(report.totalAttendance, 6);
  assert.equal(report.paidAttendance, 0);
  assert.equal(report.partyAdults, 1);
  assert.equal(report.freePassAttendance, 0);
  assert.equal(report.combinedTotalCents, 0);
  assert.equal(ticketTotals(state.tickets[0]).due, 0);
  assert.ok(report.visits.flatMap(visit => visit.attendees).every(person => person.facilityParty?.bookingId === "birthday-party"));
  assert.equal(includeDeskReport(report, state).totalAttendance, 6);
});
test("one shared receipt is allocated once, and split payments reconcile", () => {
  const state = fixture(), ticket = state.tickets[0];
  ticket.payments = [{ id: "cash", ticket_id: "ticket", method: "cash", amount_cents: 2000, reference: "cash receipt", created_at: "2026-10-06T18:05:00Z", created_by_staff_id: "staff" },
    { id: "card", ticket_id: "ticket", method: "card", amount_cents: 3700, reference: "card receipt", created_at: "2026-10-06T18:06:00Z", created_by_staff_id: "staff" }];
  assert.equal(allocateTicketPayments(ticket).reduce((sum, row) => sum + row.amount, 0), 5700);
  const report = includeDeskReport(empty(), state);
  assert.equal(report.totalAttendance, 6); assert.equal(report.paidAttendance, 6);
  assert.equal(report.cashTotalCents, 2000); assert.equal(report.cardTotalCents, 3700); assert.equal(report.combinedTotalCents, 5700);
  assert.equal(ticketTotals(ticket).due, 0);
});
test("previous attendance/payment is counted once and credited on a new group ticket", () => {
  const state = fixture(), person = state.people[0], ticket = state.tickets[0];
  ticket.items[0].credited_cents = 1000;
  ticket.payments = [{ id: "group", ticket_id: "ticket", method: "card", amount_cents: 4700, reference: "group receipt", created_at: "2026-10-06T18:05:00Z", created_by_staff_id: "staff" }];
  const before = buildDailyReport("2026-10-06", [{ id: "old-visit", businessDayYmd: "2026-10-06", visitDate: "2026-10-06", status: "open", notes: null, createdAt: person.checked_in_at,
    attendees: [{ id: "old-attendee", visitId: "old-visit", firstName: person.first_name, lastName: person.last_name, birthDate: person.dob!, classification: "child_3_plus", unitPriceCents: 1000, status: "active" }],
    payments: [{ id: "old-payment", visitId: "old-visit", attendeeId: "old-attendee", entryType: "charge", method: "cash", amountCents: 1000, relatedEntryId: null, reason: null, createdByStaffId: "staff", createdAt: person.checked_in_at }] }]);
  const report = includeDeskReport(before, state);
  assert.equal(report.totalAttendance, 6); assert.equal(report.paidAttendance, 6); assert.equal(report.combinedTotalCents, 5700);
  assert.equal(report.cashTotalCents, 1000); assert.equal(report.cardTotalCents, 4700); assert.equal(ticketTotals(ticket).due, 0);
});
test("departure changes presence without erasing today's attendance or receipts", () => {
  const state = fixture(); state.people[0].checked_out_at = "2026-10-06T19:00:00Z";
  const report = includeDeskReport(empty(), state);
  assert.equal(report.totalAttendance, 6);
  assert.equal(report.visits.flatMap(visit => visit.attendees).filter(person => !person.checkedOutAt).length, 5);
});
test("unknown adult admission blocks ticket payment readiness but not attendance", () => {
  const state = fixture(); state.people[0].role = "adult_signer";
  state.tickets[0].items[0].classification = null; state.tickets[0].items[0].amount_cents = null;
  assert.equal(ticketTotals(state.tickets[0]).ready, false);
  const report = includeDeskReport(empty(), state);
  assert.equal(report.totalAttendance, 6); assert.equal(report.visits[0].attendees[0].classification, "admission_pending");
});
test("voiding a group receipt preserves attendance and reverses the ledger once", () => {
  const state = fixture(), ticket = state.tickets[0];
  const original = { id: "receipt", ticket_id: "ticket", method: "card" as const, amount_cents: 5700, reference: "group", created_at: "2026-10-06T18:05:00Z", created_by_staff_id: "staff" };
  ticket.payments = [original, { ...original, id: "void", amount_cents: -5700, entry_type: "void", related_payment_id: original.id, reason: "Mistaken receipt", created_at: "2026-10-06T18:06:00Z" }];
  const report = includeDeskReport(empty(), state);
  assert.equal(report.totalAttendance, 6); assert.equal(report.paidAttendance, 0);
  assert.equal(report.combinedTotalCents, 0); assert.equal(report.voids, 1);
  assert.equal(ticketTotals(ticket).due, 5700);
});

test("correction retains other guests' money and replaces the older ledger once", () => {
  const state = fixture(), ticket = state.tickets[0], person = state.people[0];
  person.corrected_at = "2026-10-06T20:00:00Z";
  ticket.items[0].amount_cents = 700;
  const original = { id: "old-group", ticket_id: "ticket", method: "card" as const, amount_cents: 5700, reference: "", created_at: person.checked_in_at, created_by_staff_id: "staff" };
  ticket.payments = [original, { ...original, id: "void-group", amount_cents: -5700, entry_type: "void", related_payment_id: original.id },
    ...ticket.items.map((item,index) => ({ ...original, id: `replacement-${index}`, item_id: item.id, method: index===0 ? "cash" as const : "card" as const, amount_cents: item.amount_cents! }))];
  const older = buildDailyReport("2026-10-06", [{ id:"old-visit",visitDate:"2026-10-06",businessDayYmd:"2026-10-06",status:"open",notes:null,createdAt:person.checked_in_at,
    attendees:[{id:"old-attendee",visitId:"old-visit",firstName:person.first_name,lastName:person.last_name,birthDate:person.dob!,classification:"child_3_plus",unitPriceCents:1000,status:"active"}],
    payments:[{id:"old-payment",visitId:"old-visit",attendeeId:"old-attendee",entryType:"charge",method:"cash",amountCents:1000,relatedEntryId:null,reason:null,createdByStaffId:"staff",createdAt:person.checked_in_at}] }]);
  const report = includeDeskReport(older,state);
  assert.equal(report.totalAttendance,6); assert.equal(report.cashTotalCents,700); assert.equal(report.cardTotalCents,4700);
  assert.equal(report.combinedTotalCents,5400); assert.equal(ticketTotals(ticket).due,0);
  assert.equal(allocateTicketPayments(ticket).find(row=>row.item.attendance_id===person.id)?.amount,700);
});

test("deleted check-in removes old and current admission money without losing group payments", () => {
  const state = fixture(), person = state.people.shift()!, ticket = state.tickets[0];
  state.deletedPeople = [{ ...person, deleted_at:"2026-10-06T20:00:00Z",identity_key:person.identity_key+"|deleted:"+person.id }];
  ticket.items.shift();
  ticket.payments = ticket.items.map(item=>({id:`replacement-${item.id}`,ticket_id:ticket.id,item_id:item.id,method:"card",amount_cents:item.amount_cents!,reference:"",created_at:person.checked_in_at,created_by_staff_id:"staff"}));
  const before = buildDailyReport("2026-10-06",[{id:"old-visit",visitDate:"2026-10-06",businessDayYmd:"2026-10-06",status:"open",notes:null,createdAt:person.checked_in_at,
    attendees:[{id:"old-attendee",visitId:"old-visit",firstName:person.first_name,lastName:person.last_name,birthDate:person.dob!,classification:"child_3_plus",unitPriceCents:1000,status:"removed"}],
    payments:[{id:"old-payment",visitId:"old-visit",attendeeId:"old-attendee",entryType:"charge",method:"cash",amountCents:1000,relatedEntryId:null,reason:null,createdByStaffId:"staff",createdAt:person.checked_in_at}] }]);
  const report = includeDeskReport(before,state);
  assert.equal(report.totalAttendance,5); assert.equal(report.combinedTotalCents,4700); assert.equal(report.cashTotalCents,0);
});
