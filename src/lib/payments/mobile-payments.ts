import { dollarsToCents } from "./booking-payments";

export type MobilePaymentInput = {
  requestId: string;
  reference: string;
  payerName: string;
  paidAt: string;
  amountCents: number;
  feeCents: number;
  bookingKind: "facility" | "rental" | null;
  bookingId: string | null;
  purpose: "deposit" | "payment" | "balance";
};

export function parseMobilePayment(body: unknown, now = Date.now()): MobilePaymentInput {
  if (!body || typeof body !== "object") throw new Error("Enter the payment details.");
  const b = body as Record<string, unknown>;
  const string = (key: string) => typeof b[key] === "string" ? b[key].trim() : "";
  const requestId = string("requestId");
  const reference = string("reference");
  const payerName = string("payerName");
  const paidAt = string("paidAt");
  const amountCents = dollarsToCents(b.amount);
  const feeText = string("fee") || "0";
  const feeCents = /^0(?:\.0{1,2})?$/.test(feeText) ? 0 : dollarsToCents(feeText);
  const kind = string("bookingKind");
  const bookingId = string("bookingId") || null;
  const purpose = string("purpose");
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(requestId)) throw new Error("Refresh the page and try again.");
  if (!/^[a-z0-9-]{1,120}$/i.test(reference)) throw new Error("Enter the full SwipeSimple transaction number from the approved receipt.");
  if (!payerName || payerName.length > 160) throw new Error("Enter the name of the person who paid (up to 160 characters).");
  if (!paidAt || !/(Z|[+-]\d{2}:\d{2})$/.test(paidAt) || !Number.isFinite(Date.parse(paidAt)) || Date.parse(paidAt) > now + 300000) throw new Error("Enter the actual payment date and time.");
  if (!amountCents || amountCents > 10000000 || feeCents === null || feeCents > amountCents) throw new Error("Enter the amount paid before any card fee and the actual fee shown on the receipt.");
  if (kind && kind !== "facility" && kind !== "rental") throw new Error("Choose a valid booking type.");
  if (Boolean(kind) !== Boolean(bookingId) || (bookingId && !/^[a-z0-9-]{1,80}$/i.test(bookingId))) throw new Error("Select and verify the booking before saving.");
  if (!["deposit", "payment", "balance"].includes(purpose)) throw new Error("Choose the payment purpose.");
  if (kind === "facility" && purpose === "deposit" && amountCents !== 5000) throw new Error("Facility deposits are $50 before the card fee. Choose Payment or Balance for other amounts.");
  if (b.approved !== true) throw new Error("Confirm that SwipeSimple approved this payment. Pending offline payments cannot be recorded yet.");
  return { requestId, reference, payerName, paidAt: new Date(paidAt).toISOString(), amountCents, feeCents,
    bookingKind: kind as MobilePaymentInput["bookingKind"] || null, bookingId, purpose: purpose as MobilePaymentInput["purpose"] };
}

export const MOBILE_PAYMENT_MESSAGES: Record<string, string> = {
  conflict: "This transaction number or save request already has different details. Check the existing payment before trying again.",
  reference_exists: "This receipt is already recorded with different booking details. Check its existing booking payment.",
  ambiguous_reference: "More than one recorded payment uses this transaction number. Review those records before saving.",
  deposit_exists: "This booking already has a deposit. Review it or select Payment or Balance for an additional payment.",
  inactive_booking: "This booking is unavailable or no longer active.",
  invalid: "Check the payment details and try again.",
};
