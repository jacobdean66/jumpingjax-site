import { randomUUID } from "node:crypto";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  prepareVisitAttendees,
  CheckInValidationError,
  type VisitAttendeeRequest,
  type ParticipantRecord,
} from "./check-in";
import { shouldCreateCharge, type PaymentEntry } from "./ledger";

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

type RpcOutcome = {
  outcome: string;
  visit_id?: string;
  business_day_ymd?: string;
  attendees?: Array<{
    attendee_id: string;
    participant_id: string;
    classification: string;
    unit_price_cents: number;
  }>;
  payments?: Array<{
    id: string;
    attendee_id: string;
    method: "cash" | "card";
    amount_cents: number;
  }>;
  participant_id?: string;
  error_message?: string;
};

export async function createOpenPlayVisit(
  input: CreateVisitInput,
): Promise<CreateVisitResult> {
  const supabase = createServiceRoleClient();
  const now = input.now ?? new Date();
  const createdAt = now.toISOString();

  const participantIds = input.attendees.map((item) => item.participantId);
  const { data: participantRows, error: participantError } = await supabase
    .from("waiver_participants")
    .select(
      "id, submission_id, first_name, last_name, dob, role, waiver_submissions(id, expires_on, status)",
    )
    .in("id", participantIds);

  if (participantError) {
    throw new CheckInValidationError("Unable to load participants");
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

  const payload = {
    visit_date: input.visitDateYmd,
    staff_id: input.staffId,
    notes: input.notes?.trim() || null,
    attendees: prepared.map((item) => {
      const attendeeId = randomUUID();
      const paymentId = randomUUID();
      return {
        attendee_id: attendeeId,
        payment_id: shouldCreateCharge(item.unitPriceCents) ? paymentId : null,
        participant_id: item.participantId,
        waiver_submission_id: item.waiverSubmissionId,
        classification: item.classification,
        age_years_on_visit: item.ageYearsOnVisit,
        unit_price_cents: item.unitPriceCents,
        payment_method: item.paymentMethod,
      };
    }),
  };

  const { data, error } = await supabase.rpc("create_open_play_visit_atomic", {
    p_payload: payload,
  });
  if (error) {
    throw new Error("Unable to create visit");
  }

  const result = data as RpcOutcome;
  if (result.outcome === "duplicate_same_day_attendee") {
    throw new CheckInValidationError(
      "Participant is already checked in for this business day",
    );
  }
  if (result.outcome === "payment_method_required") {
    throw new CheckInValidationError("Paid attendees require a cash or card payment method");
  }
  if (result.outcome === "free_attendee_cannot_have_payment_method") {
    throw new CheckInValidationError("Free watching adults must not include a payment method");
  }
  if (result.outcome !== "created" || !result.visit_id) {
    throw new Error("Unable to create visit");
  }

  const paymentEntries: PaymentEntry[] = (result.payments ?? []).map((payment) => ({
    id: payment.id,
    visitId: result.visit_id!,
    attendeeId: payment.attendee_id,
    entryType: "charge",
    method: payment.method,
    amountCents: payment.amount_cents,
    relatedEntryId: null,
    reason: null,
    createdByStaffId: input.staffId,
    createdAt,
  }));

  const adjustmentRows: Array<Record<string, unknown>> = [];
  for (const [index, item] of prepared.entries()) {
    if (item.targetPriceCents === item.unitPriceCents) continue;
    const payloadAttendee = payload.attendees[index];
    const original = (result.payments ?? []).find(
      (payment) => payment.attendee_id === payloadAttendee?.attendee_id,
    );
    if (!payloadAttendee || !original) {
      throw new Error("Unable to apply custom admission price");
    }
    const adjustmentId = randomUUID();
    const amountCents = item.targetPriceCents - item.unitPriceCents;
    const reason = item.targetPriceCents === 0
      ? "Free pass selected at check-in"
      : "Custom admission price selected at check-in";
    adjustmentRows.push({
      id: adjustmentId,
      visit_id: result.visit_id,
      attendee_id: payloadAttendee.attendee_id,
      entry_type: "correction",
      method: item.paymentMethod ?? "cash",
      amount_cents: amountCents,
      related_entry_id: original.id,
      reason,
      created_by_staff_id: input.staffId,
    });
    paymentEntries.push({
      id: adjustmentId,
      visitId: result.visit_id,
      attendeeId: payloadAttendee.attendee_id,
      entryType: "correction",
      method: item.paymentMethod ?? "cash",
      amountCents,
      relatedEntryId: original.id,
      reason,
      createdByStaffId: input.staffId,
      createdAt,
    });
  }

  if (adjustmentRows.length) {
    const { error: adjustmentError } = await supabase
      .from("open_play_payment_entries")
      .insert(adjustmentRows);
    if (adjustmentError) throw new Error("Unable to apply custom admission price");
  }

  return {
    visitId: result.visit_id,
    businessDayYmd: result.business_day_ymd ?? input.visitDateYmd,
    attendees: (result.attendees ?? []).map((attendee) => ({
      attendeeId: attendee.attendee_id,
      participantId: attendee.participant_id,
      classification: attendee.classification,
      unitPriceCents: attendee.unit_price_cents,
    })),
    paymentEntries,
  };
}
