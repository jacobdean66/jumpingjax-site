import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isYmd } from "./pricing";
import type { DeskState, DeskPerson, DeskTicket, DeskItem, DeskPayment } from "./desk";
import { personIdentity } from "./desk";
import { loadFacilityAttendance } from "./facility-attendance-store";

export async function loadDeskState(day: string): Promise<DeskState> {
  if (!isYmd(day)) throw new Error("Invalid visit date");
  const db = createServiceRoleClient();
  const [presence, tickets] = await Promise.all([
    db.from("open_play_desk_attendance").select("*").eq("business_day_ymd", day).order("checked_in_at"),
    db.from("open_play_checkout_tickets").select("*").eq("business_day_ymd", day).order("created_at"),
  ]);
  if (presence.error || tickets.error) throw new Error("Unable to load attendance and tickets");
  const rows = (tickets.data ?? []) as Omit<DeskTicket, "items" | "payments">[];
  const ids = rows.map(ticket => ticket.id);
  const [items, payments] = ids.length ? await Promise.all([
    db.from("open_play_checkout_items").select("*").in("ticket_id", ids).order("id"),
    db.from("open_play_checkout_payments").select("*").in("ticket_id", ids).order("created_at").order("id"),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (items.error || payments.error) throw new Error("Unable to load ticket details");
  const people = (presence.data ?? []) as DeskPerson[];
  const nativeIds = people.flatMap(person => person.participant_id ? [person.participant_id] : []);
  const legacyIds = people.flatMap(person => person.legacy_participant_id ? [person.legacy_participant_id] : []);
  const correctionResults = await Promise.all([
    nativeIds.length ? db.from("waiver_participant_name_corrections").select("participant_id,corrected_first_name,corrected_last_name").in("participant_id", nativeIds).order("created_at", { ascending: false }).order("id", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    legacyIds.length ? db.from("smartwaiver_legacy_participant_name_corrections").select("legacy_participant_id,corrected_first_name,corrected_last_name").in("legacy_participant_id", legacyIds).order("created_at", { ascending: false }).order("id", { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (correctionResults.some(result => result.error)) throw new Error("Unable to load current guest names");
  type Correction = { participant_id?: string; legacy_participant_id?: string; corrected_first_name: string; corrected_last_name: string };
  for (const person of people) {
    const corrections = correctionResults[person.source === "native" ? 0 : 1].data as Correction[];
    const correction = corrections.find(correction => (correction.participant_id ?? correction.legacy_participant_id) === (person.participant_id ?? person.legacy_participant_id));
    if (correction) { person.first_name = correction.corrected_first_name; person.last_name = correction.corrected_last_name; }
  }
  const partyGuests = await loadFacilityAttendance(day);
  const known = new Set(people.map(person => person.identity_key));
  for (const guest of partyGuests) {
    const identity = personIdentity(guest.firstName, guest.lastName, guest.dob);
    if (!guest.checkedInAt) continue;
    const saved = people.find(person => person.identity_key === identity);
    if (saved) { saved.facility_party_booking_id = guest.bookingId; continue; }
    if (known.has(identity)) continue;
    known.add(identity);
    people.push({ id: `facility:${guest.id}`, business_day_ymd: day, source: "native", participant_id: guest.participantId,
      legacy_participant_id: null, identity_key: identity, first_name: guest.firstName, last_name: guest.lastName,
      dob: guest.dob, role: guest.role as DeskPerson["role"], waiver_expires_on: guest.waiverDetails?.expiresOnYmd ?? day,
      checked_in_at: guest.checkedInAt, checked_out_at: null, created_by_staff_id: "facility-party", facility_party_booking_id: guest.bookingId });
  }
  return {
    people,
    tickets: rows.map(ticket => ({ ...ticket,
      items: ((items.data ?? []) as DeskItem[]).filter(item => item.ticket_id === ticket.id),
      payments: ((payments.data ?? []) as DeskPayment[]).filter(payment => payment.ticket_id === ticket.id),
    })),
  };
}

export class DeskValidationError extends Error {}

export async function runDeskCommand(day: string, action: string, staff: string, payload: Record<string, unknown>) {
  if (!isYmd(day)) throw new DeskValidationError("Choose a valid visit date.");
  const { data, error } = await createServiceRoleClient().rpc("open_play_desk_command", {
    p_day: day, p_action: action, p_staff: staff, p_payload: payload,
  });
  if (error) {
    if (["22023", "22P02", "22007", "22008"].includes(error.code)) throw new DeskValidationError(error.message);
    console.error("Open Play desk command failed", { action, code: error.code });
    throw new Error("Unable to save. Your existing attendance and payments are unchanged. Try again.");
  }
  return data as { attendanceId?: string; ticketId?: string; paymentId?: string };
}
