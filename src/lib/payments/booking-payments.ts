export type BookingPaymentKind = "facility" | "rental";
export type BookingPaymentMethod = "card" | "cash" | "check" | "other";
export type BookingPaymentEntryType = "facility_deposit" | "facility_payment" | "rental_payment";

export type BookingPaymentEntry = {
  id: string;
  bookingKind: BookingPaymentKind;
  bookingId: string;
  entryType: BookingPaymentEntryType;
  paymentMethod: BookingPaymentMethod;
  amountCents: number;
  processingFeeCents: number;
  processorReference: string | null;
  recordedBy: string;
  receiptEmail: string | null;
  receiptEmailSentAt: string | null;
  createdAt: string;
  paidAt: string;
  payerName: string | null;
  payerEmail: string | null;
  status: "posted" | "needs_review" | "voided";
  paymentPurpose: string;
  providerTransactionId: string | null;
  source: string;
  notes: string | null;
};

export const CARD_PROCESSING_RATE = 0.03;
export const FACILITY_DEPOSIT_CENTS = 5_000;

export function processingFeeCents(
  amountCents: number,
  method: BookingPaymentMethod,
): number {
  return method === "card" ? Math.round(amountCents * CARD_PROCESSING_RATE) : 0;
}

export function sumBookingPaymentCents(
  entries: readonly (Pick<BookingPaymentEntry, "amountCents"> & Partial<Pick<BookingPaymentEntry, "status">>)[],
): number {
  return entries.reduce((sum, entry) => sum + (!entry.status || entry.status === "posted" ? entry.amountCents : 0), 0);
}

export function facilityDepositStatus(entries: readonly BookingPaymentEntry[]): "paid" | "unrecorded" | "review" {
  if (entries.some((entry) => entry.status === "needs_review")) return "review";
  return sumBookingPaymentCents(entries) >= FACILITY_DEPOSIT_CENTS ? "paid" : "unrecorded";
}

export function paymentDateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(new Date(value));
}

export function remainingBookingBalanceCents(
  total: number | null,
  paidCents: number,
): number | null {
  if (total === null || !Number.isFinite(total)) return null;
  return Math.max(0, Math.round(total * 100) - paidCents);
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function dollarsToCents(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const cents = Math.round(Number(text) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}
