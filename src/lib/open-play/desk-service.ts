import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isYmd } from "./pricing";
import { ageInCompletedYearsOnDate } from "./pricing";
import type {
  DeskState,
  DeskPerson,
  DeskTicket,
  DeskItem,
  DeskPayment,
  DeskPass,
} from "./desk";
import { personIdentity } from "./desk";
import { loadFacilityAttendance } from "./facility-attendance-store";
import { loadBirthdayPartiesForDay } from "./birthday-parties";

export async function loadDeskState(day: string): Promise<DeskState> {
  if (!isYmd(day)) throw new Error("Invalid visit date");
  const db = createServiceRoleClient();
  const [presence, tickets] = await Promise.all([
    db
      .from("open_play_desk_attendance")
      .select("*")
      .eq("business_day_ymd", day)
      .order("checked_in_at"),
    db
      .from("open_play_checkout_tickets")
      .select("*")
      .eq("business_day_ymd", day)
      .order("created_at"),
  ]);
  if (presence.error || tickets.error)
    throw new Error("Unable to load attendance and tickets");
  const rows = (tickets.data ?? []) as Omit<DeskTicket, "items" | "payments">[];
  const ids = rows.map((ticket) => ticket.id);
  const [items, payments] = ids.length
    ? await Promise.all([
        db
          .from("open_play_checkout_items")
          .select("*")
          .in("ticket_id", ids)
          .order("id"),
        db
          .from("open_play_checkout_payments")
          .select("*")
          .in("ticket_id", ids)
          .order("created_at")
          .order("id"),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (items.error || payments.error)
    throw new Error("Unable to load ticket details");
  const passResult = ids.length
    ? await db
        .from("open_play_checkout_passes")
        .select("id,ticket_id,item_id,attendance_id,amount_cents")
        .in("ticket_id", ids)
    : { data: [], error: null };
  if (passResult.error) throw new Error("Unable to load free-pass records");
  const allPeople = (presence.data ?? []) as DeskPerson[];
  const correctionResult = allPeople.length ? await db.from("open_play_desk_checkin_corrections")
    .select("attendance_id,method,id").in("attendance_id", allPeople.map(p => p.id)).order("id", { ascending: false })
    : { data: [], error: null };
  if (correctionResult.error) throw new Error("Unable to load check-in corrections");
  for (const person of allPeople) {
    const correction = correctionResult.data?.find(c => c.attendance_id === person.id);
    if (correction?.method) person.corrected_method = correction.method as DeskPerson["corrected_method"];
    else if ((passResult.data as DeskPass[] | null)?.some(pass => pass.attendance_id === person.id)) person.corrected_method = "free_pass";
  }
  const people = allPeople.filter(person => !person.deleted_at);
  const nativeIds = people.flatMap((person) =>
    person.participant_id ? [person.participant_id] : [],
  );
  const legacyIds = people.flatMap((person) =>
    person.legacy_participant_id ? [person.legacy_participant_id] : [],
  );
  const priorPayments = await Promise.all([
    nativeIds.length ? db.from("open_play_visit_attendees")
      .select("participant_id,open_play_payment_entries(method,amount_cents)")
      .eq("business_day_ymd", day).eq("status", "active").in("participant_id", nativeIds)
      : Promise.resolve({ data: [], error: null }),
    legacyIds.length ? db.from("smartwaiver_legacy_check_ins")
      .select("legacy_participant_id,smartwaiver_legacy_payment_entries(method,amount_cents)")
      .eq("business_day_ymd", day).eq("status", "active").in("legacy_participant_id", legacyIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (priorPayments.some(result => result.error)) throw new Error("Unable to load prior check-in payments");
  type PriorRow = { participant_id?: string; legacy_participant_id?: string;
    open_play_payment_entries?: { method: "cash" | "card"; amount_cents: number }[];
    smartwaiver_legacy_payment_entries?: { method: "cash" | "card"; amount_cents: number }[] };
  for (const person of people.filter(p => !p.corrected_at)) {
    const rows = priorPayments[person.source === "native" ? 0 : 1].data as PriorRow[];
    const entries = rows.filter(row => (row.participant_id ?? row.legacy_participant_id) === (person.participant_id ?? person.legacy_participant_id))
      .flatMap(row => row.open_play_payment_entries ?? row.smartwaiver_legacy_payment_entries ?? []);
    person.prior_payment = {
      cash: Math.max(0, entries.filter(e => e.method === "cash").reduce((sum,e) => sum+e.amount_cents,0)),
      card: Math.max(0, entries.filter(e => e.method === "card").reduce((sum,e) => sum+e.amount_cents,0)),
    };
  }
  const correctionResults = await Promise.all([
    nativeIds.length
      ? db
          .from("waiver_participant_name_corrections")
          .select("participant_id,corrected_first_name,corrected_last_name")
          .in("participant_id", nativeIds)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    legacyIds.length
      ? db
          .from("smartwaiver_legacy_participant_name_corrections")
          .select(
            "legacy_participant_id,corrected_first_name,corrected_last_name",
          )
          .in("legacy_participant_id", legacyIds)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (correctionResults.some((result) => result.error))
    throw new Error("Unable to load current guest names");
  type Correction = {
    participant_id?: string;
    legacy_participant_id?: string;
    corrected_first_name: string;
    corrected_last_name: string;
  };
  for (const person of people) {
    const corrections = correctionResults[person.source === "native" ? 0 : 1]
      .data as Correction[];
    const correction = corrections.find(
      (correction) =>
        (correction.participant_id ?? correction.legacy_participant_id) ===
        (person.participant_id ?? person.legacy_participant_id),
    );
    if (correction) {
      person.first_name = correction.corrected_first_name;
      person.last_name = correction.corrected_last_name;
    }
  }
  const partyGuests = await loadFacilityAttendance(day);
  const known = new Set(allPeople.map((person) => person.identity_key));
  for (const guest of partyGuests) {
    const identity = personIdentity(guest.firstName, guest.lastName, guest.dob);
    if (!guest.checkedInAt) continue;
    const saved = allPeople.find((person) => person.identity_key === identity);
    if (saved) {
      if (!saved.deleted_at && !saved.corrected_at) saved.facility_party_booking_id = guest.bookingId;
      continue;
    }
    if (known.has(identity)) continue;
    known.add(identity);
    people.push({
      id: `facility:${guest.id}`,
      business_day_ymd: day,
      source: "native",
      participant_id: guest.participantId,
      legacy_participant_id: null,
      identity_key: identity,
      first_name: guest.firstName,
      last_name: guest.lastName,
      dob: guest.dob,
      role: guest.role as DeskPerson["role"],
      waiver_expires_on: guest.waiverDetails?.expiresOnYmd ?? day,
      checked_in_at: guest.checkedInAt,
      checked_out_at: null,
      created_by_staff_id: "facility-party",
      facility_party_booking_id: guest.bookingId,
    });
  }
  return {
    birthdayParties: await loadBirthdayPartiesForDay(day),
    freePasses: [
      ...((passResult.data ?? []) as DeskPass[]).filter(pass => {
        const person = people.find(p => p.id === pass.attendance_id);
        return person && !person.corrected_at;
      }),
      ...people.filter(p => p.corrected_at && p.corrected_method === "free_pass").map(p => ({
        id: `correction:${p.id}`, ticket_id: "", item_id: "", attendance_id: p.id,
        amount_cents: p.role === "child" && p.dob && ageInCompletedYearsOnDate(p.dob, day) <= 2 ? 700 : 1000,
      })),
    ],
    people,
    deletedPeople: allPeople.filter(p => p.deleted_at),
    tickets: rows.map((ticket) => ({
      ...ticket,
      items: ((items.data ?? []) as DeskItem[]).filter(
        (item) => item.ticket_id === ticket.id && !allPeople.find(p => p.id === item.attendance_id)?.deleted_at,
      ),
      payments: ((payments.data ?? []) as DeskPayment[]).filter(
        (payment) => payment.ticket_id === ticket.id,
      ),
    })),
  };
}

export class DeskValidationError extends Error {}

export async function runDeskCommand(
  day: string,
  action: string,
  staff: string,
  payload: Record<string, unknown>,
) {
  if (!isYmd(day)) throw new DeskValidationError("Choose a valid visit date.");
  const { data, error } = await createServiceRoleClient().rpc(
    ["correct_checkin", "delete_checkin"].includes(action) ? "correct_open_play_desk_checkin" : action === "complete_checkout"
      ? "complete_open_play_desk_checkout_atomic"
      : "open_play_desk_command",
    {
      p_day: day,
      ...(["complete_checkout", "correct_checkin", "delete_checkin"].includes(action) ? {} : { p_action: action }),
      p_staff: staff,
      p_payload: payload,
    },
  );
  if (error) {
    if (["22023", "22P02", "22007", "22008"].includes(error.code))
      throw new DeskValidationError(error.message);
    console.error("Open Play desk command failed", {
      action,
      code: error.code,
    });
    throw new Error(
      "Unable to save. Your existing attendance and payments are unchanged. Try again.",
    );
  }
  return data as {
    attendanceId?: string;
    ticketId?: string;
    paymentId?: string;
  };
}
