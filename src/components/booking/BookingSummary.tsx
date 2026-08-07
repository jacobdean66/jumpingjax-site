"use client";

import { getRentalBySlug } from "@/data/rentals";
import type { DurationOption } from "@/lib/mockBooking";
import {
  formatDisplayDate,
} from "@/lib/mockBooking";
import {
  estimateCartGrandTotal,
  estimateCartRentalSubtotal,
  estimateRentalLineSubtotal,
  estimateMileageFee,
  estimateRentalDeliveryFee,
  normalizeDistanceMiles,
  RENTAL_INCLUDED_DELIVERY_MILES,
  RENTAL_EXTRA_MILE_RATE,
} from "@/lib/rentals/rental-pricing-text";
import type { RentalCartItem } from "@/store/bookingStore";

type Props = {
  cartItems: RentalCartItem[];
  selectedYmd: string | null;
  duration: DurationOption | undefined;
  foamDuration?: DurationOption | undefined;
  selectionValid: boolean;
  selectionMessage?: string;
  selectionMessageTone?: "info" | "warn" | "ok";
  distanceMiles?: string;
};

export function BookingSummary({
  cartItems,
  selectedYmd,
  duration,
  foamDuration,
  selectionValid,
  selectionMessage,
  selectionMessageTone = "info",
  distanceMiles,
}: Props) {
  const durationLabel = duration?.label ?? "";
  const spanDays = duration?.spanDays ?? 1;
  const foamDurationLabel = foamDuration?.label ?? null;
  const showPrices = Boolean(duration && selectionValid);

  const subtotal = showPrices
    ? estimateCartRentalSubtotal(
        cartItems,
        durationLabel,
        spanDays,
        foamDurationLabel,
      )
    : null;
  const normalizedDistanceMiles = normalizeDistanceMiles(distanceMiles);
  const deliveryFee = showPrices
    ? estimateRentalDeliveryFee(normalizedDistanceMiles)
    : null;
  const mileageFee = showPrices
    ? estimateMileageFee(normalizedDistanceMiles)
    : null;
  const total = showPrices
    ? estimateCartGrandTotal(
        cartItems,
        durationLabel,
        spanDays,
        deliveryFee ?? undefined,
        foamDurationLabel,
      )
    : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <h3 className="text-sm font-black uppercase tracking-wide text-cyan-200">
        Estimate
      </h3>
      <p className="mt-2 text-xs text-slate-400">
        Estimate only — final quote from Jumping Jax may differ.
      </p>

      <dl className="mt-4 space-y-3 text-sm">
        {cartItems.map((item) => {
          const rental = getRentalBySlug(item.rental_item);
          const lineEstimate =
            showPrices && rental
              ? estimateRentalLineSubtotal(
                  item,
                  durationLabel,
                  spanDays,
                  foamDurationLabel,
                )
              : null;

          return (
            <div
              key={item.rental_item}
              className="flex justify-between gap-3 border-b border-white/10 pb-3"
            >
              <dt className="text-slate-400">{item.rental_name}</dt>
              <dd className="max-w-[50%] text-right font-semibold tabular-nums text-white">
                {lineEstimate != null ? `$${lineEstimate}` : "—"}
              </dd>
            </div>
          );
        })}
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
        {foamDurationLabel && (
          <div className="flex justify-between gap-3 border-b border-white/10 pb-3">
            <dt className="text-slate-400">Foam time</dt>
            <dd className="text-right font-medium text-slate-100">
              {foamDurationLabel}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-3 border-b border-white/10 pb-3">
          <dt className="text-slate-400">Rental subtotal</dt>
          <dd className="font-semibold tabular-nums text-white">
            {subtotal != null ? `$${subtotal}` : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-white/10 pb-3">
          <dt className="text-slate-400">Delivery &amp; setup</dt>
          <dd className="font-semibold tabular-nums text-white">
            {deliveryFee != null ? `$${deliveryFee}` : "—"}
          </dd>
        </div>
        {showPrices && (
          <div className="flex justify-between gap-3 border-b border-white/10 pb-3 text-xs">
            <dt className="text-slate-500">
              Mileage after {RENTAL_INCLUDED_DELIVERY_MILES} miles at $
              {RENTAL_EXTRA_MILE_RATE}/mile
            </dt>
            <dd className="text-right font-semibold tabular-nums text-slate-300">
              {normalizedDistanceMiles != null && mileageFee != null
                ? `$${mileageFee}`
                : "Confirmed after review"}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-3 pt-1">
          <dt className="text-base font-black text-cyan-100">
            Estimated total (tax included)
          </dt>
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
