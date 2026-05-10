"use client";

import type { DurationOption } from "@/lib/mockBooking";
import {
  MOCK_SERVICE_FEE,
  estimateGrandTotal,
  estimateRentalSubtotal,
  formatDisplayDate,
} from "@/lib/mockBooking";

type Props = {
  rentalTitle: string;
  startingPrice: number;
  selectedYmd: string | null;
  duration: DurationOption | undefined;
  selectionValid: boolean;
  selectionMessage?: string;
  selectionMessageTone?: "info" | "warn" | "ok";
};

export function BookingSummary({
  rentalTitle,
  startingPrice,
  selectedYmd,
  duration,
  selectionValid,
  selectionMessage,
  selectionMessageTone = "info",
}: Props) {
  const subtotal =
    duration && selectionValid
      ? estimateRentalSubtotal(startingPrice, duration.priceMultiplier)
      : null;
  const total =
    duration && selectionValid
      ? estimateGrandTotal(startingPrice, duration.priceMultiplier)
      : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <h3 className="text-sm font-black uppercase tracking-wide text-cyan-200">
        Estimate
      </h3>
      <p className="mt-2 text-xs text-slate-400">
        Mock pricing only — final quote from Jumping Jax may differ.
      </p>

      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between gap-3 border-b border-white/10 pb-3">
          <dt className="text-slate-400">Rental</dt>
          <dd className="max-w-[60%] text-right font-semibold text-white">
            {rentalTitle}
          </dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-white/10 pb-3">
          <dt className="text-slate-400">Start date</dt>
          <dd className="text-right font-medium text-slate-100">
            {selectedYmd ? formatDisplayDate(selectedYmd) : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-white/10 pb-3">
          <dt className="text-slate-400">Duration</dt>
          <dd className="text-right font-medium text-slate-100">
            {duration?.label ?? "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-white/10 pb-3">
          <dt className="text-slate-400">Rental subtotal</dt>
          <dd className="font-semibold tabular-nums text-white">
            {subtotal != null ? `$${subtotal}` : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-white/10 pb-3">
          <dt className="text-slate-400">Delivery &amp; setup (mock)</dt>
          <dd className="font-semibold tabular-nums text-white">
            {subtotal != null ? `$${MOCK_SERVICE_FEE}` : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3 pt-1">
          <dt className="text-base font-black text-cyan-100">Estimated total</dt>
          <dd className="text-xl font-black tabular-nums text-cyan-300">
            {total != null ? `$${total}` : "—"}
          </dd>
        </div>
      </dl>

      {selectionMessage && (
        <p
          className={`mt-4 rounded-xl border px-3 py-2 text-xs font-medium leading-relaxed ${
            selectionMessageTone === "ok"
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
              : selectionMessageTone === "warn"
                ? "border-amber-400/35 bg-amber-400/10 text-amber-100"
                : "border-white/15 bg-white/5 text-slate-200"
          }`}
          role="status"
        >
          {selectionMessage}
        </p>
      )}
    </div>
  );
}
