"use client";

import {
  formatCents,
  type BirthdayPartyOption,
  type PaymentMethodChoice,
  type SelectedAttendeeDraft,
} from "@/lib/open-play/check-in-client";

type Props = {
  attendee: SelectedAttendeeDraft;
  birthdayParties: BirthdayPartyOption[];
  onPaymentMethodChange: (
    selectionKey: string,
    method: PaymentMethodChoice,
  ) => void;
  onPriceChange: (selectionKey: string, amountCents: number) => void;
  onPaymentConfirmedChange: (selectionKey: string, confirmed: boolean) => void;
  onBirthdayPartyChange: (
    selectionKey: string,
    party: BirthdayPartyOption | null,
  ) => void;
};

export function ChildCheckInControls({
  attendee,
  birthdayParties,
  onPaymentMethodChange,
  onPriceChange,
  onPaymentConfirmedChange,
  onBirthdayPartyChange,
}: Props) {
  const noCharge =
    attendee.paymentMethod === "free_pass" ||
    attendee.paymentMethod === "birthday_party";

  return (
    <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
      <fieldset>
        <legend className="text-sm font-black text-slate-800">Admission amount</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[1000, 700].map((amount) => (
            <button
              key={amount}
              type="button"
              aria-pressed={!noCharge && attendee.priceOverrideCents === amount}
              onClick={() => onPriceChange(attendee.selectionKey, amount)}
              className={
                !noCharge && attendee.priceOverrideCents === amount
                  ? "min-h-12 rounded-xl border-2 border-sky-600 bg-sky-50 text-base font-black text-sky-950"
                  : "min-h-12 rounded-xl border border-slate-300 bg-white text-base font-black text-slate-800"
              }
            >
              {formatCents(amount)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-black text-slate-800">How are they attending?</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {([
            ["cash", "Cash"],
            ["card", "Card"],
            ["free_pass", "Free pass"],
            ["birthday_party", "Birthday party"],
          ] as const).map(([method, label]) => (
            <button
              key={method}
              type="button"
              aria-pressed={attendee.paymentMethod === method}
              onClick={() => onPaymentMethodChange(attendee.selectionKey, method)}
              className={
                attendee.paymentMethod === method
                  ? "min-h-12 rounded-xl border-2 border-emerald-600 bg-emerald-50 px-3 text-sm font-black text-emerald-950"
                  : "min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-800"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {attendee.paymentMethod === "birthday_party" ? (
        <label className="block text-sm font-black text-slate-800">
          Birthday child they are attending
          <select
            value={attendee.birthdayPartyId ?? ""}
            onChange={(event) => {
              const party = birthdayParties.find((item) => item.id === event.target.value) ?? null;
              onBirthdayPartyChange(attendee.selectionKey, party);
            }}
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-bold text-slate-900"
          >
            <option value="">Choose today&apos;s birthday party</option>
            {birthdayParties.map((party) => (
              <option key={party.id} value={party.id}>
                {party.label}
              </option>
            ))}
          </select>
          {birthdayParties.length === 0 ? (
            <span className="mt-2 block text-xs font-semibold text-amber-800">
              No birthday parties are scheduled for today.
            </span>
          ) : null}
        </label>
      ) : null}

      {attendee.paymentMethod === "cash" || attendee.paymentMethod === "card" ? (
        <button
          type="button"
          aria-pressed={attendee.paymentConfirmed}
          disabled={attendee.priceOverrideCents !== 700 && attendee.priceOverrideCents !== 1000}
          onClick={() =>
            onPaymentConfirmedChange(attendee.selectionKey, !attendee.paymentConfirmed)
          }
          className={
            attendee.paymentConfirmed
              ? "min-h-12 w-full rounded-full bg-emerald-600 px-5 text-sm font-black text-white"
              : "min-h-12 w-full rounded-full bg-slate-950 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
          }
        >
          {attendee.paymentConfirmed ? "Child is paid for ✓" : "Confirm child is paid for"}
        </button>
      ) : null}

      {noCharge ? (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900">
          No admission payment is added to today&apos;s cash or card total.
        </p>
      ) : null}
    </div>
  );
}
