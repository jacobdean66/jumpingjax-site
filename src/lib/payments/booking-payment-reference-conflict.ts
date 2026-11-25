type BookingScope = { kind: "facility" | "rental"; id: string };

type ConflictEntry = {
  booking_kind: string | null;
  booking_id: string | null;
  status: string | null;
};

const UNKNOWN_CONFLICT =
  "This receipt is already recorded in the payment ledger. No payment was added. Check the full processor receipt and ask a manager to review it in Admin Payments before retrying.";

export function bookingPaymentReferenceConflictMessage(
  current: BookingScope,
  conflict: ConflictEntry | null | undefined,
): string {
  if (
    !conflict ||
    (conflict.booking_kind !== "facility" && conflict.booking_kind !== "rental") ||
    !conflict.booking_id ||
    (conflict.status !== "posted" && conflict.status !== "needs_review")
  ) {
    return UNKNOWN_CONFLICT;
  }
  if (conflict.booking_kind !== current.kind || conflict.booking_id !== current.id) {
    return "This receipt is already linked to a different booking. No payment was added to this booking. Verify the full processor receipt and ask a manager to reconcile it in Admin Payments.";
  }
  if (conflict.status === "needs_review") {
    return "This receipt is already linked to this booking but needs review. No payment was added. Ask a manager to review it in Admin Payments.";
  }
  return "This receipt is already recorded on this booking. No payment was added. Reload and check the booking’s payment history before retrying.";
}
