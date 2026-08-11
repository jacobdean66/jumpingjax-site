"use client";

import {
  attendeeRequiresPaymentMethod,
  formatCents,
  isAdultRole,
  previewAdmissionPrice,
  type GroupTotalsPreview,
  type SelectedAttendeeDraft,
} from "@/lib/open-play/check-in-client";

type Props = {
  visitDateYmd: string;
  attendees: SelectedAttendeeDraft[];
  totals: GroupTotalsPreview;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: () => void;
  errorRef?: React.RefObject<HTMLDivElement | null>;
};

export function CheckInReviewPanel({
  visitDateYmd,
  attendees,
  totals,
  submitting,
  error,
  onBack,
  onSubmit,
  errorRef,
}: Props) {
  return (
    <section
      aria-labelledby="check-in-review-heading"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="check-in-review-heading" className="text-2xl font-black text-slate-950">
        Review check-in
      </h2>
      <p className="mt-2 text-sm font-semibold text-slate-600">
        Visit date {visitDateYmd}. Amounts below are expected; the server result
        is final.
      </p>

      <ul className="mt-5 grid gap-3">
        {attendees.map((attendee) => {
          const preview = previewAdmissionPrice({
            role: attendee.role,
            birthYear: attendee.birthYear,
            visitDateYmd,
            adultMode: attendee.adultMode,
          });
          return (
            <li
              key={attendee.participantId}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <p className="text-lg font-black text-slate-950">{attendee.fullName}</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                {isAdultRole(attendee.role)
                  ? attendee.adultMode === "playing"
                    ? "Playing adult"
                    : attendee.adultMode === "watching"
                      ? "Watching adult"
                      : "Adult — choose attendance"
                  : preview.label}
              </p>
              <p className="mt-2 text-base font-black text-slate-950">
                {preview.unitPriceCents !== null
                  ? formatCents(preview.unitPriceCents)
                  : preview.uncertain
                    ? preview.label
                    : "Confirmed at check-in"}
                {attendeeRequiresPaymentMethod(preview)
                  ? ` · ${attendee.paymentMethod ?? "payment needed"}`
                  : preview.unitPriceCents === 0
                    ? " · free"
                    : ""}
              </p>
            </li>
          );
        })}
      </ul>

      <dl className="mt-5 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <div className="flex justify-between gap-3 font-semibold text-slate-700">
          <dt>Expected cash</dt>
          <dd>{formatCents(totals.cashTotalCents)}</dd>
        </div>
        <div className="flex justify-between gap-3 font-semibold text-slate-700">
          <dt>Expected card</dt>
          <dd>{formatCents(totals.cardTotalCents)}</dd>
        </div>
        <div className="flex justify-between gap-3 text-base font-black text-slate-950">
          <dt>Expected combined</dt>
          <dd>{formatCents(totals.combinedTotalCents)}</dd>
        </div>
        <div className="flex justify-between gap-3 font-semibold text-slate-700">
          <dt>Paid attendance</dt>
          <dd>{totals.paidAttendanceCount}</dd>
        </div>
        <div className="flex justify-between gap-3 font-semibold text-slate-700">
          <dt>Total attendance</dt>
          <dd>{totals.totalAttendanceCount}</dd>
        </div>
      </dl>

      {totals.hasUncertainPrices ? (
        <p className="mt-3 text-sm font-semibold text-amber-800">
          One or more child prices will be confirmed by the server at submission.
        </p>
      ) : null}

      {error ? (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800 outline-none"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={submitting}
          onClick={onSubmit}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Checking in…" : "Confirm check-in"}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onBack}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-black text-slate-800 disabled:opacity-50"
        >
          Back to edit group
        </button>
      </div>
    </section>
  );
}
