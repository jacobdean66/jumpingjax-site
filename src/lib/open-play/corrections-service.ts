import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
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

type RpcOutcome = {
  outcome: string;
  entries?: Array<{
    id: string;
    entry_type: PaymentEntry["entryType"];
    method: PaymentMethod;
    amount_cents: number;
  }>;
  related_entry_id?: string;
};

export async function applyVisitCorrection(options: {
  visitId: string;
  staffId: string;
  correction: CorrectionRequest;
  now?: Date;
}): Promise<{ entries: PaymentEntry[] }> {
  const supabase = createServiceRoleClient();
  const now = (options.now ?? new Date()).toISOString();
  const correction = options.correction;

  const payload: Record<string, unknown> = {
    visit_id: options.visitId,
    staff_id: options.staffId,
    type: correction.type,
    reason: correction.reason,
  };

  if (correction.type === "method_correction") {
    payload.related_entry_id = correction.relatedEntryId;
    payload.from_method = correction.fromMethod;
    payload.to_method = correction.toMethod;
    payload.amount_cents = correction.amountCents;
    payload.attendee_id = correction.attendeeId ?? null;
  } else if (correction.type === "void") {
    payload.related_entry_id = correction.relatedEntryId;
    payload.attendee_id = correction.attendeeId ?? null;
    payload.remove_attendee_id = correction.removeAttendeeId ?? null;
  } else if (correction.type === "refund") {
    payload.related_entry_id = correction.relatedEntryId;
    payload.method = correction.method;
    payload.amount_cents = correction.amountCents;
    payload.attendee_id = correction.attendeeId ?? null;
  } else {
    payload.attendee_id = correction.attendeeId;
    payload.related_entry_id = correction.relatedEntryId ?? null;
  }

  const { data, error } = await supabase.rpc(
    "apply_open_play_visit_correction_atomic",
    { p_payload: payload },
  );
  if (error) {
    throw new Error("Unable to apply correction");
  }

  const result = data as RpcOutcome;
  const outcomeMap: Record<string, string> = {
    visit_not_found: "Visit not found",
    visit_voided: "Voided visits cannot accept corrections",
    related_entry_invalid: "Related payment entry is invalid",
    charge_already_voided: "Charge is already voided",
    void_after_refund_rejected: "Cannot void a charge after refunds",
    refund_after_void_rejected: "Cannot refund a voided charge",
    refund_exceeds_remaining: "Refund cannot exceed the remaining charge value",
    refund_method_mismatch: "Refund method must match the effective payment method",
    method_already_corrected: "Method has already been corrected",
    correction_after_refund_rejected: "Cannot correct a charge after refunds",
    correction_amount_or_method_mismatch: "Correction amount or method mismatch",
    financial_reversal_required:
      "Attendee removal requires financial reversal of remaining charges",
    attendee_not_found_or_removed: "Attendee not found or already removed",
    invalid_input: "Invalid correction request",
    unsupported_type: "Unsupported correction type",
  };

  if (result.outcome !== "applied") {
    throw new LedgerValidationError(
      outcomeMap[result.outcome] || "Unable to apply correction",
    );
  }

  const entries: PaymentEntry[] = (result.entries ?? []).map((entry) => ({
    id: entry.id,
    visitId: options.visitId,
    attendeeId: null,
    entryType: entry.entry_type,
    method: entry.method,
    amountCents: entry.amount_cents,
    relatedEntryId: null,
    reason: correction.reason,
    createdByStaffId: options.staffId,
    createdAt: now,
  }));

  return { entries };
}
