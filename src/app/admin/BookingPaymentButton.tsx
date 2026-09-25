"use client";

import { useState } from "react";
import { CreditCard, Mail, X } from "lucide-react";

import {
  FACILITY_DEPOSIT_CENTS,
  formatCents,
  processingFeeCents,
  type BookingPaymentKind,
  type BookingPaymentMethod,
} from "@/lib/payments/booking-payments";
import {
  SWIPESIMPLE_FACILITY_DEPOSIT_URL,
  SWIPESIMPLE_RENTAL_PAYMENT_URL,
} from "@/lib/payments/swipesimple";

type Props = {
  bookingId: string;
  kind: BookingPaymentKind;
  customerEmail: string | null;
  balanceCents: number | null;
};

const methodLabels: Record<BookingPaymentMethod, string> = {
  card: "Card / SwipeSimple",
  cash: "Cash",
  check: "Check",
  other: "Other",
};

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function BookingPaymentButton({
  bookingId,
  kind,
  customerEmail,
  balanceCents,
}: Props) {
  const initialCents =
    kind === "facility"
      ? FACILITY_DEPOSIT_CENTS
      : Math.max(0, balanceCents ?? 0);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(centsToInput(initialCents));
  const [method, setMethod] = useState<BookingPaymentMethod>("card");
  const [reference, setReference] = useState("");
  const [sendReceipt, setSendReceipt] = useState(Boolean(customerEmail));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const parsedCents = /^\d+(?:\.\d{1,2})?$/.test(amount)
    ? Math.round(Number(amount) * 100)
    : 0;
  const feeCents =
    parsedCents > 0 ? processingFeeCents(parsedCents, method) : 0;
  const paymentLink =
    kind === "facility"
      ? SWIPESIMPLE_FACILITY_DEPOSIT_URL
      : SWIPESIMPLE_RENTAL_PAYMENT_URL;

  async function recordPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/admin/bookings/${kind}/${encodeURIComponent(bookingId)}/payments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            paymentMethod: method,
            reference,
            sendReceipt,
          }),
        },
      );
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;
      if (!response.ok || !result?.ok) {
        throw new Error(result?.message || "Payment could not be recorded.");
      }
      setNotice(result.message || "Payment recorded.");
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Payment could not be recorded.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-xs font-black text-white hover:bg-emerald-800"
      >
        <CreditCard className="h-4 w-4" aria-hidden="true" />
        Payment
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-slate-950/60 p-0 sm:items-center sm:justify-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`payment-title-${bookingId}`}
        >
          <form
            onSubmit={recordPayment}
            className="w-full max-w-lg rounded-t-xl bg-white p-5 shadow-2xl sm:rounded-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                  Booking #{bookingId}
                </p>
                <h2
                  id={`payment-title-${bookingId}`}
                  className="mt-1 text-xl font-black text-slate-950"
                >
                  {kind === "facility"
                    ? "Record facility deposit"
                    : "Record rental payment"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
                aria-label="Close payment dialog"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Complete the payment first, then save it here. This adds it to
              this booking&apos;s balance and receipt history.
            </p>
            <a
              href={paymentLink}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-emerald-700 px-4 py-2 text-sm font-black text-emerald-800 hover:bg-emerald-50"
            >
              Open secure {kind === "facility" ? "$50 deposit" : "rental"}{" "}
              checkout
            </a>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Use booking #{bookingId} as the SwipeSimple invoice number.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-black text-slate-800">
                Applied to booking
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  readOnly={kind === "facility"}
                  inputMode="decimal"
                  className="min-h-11 rounded-md border border-slate-300 px-3 font-semibold"
                  aria-label="Payment amount"
                />
              </label>
              <label className="grid gap-1 text-sm font-black text-slate-800">
                Payment method
                <select
                  value={method}
                  onChange={(event) =>
                    setMethod(event.target.value as BookingPaymentMethod)
                  }
                  className="min-h-11 rounded-md border border-slate-300 bg-white px-3 font-semibold"
                >
                  {Object.entries(methodLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 rounded-md bg-slate-100 p-3 text-sm font-bold text-slate-700">
              {method === "card" ? (
                <>
                  Customer card total: {formatCents(parsedCents + feeCents)}{" "}
                  <span className="font-medium">
                    ({formatCents(parsedCents)} applied +{" "}
                    {formatCents(feeCents)}
                    processing fee)
                  </span>
                </>
              ) : (
                <>Payment applied: {formatCents(parsedCents)}</>
              )}
              {balanceCents !== null ? (
                <p className="mt-1 text-xs">
                  Current booking balance before this payment:{" "}
                  {formatCents(balanceCents)}
                </p>
              ) : null}
            </div>
            <label className="mt-4 grid gap-1 text-sm font-black text-slate-800">
              SwipeSimple receipt or reference number
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                maxLength={120}
                className="min-h-11 rounded-md border border-slate-300 px-3 font-semibold"
                placeholder="Optional, but recommended"
              />
            </label>
            <label className="mt-4 flex items-start gap-3 rounded-md border border-slate-200 p-3 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={sendReceipt}
                disabled={!customerEmail}
                onChange={(event) => setSendReceipt(event.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="flex items-center gap-2 font-black">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Email a receipt
                </span>
                <span className="mt-1 block text-xs font-semibold text-slate-500">
                  {customerEmail
                    ? `To ${customerEmail}`
                    : "No customer email is saved on this booking."}
                </span>
              </span>
            </label>
            {notice ? (
              <p
                role="status"
                className="mt-4 text-sm font-bold text-slate-700"
              >
                {notice}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-11 rounded-md border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || parsedCents <= 0}
                className="min-h-11 rounded-md bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : sendReceipt && customerEmail
                    ? "Record payment and email receipt"
                    : "Record payment"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
