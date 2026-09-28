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
  idempotencyKey: string | null;
  recordedBy: string;
  receiptEmail: string | null;
  receiptRequestedAt: string | null;
  receiptEmailSentAt: string | null;
  receiptErrorClass: string | null;
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

export type FacilityLegacyPayment = {
  id?: string;
  amount: number;
  paymentKind: string;
  paymentMethod: string;
  paidAt: string;
  posReceiptNumber: string | null;
  recordedBy: string;
  notes: string | null;
};

export const CARD_PROCESSING_RATE = 0.03;
export const FACILITY_DEPOSIT_CENTS = 5_000;
export const BOOKING_PAYMENT_IDEMPOTENCY_PREFIX = "booking-payment";

export type BookingPaymentStatus =
  | "unknown_total"
  | "unpaid"
  | "partial"
  | "paid"
  | "overpaid";

export type BookingPaymentProjection = {
  totalCents: number | null;
  paidCents: number;
  balanceCents: number | null;
  status: BookingPaymentStatus;
};

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

function cleanReference(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function normalizeBookingPaymentMethod(
  value: string,
): BookingPaymentMethod {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("cash app")) return "other";
  if (normalized.includes("apple pay")) return "card";
  if (normalized.includes("cash")) return "cash";
  if (normalized.includes("check") || normalized.includes("cheque")) {
    return "check";
  }
  if (
    normalized.includes("card") ||
    normalized.includes("credit") ||
    normalized.includes("debit") ||
    normalized.includes("swipe") ||
    normalized.includes("pos")
  ) {
    return "card";
  }
  return "other";
}

function legacyPaymentAmountCents(payment: Pick<FacilityLegacyPayment, "amount">) {
  return Math.round(Number(payment.amount) * 100);
}

function isLikelyDuplicateFacilityPayment(
  entry: BookingPaymentEntry,
  legacyPayment: FacilityLegacyPayment,
): boolean {
  const amountCents = legacyPaymentAmountCents(legacyPayment);
  if (entry.amountCents !== amountCents) return false;

  const entryReference = cleanReference(entry.processorReference);
  const legacyReference = cleanReference(legacyPayment.posReceiptNumber);
  if (entryReference && legacyReference) {
    return entryReference === legacyReference;
  }

  const legacyMethod = normalizeBookingPaymentMethod(legacyPayment.paymentMethod);
  const methodsMatch = entry.paymentMethod === legacyMethod;
  if (!methodsMatch) return false;

  const legacyKind = legacyPayment.paymentKind.trim().toLowerCase();
  if ((entry.entryType === "facility_deposit") !== (legacyKind === "deposit")) {
    return false;
  }
  const recordedAt = Date.parse(entry.createdAt);
  return Number.isFinite(recordedAt) && recordedAt === Date.parse(legacyPayment.paidAt);
}

function matchFacilityPayments(input: {
  bookingEntries: readonly BookingPaymentEntry[];
  legacyPayments: readonly FacilityLegacyPayment[];
}): Map<number, number> {
  const matches = new Map<number, number>();
  const usedLegacy = new Set<number>();
  // Match across sources one-to-one; repeated payments within either ledger stay intact.
  for (const [entryIndex, entry] of input.bookingEntries.entries()) {
    const paymentIndex = input.legacyPayments.findIndex((payment, index) =>
      !usedLegacy.has(index) && isLikelyDuplicateFacilityPayment(entry, payment),
    );
    if (paymentIndex >= 0) {
      matches.set(entryIndex, paymentIndex);
      usedLegacy.add(paymentIndex);
    }
  }
  return matches;
}

function bookingEntryFromLegacyFacilityPayment(
  payment: FacilityLegacyPayment,
): BookingPaymentEntry {
  return {
    id: `facility-party-payment:${payment.id ?? payment.paidAt}`,
    bookingKind: "facility",
    bookingId: "",
    entryType:
      payment.paymentKind.trim().toLowerCase() === "deposit"
        ? "facility_deposit"
        : "facility_payment",
    paymentMethod: normalizeBookingPaymentMethod(payment.paymentMethod),
    amountCents: legacyPaymentAmountCents(payment),
    processingFeeCents: 0,
    processorReference: payment.posReceiptNumber,
    idempotencyKey: null,
    recordedBy: payment.recordedBy,
    receiptEmail: null,
    receiptRequestedAt: null,
    receiptEmailSentAt: null,
    receiptErrorClass: null,
    createdAt: payment.paidAt,
    paidAt:payment.paidAt, payerName:null, payerEmail:null, status:"posted", paymentPurpose:payment.paymentKind, providerTransactionId:null, source:"legacy_agreement", notes:payment.notes,
  };
}

export function mergeFacilityPaymentEntries(input: {
  bookingEntries: readonly BookingPaymentEntry[];
  legacyPayments: readonly FacilityLegacyPayment[];
}): BookingPaymentEntry[] {
  const merged = [...input.bookingEntries];
  const matchedLegacy = new Set(matchFacilityPayments(input).values());
  for (const [index, payment] of input.legacyPayments.entries()) {
    if (matchedLegacy.has(index)) continue;
    merged.push(bookingEntryFromLegacyFacilityPayment(payment));
  }
  return merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function mergeFacilityAgreementPayments(input: {
  bookingEntries: readonly BookingPaymentEntry[];
  legacyPayments: readonly FacilityLegacyPayment[];
}): FacilityLegacyPayment[] {
  const merged = [...input.legacyPayments];
  const matches = matchFacilityPayments(input);
  for (const [index, entry] of input.bookingEntries.entries()) {
    if (matches.has(index)) continue;
    const asLegacy: FacilityLegacyPayment = {
      id: entry.id,
      amount: entry.amountCents / 100,
      paymentKind:
        entry.entryType === "facility_deposit" ? "deposit" : "partial",
      paymentMethod: entry.paymentMethod,
      paidAt: entry.createdAt,
      posReceiptNumber: entry.processorReference,
      recordedBy: entry.recordedBy,
      notes: null,
    };
    merged.push(asLegacy);
  }
  return merged.sort((a, b) => a.paidAt.localeCompare(b.paidAt));
}

export function remainingBookingBalanceCents(
  total: number | null,
  paidCents: number,
): number | null {
  if (total === null || !Number.isFinite(total)) return null;
  return Math.max(0, Math.round(total * 100) - paidCents);
}

export function projectBookingPaymentStatus(
  total: number | null,
  entries: readonly Pick<BookingPaymentEntry, "amountCents">[],
): BookingPaymentProjection {
  const paidCents = sumBookingPaymentCents(entries);
  const totalCents =
    total === null || !Number.isFinite(total) ? null : Math.round(total * 100);
  if (totalCents === null) {
    return {
      totalCents,
      paidCents,
      balanceCents: null,
      status: paidCents > 0 ? "partial" : "unknown_total",
    };
  }
  const balanceCents = Math.max(0, totalCents - paidCents);
  const status: BookingPaymentStatus =
    paidCents <= 0
      ? "unpaid"
      : paidCents < totalCents
        ? "partial"
        : paidCents === totalCents
          ? "paid"
          : "overpaid";
  return { totalCents, paidCents, balanceCents, status };
}

export function paymentStatusLabel(status: BookingPaymentStatus): string {
  switch (status) {
    case "unknown_total":
      return "Total not set";
    case "unpaid":
      return "Unpaid";
    case "partial":
      return "Partially paid";
    case "paid":
      return "Paid in full";
    case "overpaid":
      return "Overpaid";
  }
}

export function receiptAuditLabel(
  entry: Pick<
    BookingPaymentEntry,
    "receiptRequestedAt" | "receiptEmailSentAt" | "receiptErrorClass"
  >,
): string {
  if (entry.receiptEmailSentAt) return "receipt emailed";
  if (entry.receiptErrorClass) return `receipt failed (${entry.receiptErrorClass})`;
  if (entry.receiptRequestedAt) return "receipt queued";
  return "receipt not requested";
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

export function normalizeBookingPaymentIdempotencyKey(
  value: unknown,
  bookingId?: string,
): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim();
  if (!key.startsWith(`${BOOKING_PAYMENT_IDEMPOTENCY_PREFIX}:`)) return null;
  const [, keyBookingId, nonce] = key.split(":");
  if (!keyBookingId || !nonce || (bookingId && keyBookingId !== bookingId)) {
    return null;
  }
  return /^[a-zA-Z0-9:._-]{20,160}$/.test(key) ? key : null;
}
