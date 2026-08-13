"use client";

import {
  attendeeRequiresPaymentMethod,
  formatCents,
  isAdultRole,
  previewAdmissionPrice,
  type AdultPlayMode,
  type PaymentMethodChoice,
  type SelectedAttendeeDraft,
} from "@/lib/open-play/check-in-client";

type Props = {
  attendees: SelectedAttendeeDraft[];
  visitDateYmd: string;
  onRemove: (selectionKey: string) => void;
  onAdultModeChange: (selectionKey: string, mode: AdultPlayMode) => void;
  onPaymentMethodChange: (
    selectionKey: string,
    method: PaymentMethodChoice | null,
  ) => void;
  onPriceChange: (selectionKey: string, amountCents: number | null) => void;
};

export function CheckInGroupPanel({
  attendees,
  visitDateYmd,
  onRemove,
  onAdultModeChange,
  onPaymentMethodChange,
  onPriceChange,
}: Props) {
  if (attendees.length === 0) {
    return (
      <section
        aria-labelledby="check-in-group-heading"
        className="rounded-2xl border border-dashed border-slate-300 bg-white p-4"
      >
        <h2 id="check-in-group-heading" className="text-lg font-black text-slate-950">
          Today’s group
        </h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          Selected guests will appear here. You can search again without losing
          this group.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="check-in-group-heading"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="check-in-group-heading" className="text-lg font-black text-slate-950">
          Today’s group
        </h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
          {attendees.length}
        </span>
      </div>

      <ul className="mt-4 grid gap-4">
        {attendees.map((attendee) => {
          const preview = previewAdmissionPrice({
            role: attendee.role,
            birthYear: attendee.birthYear,
            visitDateYmd,
            adultMode: attendee.adultMode,
          });
          const adult = isAdultRole(attendee.role);
          const needsPayment = attendeeRequiresPaymentMethod(preview);
          const isFree =
            !preview.uncertain &&
            preview.unitPriceCents !== null &&
            preview.unitPriceCents === 0;

          return (
            <li
              key={attendee.selectionKey}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-black text-slate-950">
                    {attendee.fullName}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    Born {attendee.birthYear}
                    {attendee.signerLastInitial
                      ? ` · Signer ${attendee.signerLastInitial}.`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(attendee.selectionKey)}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white px-3 text-sm font-black text-slate-700"
                >
                  Remove
                </button>
              </div>

              {adult ? (
                <fieldset className="mt-4">
                  <legend className="text-sm font-bold text-slate-700">
                    Attendance
                  </legend>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label
                      className={
                        attendee.adultMode === "playing"
                          ? "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 border-sky-500 bg-sky-50 px-3 py-2"
                          : "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                      }
                    >
                      <input
                        type="radio"
                        className="h-5 w-5"
                        name={`adult-mode-${attendee.selectionKey}`}
                        checked={attendee.adultMode === "playing"}
                        onChange={() =>
                          onAdultModeChange(attendee.selectionKey, "playing")
                        }
                      />
                      <span className="text-sm font-bold text-slate-800">
                        Playing adult — {formatCents(700)}
                      </span>
                    </label>
                    <label
                      className={
                        attendee.adultMode === "watching"
                          ? "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 border-sky-500 bg-sky-50 px-3 py-2"
                          : "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                      }
                    >
                      <input
                        type="radio"
                        className="h-5 w-5"
                        name={`adult-mode-${attendee.selectionKey}`}
                        checked={attendee.adultMode === "watching"}
                        onChange={() =>
                          onAdultModeChange(attendee.selectionKey, "watching")
                        }
                      />
                      <span className="text-sm font-bold text-slate-800">
                        Watching adult — free
                      </span>
                    </label>
                  </div>
                </fieldset>
              ) : (
                <label className="mt-4 block rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-black text-sky-950">
                  Admission price
                  <span className="mt-2 flex min-h-11 items-center rounded-lg border border-sky-300 bg-white px-3">
                    <span>$</span>
                    <input
                      type="number"
                      min="0"
                      max="500"
                      step="0.01"
                      inputMode="decimal"
                      disabled={attendee.paymentMethod === "free_pass"}
                      value={
                        attendee.paymentMethod === "free_pass"
                          ? "0.00"
                          : attendee.priceOverrideCents === null
                            ? preview.unitPriceCents === null
                              ? ""
                              : (preview.unitPriceCents / 100).toFixed(2)
                            : (attendee.priceOverrideCents / 100).toFixed(2)
                      }
                      placeholder={preview.uncertain ? "$7.00 or $10.00" : undefined}
                      onChange={(event) => {
                        const value = event.target.value;
                        onPriceChange(
                          attendee.selectionKey,
                          value === "" ? null : Math.round(Number(value) * 100),
                        );
                      }}
                      className="min-h-9 w-full bg-transparent px-2 text-base font-black outline-none disabled:text-slate-500"
                    />
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-sky-800">
                    Default from the waiver birthday; edit it when needed.
                  </span>
                </label>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-base font-black text-slate-950">
                  {attendee.paymentMethod === "free_pass"
                    ? "Free pass"
                    : attendee.priceOverrideCents !== null
                      ? formatCents(attendee.priceOverrideCents)
                      : preview.unitPriceCents !== null
                    ? formatCents(preview.unitPriceCents)
                    : preview.label}
                </p>
                {preview.uncertain ? (
                  <p className="text-xs font-semibold text-amber-800">
                    Final child price confirmed by the server
                  </p>
                ) : null}
              </div>

              {needsPayment ? (
                <fieldset className="mt-3">
                  <legend className="text-sm font-bold text-slate-700">
                    Payment method
                  </legend>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(["cash", "card", "free_pass"] as const).map((method) => (
                      <label
                        key={method}
                        className={
                          attendee.paymentMethod === method
                            ? "flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-emerald-500 bg-emerald-50 px-3 text-sm font-black capitalize text-emerald-900"
                            : "flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black capitalize text-slate-800"
                        }
                      >
                        <input
                          type="radio"
                          className="h-5 w-5"
                          name={`pay-${attendee.selectionKey}`}
                          checked={attendee.paymentMethod === method}
                          onChange={() =>
                            onPaymentMethodChange(attendee.selectionKey, method)
                          }
                        />
                        {method === "free_pass" ? "Free pass" : method}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              {isFree ? (
                <p className="mt-3 text-sm font-semibold text-emerald-800">
                  No payment required
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
