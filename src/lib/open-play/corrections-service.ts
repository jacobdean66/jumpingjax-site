import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  LedgerValidationError,
  type PaymentEntry,
  type PaymentEntryType,
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

export type CorrectionRpcEntry = {
  id: string;
  entry_type: PaymentEntryType;
  method: PaymentMethod;
  amount_cents: number;
  /** Present when the RPC includes ledger identity on the success row. */
  attendee_id?: string | null;
  /** Present when the RPC includes the related charge id on the success row. */
  related_entry_id?: string | null;
};

type RpcOutcome = {
  outcome: string;
  entries?: CorrectionRpcEntry[];
  related_entry_id?: string;
};

/** Accept only the payment methods supported by the Open Play ledger contract. */
export function parsePaymentMethod(value: unknown): PaymentMethod | null {
  if (value === "cash" || value === "card") return value;
  return null;
}

/**
 * Parse a corrections POST body into a typed CorrectionRequest.
 * Rejects missing/invalid payment methods instead of coercing to cash.
 * Returns null for an unsupported type so the route can keep code "validation".
 */
export function parseCorrectionRequest(
  body: Record<string, unknown>,
): CorrectionRequest | null {
  const type = typeof body.type === "string" ? body.type : "";

  if (type === "method_correction") {
    const fromMethod = parsePaymentMethod(body.fromMethod);
    const toMethod = parsePaymentMethod(body.toMethod);
    if (!fromMethod || !toMethod) {
      throw new LedgerValidationError(
        "Payment method must be cash or card",
      );
    }
    return {
      type: "method_correction",
      relatedEntryId: String(body.relatedEntryId ?? ""),
      fromMethod,
      toMethod,
      amountCents: Number(body.amountCents),
      reason: String(body.reason ?? ""),
      attendeeId: body.attendeeId ? String(body.attendeeId) : null,
    };
  }

  if (type === "void") {
    return {
      type: "void",
      relatedEntryId: String(body.relatedEntryId ?? ""),
      reason: String(body.reason ?? ""),
      attendeeId: body.attendeeId ? String(body.attendeeId) : null,
      removeAttendeeId: body.removeAttendeeId
        ? String(body.removeAttendeeId)
        : null,
    };
  }

  if (type === "refund") {
    const method = parsePaymentMethod(body.method);
    if (!method) {
      throw new LedgerValidationError(
        "Payment method must be cash or card",
      );
    }
    return {
      type: "refund",
      relatedEntryId: String(body.relatedEntryId ?? ""),
      method,
      amountCents: Number(body.amountCents),
      reason: String(body.reason ?? ""),
      attendeeId: body.attendeeId ? String(body.attendeeId) : null,
    };
  }

  if (type === "remove_attendee") {
    return {
      type: "remove_attendee",
      attendeeId: String(body.attendeeId ?? ""),
      relatedEntryId: body.relatedEntryId ? String(body.relatedEntryId) : null,
      reason: String(body.reason ?? ""),
    };
  }

  return null;
}

/**
 * Map RPC success entry rows onto the public PaymentEntry contract.
 * Preserves attendeeId / relatedEntryId when the RPC supplies them;
 * leaves them null only when the RPC omits them or returns null.
 */
export function mapCorrectionRpcEntries(options: {
  visitId: string;
  staffId: string;
  reason: string;
  createdAt: string;
  entries: CorrectionRpcEntry[];
}): PaymentEntry[] {
  return options.entries.map((entry) => ({
    id: entry.id,
    visitId: options.visitId,
    attendeeId: entry.attendee_id ?? null,
    entryType: entry.entry_type,
    method: entry.method,
    amountCents: entry.amount_cents,
    relatedEntryId: entry.related_entry_id ?? null,
    reason: options.reason,
    createdByStaffId: options.staffId,
    createdAt: options.createdAt,
  }));
}

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

  return {
    entries: mapCorrectionRpcEntries({
      visitId: options.visitId,
      staffId: options.staffId,
      reason: correction.reason,
      createdAt: now,
      entries: result.entries ?? [],
    }),
  };
}
