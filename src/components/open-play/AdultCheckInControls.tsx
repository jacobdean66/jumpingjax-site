"use client";

import {
  formatCents,
  type AdultPlayMode,
  type PaymentMethodChoice,
  type SelectedAttendeeDraft,
} from "@/lib/open-play/check-in-client";

type Props = {
  attendee: SelectedAttendeeDraft;
  onAdultModeChange: (selectionKey: string, mode: AdultPlayMode) => void;
  onPaymentMethodChange: (selectionKey: string, method: PaymentMethodChoice) => void;
  onPaymentConfirmedChange: (selectionKey: string, confirmed: boolean) => void;
};

export function AdultCheckInControls({
  attendee,
  onAdultModeChange,
  onPaymentMethodChange,
  onPaymentConfirmedChange,
}: Props) {
  const playing = attendee.adultMode === "playing";

  return (
    <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
      <fieldset>
        <legend className="text-sm font-black text-slate-800">Adult attendance</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {([
            ["watching", "Watching — free"],
            ["playing", `Playing — ${formatCents(700)}`],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={attendee.adultMode === mode}
              onClick={() => onAdultModeChange(attendee.selectionKey, mode)}
              className={
                attendee.adultMode === mode
                  ? "min-h-12 rounded-xl border-2 border-sky-600 bg-sky-50 px-3 text-sm font-black text-sky-950"
                  : "min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-800"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {playing ? (
        <>
          <fieldset>
            <legend className="text-sm font-black text-slate-800">How did they pay?</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["cash", "card"] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  aria-pressed={attendee.paymentMethod === method}
                  onClick={() => onPaymentMethodChange(attendee.selectionKey, method)}
                  className={
                    attendee.paymentMethod === method
                      ? "min-h-12 rounded-xl border-2 border-emerald-600 bg-emerald-50 px-3 text-sm font-black capitalize text-emerald-950"
                      : "min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black capitalize text-slate-800"
                  }
                >
                  {method}
                </button>
              ))}
            </div>
          </fieldset>
          <button
            type="button"
            aria-pressed={attendee.paymentConfirmed}
            disabled={attendee.paymentMethod !== "cash" && attendee.paymentMethod !== "card"}
            onClick={() => onPaymentConfirmedChange(attendee.selectionKey, !attendee.paymentConfirmed)}
            className={
              attendee.paymentConfirmed
                ? "min-h-12 w-full rounded-full bg-emerald-600 px-5 text-sm font-black text-white"
                : "min-h-12 w-full rounded-full bg-slate-950 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
            }
          >
            {attendee.paymentConfirmed ? "Adult is paid for ✓" : "Confirm adult is paid for"}
          </button>
        </>
      ) : attendee.adultMode === "watching" ? (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900">
          Watching adults are free. No payment is added to today&apos;s total.
        </p>
      ) : null}
    </div>
  );
}
