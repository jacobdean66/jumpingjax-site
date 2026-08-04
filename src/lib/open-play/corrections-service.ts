import { randomUUID } from "node:crypto";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  buildMethodCorrectionEntries,
  buildRefundEntry,
  buildVoidEntry,
  LedgerValidationError,
  type PaymentEntry,
  type PaymentMethod,
} from "./ledger";

export { LedgerValidationError };

export type CorrectionRequest =
  | {
      type: "method_correction";
      relatedEntryId: string;
      fromMethod: PaymentMethod;
      toMethod: PaymentMethod;
      amountCents: number;
      reason: string;
      attendeeId?: string | null;
    }
  | {
      type: "void";
      relatedEntryId: string;
      reason: string;
      attendeeId?: string | null;
      removeAttendeeId?: string | null;
    }
  | {
      type: "refund";
      relatedEntryId: string;
      method: PaymentMethod;
      amountCents: number;
      reason: string;
      attendeeId?: string | null;
    }
  | {
      type: "remove_attendee";
      attendeeId: string;
      relatedEntryId?: string | null;
      reason: string;
    };

function mapPaymentRow(row: {
  id: string;
  visit_id: string;
  attendee_id: string | null;
  entry_type: PaymentEntry["entryType"];
  method: PaymentMethod;
  amount_cents: number;
  related_entry_id: string | null;
  reason: string | null;
  created_by_staff_id: string;
  created_at: string;
}): PaymentEntry {
  return {
    id: row.id,
    visitId: row.visit_id,
    attendeeId: row.attendee_id,
    entryType: row.entry_type,
    method: row.method,
    amountCents: row.amount_cents,
    relatedEntryId: row.related_entry_id,
    reason: row.reason,
    createdByStaffId: row.created_by_staff_id,
    createdAt: row.created_at,
  };
}

export async function applyVisitCorrection(options: {
  visitId: string;
  staffId: string;
  correction: CorrectionRequest;
  now?: Date;
}): Promise<{ entries: PaymentEntry[] }> {
  const supabase = createServiceRoleClient();
  const now = (options.now ?? new Date()).toISOString();

  const { data: visit, error: visitError } = await supabase
    .from("open_play_visits")
    .select("id, status")
    .eq("id", options.visitId)
    .maybeSingle();
  if (visitError) throw new Error(visitError.message);
  if (!visit) throw new LedgerValidationError("Visit not found");
  if (visit.status === "voided") {
    throw new LedgerValidationError("Voided visits cannot accept corrections");
  }

  const { data: paymentRows, error: paymentError } = await supabase
    .from("open_play_payment_entries")
    .select("*")
    .eq("visit_id", options.visitId);
  if (paymentError) throw new Error(paymentError.message);

  const existing = (paymentRows ?? []).map(mapPaymentRow);
  let newEntries: PaymentEntry[] = [];

  if (options.correction.type === "method_correction") {
    newEntries = buildMethodCorrectionEntries(
      {
        visitId: options.visitId,
        relatedEntryId: options.correction.relatedEntryId,
        fromMethod: options.correction.fromMethod,
        toMethod: options.correction.toMethod,
        amountCents: options.correction.amountCents,
        reason: options.correction.reason,
        createdByStaffId: options.staffId,
        attendeeId: options.correction.attendeeId,
      },
      existing,
      { debitId: randomUUID(), creditId: randomUUID() },
      now,
    );
  } else if (options.correction.type === "void") {
    newEntries = [
      buildVoidEntry(
        {
          visitId: options.visitId,
          relatedEntryId: options.correction.relatedEntryId,
          reason: options.correction.reason,
          createdByStaffId: options.staffId,
          attendeeId: options.correction.attendeeId,
        },
        existing,
        randomUUID(),
        now,
      ),
    ];
    if (options.correction.removeAttendeeId) {
      const { error } = await supabase
        .from("open_play_visit_attendees")
        .update({ status: "removed" })
        .eq("id", options.correction.removeAttendeeId)
        .eq("visit_id", options.visitId);
      if (error) throw new Error(error.message);
    }
  } else if (options.correction.type === "refund") {
    newEntries = [
      buildRefundEntry(
        {
          visitId: options.visitId,
          relatedEntryId: options.correction.relatedEntryId,
          method: options.correction.method,
          amountCents: options.correction.amountCents,
          reason: options.correction.reason,
          createdByStaffId: options.staffId,
          attendeeId: options.correction.attendeeId,
        },
        existing,
        randomUUID(),
        now,
      ),
    ];
  } else if (options.correction.type === "remove_attendee") {
    const { error } = await supabase
      .from("open_play_visit_attendees")
      .update({ status: "removed" })
      .eq("id", options.correction.attendeeId)
      .eq("visit_id", options.visitId);
    if (error) throw new Error(error.message);

    if (options.correction.relatedEntryId) {
      newEntries = [
        buildVoidEntry(
          {
            visitId: options.visitId,
            relatedEntryId: options.correction.relatedEntryId,
            reason: options.correction.reason,
            createdByStaffId: options.staffId,
            attendeeId: options.correction.attendeeId,
          },
          existing,
          randomUUID(),
          now,
        ),
      ];
    }
  }

  if (newEntries.length > 0) {
    const { error } = await supabase.from("open_play_payment_entries").insert(
      newEntries.map((entry) => ({
        id: entry.id,
        visit_id: entry.visitId,
        attendee_id: entry.attendeeId,
        entry_type: entry.entryType,
        method: entry.method,
        amount_cents: entry.amountCents,
        related_entry_id: entry.relatedEntryId,
        reason: entry.reason,
        created_by_staff_id: entry.createdByStaffId,
        created_at: entry.createdAt,
      })),
    );
    if (error) throw new Error(error.message);
  }

  await supabase.from("open_play_audit_events").insert({
    actor_staff_id: options.staffId,
    action: `visit_${options.correction.type}`,
    entity_type: "open_play_visit",
    entity_id: options.visitId,
    detail: {
      correctionType: options.correction.type,
      entryCount: newEntries.length,
    },
  });

  return { entries: newEntries };
}
