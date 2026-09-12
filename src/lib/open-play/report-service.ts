import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isYmd } from "./pricing";
import {
  buildDailyReport,
  type DailyReport,
  type VisitSnapshot,
} from "./daily-report";
import type { AdmissionClassification } from "./pricing";
import type { PaymentEntry, PaymentMethod } from "./ledger";

export async function getOpenPlayDailyReport(
  dateYmd: string,
): Promise<DailyReport> {
  if (!isYmd(dateYmd)) {
    throw new Error("date must be YYYY-MM-DD");
  }

  const supabase = createServiceRoleClient();
  const { data: visits, error: visitError } = await supabase
    .from("open_play_visits")
    .select("id, visit_date, business_day_ymd, status, notes, created_at")
    .eq("business_day_ymd", dateYmd);

  if (visitError) throw new Error(visitError.message);
  if (!visits?.length) {
    return buildDailyReport(dateYmd, []);
  }

  const visitIds = visits.map((visit) => visit.id);
  const { data: attendees, error: attendeeError } = await supabase
    .from("open_play_visit_attendees")
    .select("id, visit_id, participant_id, waiver_submission_id, classification, unit_price_cents, status")
    .in("visit_id", visitIds);
  if (attendeeError) throw new Error(attendeeError.message);

  const participantIds = Array.from(
    new Set((attendees ?? []).map((item) => item.participant_id).filter(Boolean)),
  );
  const { data: participantRows, error: participantError } = participantIds.length
    ? await supabase
        .from("waiver_participants")
        .select("id, first_name, last_name")
        .in("id", participantIds)
    : { data: [], error: null };
  if (participantError) throw new Error(participantError.message);

  const { data: correctionRows, error: correctionError } = participantIds.length
    ? await supabase
        .from("waiver_participant_name_corrections")
        .select("participant_id, corrected_first_name, corrected_last_name, created_at, id")
        .in("participant_id", participantIds)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
    : { data: [], error: null };
  if (correctionError) throw new Error(correctionError.message);

  const participantsById = new Map(
    (participantRows ?? []).map((item) => [
      item.id,
      { firstName: item.first_name, lastName: item.last_name },
    ]),
  );
  const correctionsByParticipantId = new Map<string, {
    firstName: string;
    lastName: string;
  }>();
  for (const correction of correctionRows ?? []) {
    if (correctionsByParticipantId.has(correction.participant_id)) continue;
    correctionsByParticipantId.set(correction.participant_id, {
      firstName: correction.corrected_first_name,
      lastName: correction.corrected_last_name,
    });
  }

  const { data: payments, error: paymentError } = await supabase
    .from("open_play_payment_entries")
    .select(
      "id, visit_id, attendee_id, entry_type, method, amount_cents, related_entry_id, reason, created_by_staff_id, created_at",
    )
    .in("visit_id", visitIds);
  if (paymentError) throw new Error(paymentError.message);

  const snapshots: VisitSnapshot[] = visits.map((visit) => {
    const visitAttendees =
      attendees
        ?.filter((item) => item.visit_id === visit.id)
        .map((item) => {
          const original = participantsById.get(item.participant_id) ?? {
            firstName: "",
            lastName: "",
          };
          const correction = correctionsByParticipantId.get(item.participant_id);
          const firstName = correction?.firstName ?? original.firstName;
          const lastName = correction?.lastName ?? original.lastName;
          return {
            id: item.id,
            visitId: item.visit_id,
            participantId: item.participant_id,
            submissionId: item.waiver_submission_id,
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`.trim(),
            originalFirstName: original.firstName,
            originalLastName: original.lastName,
            nameCorrected: correction != null,
            classification: item.classification as AdmissionClassification,
            unitPriceCents: item.unit_price_cents,
            status: item.status as "active" | "removed",
          };
        }) ?? [];

    const visitPayments: PaymentEntry[] =
      payments
        ?.filter((item) => item.visit_id === visit.id)
        .map((item) => ({
          id: item.id,
          visitId: item.visit_id,
          attendeeId: item.attendee_id,
          entryType: item.entry_type as PaymentEntry["entryType"],
          method: item.method as PaymentMethod,
          amountCents: item.amount_cents,
          relatedEntryId: item.related_entry_id,
          reason: item.reason,
          createdByStaffId: item.created_by_staff_id,
          createdAt: item.created_at,
        })) ?? [];

    return {
      id: visit.id,
      visitDate: visit.visit_date,
      businessDayYmd: visit.business_day_ymd,
      status: visit.status as VisitSnapshot["status"],
      notes: visit.notes,
      createdAt: visit.created_at,
      attendees: visitAttendees,
      payments: visitPayments,
    };
  });

  return buildDailyReport(dateYmd, snapshots);
}
