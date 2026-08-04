import { randomUUID } from "node:crypto";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  prepareVisitAttendees,
  CheckInValidationError,
  type VisitAttendeeRequest,
  type ParticipantRecord,
} from "./check-in";
import {
  buildChargeEntry,
  shouldCreateCharge,
  type PaymentEntry,
} from "./ledger";

export { CheckInValidationError };

export type CreateVisitInput = {
  visitDateYmd: string;
  notes?: string | null;
  staffId: string;
  attendees: VisitAttendeeRequest[];
  now?: Date;
};

export type CreateVisitResult = {
  visitId: string;
  businessDayYmd: string;
  attendees: Array<{
    attendeeId: string;
    participantId: string;
    classification: string;
    unitPriceCents: number;
  }>;
  paymentEntries: PaymentEntry[];
};

export async function createOpenPlayVisit(
  input: CreateVisitInput,
): Promise<CreateVisitResult> {
  const supabase = createServiceRoleClient();
  const now = input.now ?? new Date();
  const createdAt = now.toISOString();
  const businessDayYmd = input.visitDateYmd;

  const participantIds = input.attendees.map((item) => item.participantId);
  const { data: participantRows, error: participantError } = await supabase
    .from("waiver_participants")
    .select(
      "id, submission_id, first_name, last_name, dob, role, waiver_submissions(id, expires_on, status)",
    )
    .in("id", participantIds);

  if (participantError) {
    throw new CheckInValidationError(participantError.message);
  }

  const participantsById = new Map<string, ParticipantRecord>();
  for (const row of participantRows ?? []) {
    const submissionRaw = row.waiver_submissions as
      | { id: string; expires_on: string; status: "completed" | "voided" }
      | { id: string; expires_on: string; status: "completed" | "voided" }[]
      | null;
    const submission = Array.isArray(submissionRaw)
      ? submissionRaw[0]
      : submissionRaw;
    if (!submission) continue;
    participantsById.set(row.id, {
      id: row.id,
      submissionId: row.submission_id,
      firstName: row.first_name,
      lastName: row.last_name,
      dob: row.dob,
      role: row.role,
      expiresOnYmd: submission.expires_on,
      submissionStatus: submission.status,
    });
  }

  const prepared = prepareVisitAttendees({
    visitDateYmd: input.visitDateYmd,
    participantsById,
    requests: input.attendees,
  });

  const { data: visit, error: visitError } = await supabase
    .from("open_play_visits")
    .insert({
      visit_date: input.visitDateYmd,
      business_day_ymd: businessDayYmd,
      created_by_staff_id: input.staffId,
      status: "open",
      notes: input.notes?.trim() || null,
      created_at: createdAt,
    })
    .select("id")
    .single();

  if (visitError || !visit) {
    throw new Error(visitError?.message || "Unable to create visit");
  }

  const attendees: CreateVisitResult["attendees"] = [];
  const paymentEntries: PaymentEntry[] = [];

  for (const item of prepared) {
    const attendeeId = randomUUID();
    const { error: attendeeError } = await supabase
      .from("open_play_visit_attendees")
      .insert({
        id: attendeeId,
        visit_id: visit.id,
        participant_id: item.participantId,
        waiver_submission_id: item.waiverSubmissionId,
        classification: item.classification,
        age_years_on_visit: item.ageYearsOnVisit,
        unit_price_cents: item.unitPriceCents,
        status: "active",
        created_at: createdAt,
      });
    if (attendeeError) {
      throw new Error(attendeeError.message);
    }

    attendees.push({
      attendeeId,
      participantId: item.participantId,
      classification: item.classification,
      unitPriceCents: item.unitPriceCents,
    });

    if (shouldCreateCharge(item.unitPriceCents) && item.paymentMethod) {
      const paymentId = randomUUID();
      const entry = buildChargeEntry(
        {
          visitId: visit.id,
          attendeeId,
          method: item.paymentMethod,
          amountCents: item.unitPriceCents,
          createdByStaffId: input.staffId,
        },
        paymentId,
        createdAt,
      );
      const { error: paymentError } = await supabase
        .from("open_play_payment_entries")
        .insert({
          id: entry.id,
          visit_id: entry.visitId,
          attendee_id: entry.attendeeId,
          entry_type: entry.entryType,
          method: entry.method,
          amount_cents: entry.amountCents,
          related_entry_id: null,
          reason: null,
          created_by_staff_id: entry.createdByStaffId,
          created_at: entry.createdAt,
        });
      if (paymentError) {
        throw new Error(paymentError.message);
      }
      paymentEntries.push(entry);
    }
  }

  await supabase.from("open_play_audit_events").insert({
    actor_staff_id: input.staffId,
    action: "visit_created",
    entity_type: "open_play_visit",
    entity_id: visit.id,
    detail: {
      visitDate: input.visitDateYmd,
      businessDayYmd,
      attendeeCount: attendees.length,
      chargeCount: paymentEntries.length,
    },
  });

  return {
    visitId: visit.id,
    businessDayYmd,
    attendees,
    paymentEntries,
  };
}
