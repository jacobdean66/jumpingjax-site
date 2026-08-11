"use client";

import {
  authoritativeVisitTotals,
  formatCents,
  classificationLabel,
  type AdmissionClassification,
  type VisitCreateSuccess,
} from "@/lib/open-play/check-in-client";

type Props = {
  success: VisitCreateSuccess;
  onNewCheckIn: () => void;
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
};

function isAdmissionClassification(
  value: string,
): value is AdmissionClassification {
  return (
    value === "child_2_or_under" ||
    value === "child_3_plus" ||
    value === "playing_adult" ||
    value === "watching_adult"
  );
}

export function CheckInSuccessPanel({
  success,
  onNewCheckIn,
  headingRef,
}: Props) {
  const totals = authoritativeVisitTotals(success);

  return (
    <section
      aria-labelledby="check-in-success-heading"
      className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm"
    >
      <h2
        id="check-in-success-heading"
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-black text-emerald-950 outline-none"
      >
        Check-in complete
      </h2>
      <p className="mt-2 text-sm font-semibold text-emerald-900">
        Visit {success.businessDayYmd}
      </p>

      <ul className="mt-5 grid gap-3">
        {success.attendees.map((attendee) => (
          <li
            key={attendee.attendeeId}
            className="rounded-xl border border-emerald-200 bg-white p-4"
          >
            <p className="text-sm font-semibold text-slate-600">
              {isAdmissionClassification(attendee.classification)
                ? classificationLabel(attendee.classification)
                : attendee.classification}
            </p>
            <p className="mt-1 text-lg font-black text-slate-950">
              {formatCents(attendee.unitPriceCents)}
            </p>
          </li>
        ))}
      </ul>

      <dl className="mt-5 grid gap-2 rounded-xl border border-emerald-200 bg-white p-4 text-sm">
        <div className="flex justify-between gap-3 font-semibold text-slate-700">
          <dt>Cash total</dt>
          <dd>{formatCents(totals.cashTotalCents)}</dd>
        </div>
        <div className="flex justify-between gap-3 font-semibold text-slate-700">
          <dt>Card total</dt>
          <dd>{formatCents(totals.cardTotalCents)}</dd>
        </div>
        <div className="flex justify-between gap-3 text-base font-black text-slate-950">
          <dt>Combined total</dt>
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

      <button
        type="button"
        onClick={onNewCheckIn}
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-black text-white"
      >
        Start new check-in
      </button>
    </section>
  );
}
