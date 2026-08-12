"use client";

import {
  formatCents,
  type ReportSummaryView,
} from "@/lib/open-play/daily-report-client";

type Props = {
  summary: ReportSummaryView;
};

export function DailyReportSummary({ summary }: Props) {
  return (
    <section
      aria-labelledby="daily-report-summary-heading"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="daily-report-summary-heading" className="text-xl font-black text-slate-950">
        Day summary
      </h2>
      <p className="mt-2 text-sm font-semibold text-slate-600">
        Cash and card totals are net retained money after corrections, voids, and
        refunds. Combined total is cash plus card.
      </p>

      <dl className="mt-4 grid gap-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-sm font-bold text-slate-700">Net cash retained</dt>
            <dd className="text-lg font-black text-slate-950">
              {formatCents(summary.cashTotalCents)}
            </dd>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <dt className="text-sm font-bold text-slate-700">Net card retained</dt>
            <dd className="text-lg font-black text-slate-950">
              {formatCents(summary.cardTotalCents)}
            </dd>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-200 pt-2">
            <dt className="text-base font-black text-slate-950">Combined net retained</dt>
            <dd className="text-xl font-black text-slate-950">
              {formatCents(summary.combinedTotalCents)}
            </dd>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-sm font-bold text-slate-700">Total attendance</dt>
            <dd className="text-base font-black text-slate-950">{summary.totalAttendance}</dd>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <dt className="text-sm font-bold text-slate-700">Paid attendance</dt>
            <dd className="text-base font-black text-slate-950">{summary.paidAttendance}</dd>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Paid attendance counts active attendees with a positive net retained
            admission balance. Watching adults and fully refunded attendees are not
            paid attendance.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Child ≤2
            </p>
            <p className="mt-1 text-lg font-black text-slate-950">
              {summary.childrenAge2OrYounger}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Child 3+
            </p>
            <p className="mt-1 text-lg font-black text-slate-950">
              {summary.childrenAge3OrOlder}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Playing
            </p>
            <p className="mt-1 text-lg font-black text-slate-950">{summary.playingAdults}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Watching
            </p>
            <p className="mt-1 text-lg font-black text-slate-950">{summary.watchingAdults}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
              Corrections
            </p>
            <p className="mt-1 text-lg font-black text-amber-950">{summary.corrections}</p>
            <p className="mt-1 text-[11px] font-semibold text-amber-800">
              One method-change operation counts once
            </p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-rose-800">Voids</p>
            <p className="mt-1 text-lg font-black text-rose-950">{summary.voids}</p>
            <p className="mt-1 text-[11px] font-semibold text-rose-800">
              Each void operation counts once
            </p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-sky-800">Refunds</p>
            <p className="mt-1 text-lg font-black text-sky-950">{summary.refunds}</p>
            <p className="mt-1 text-[11px] font-semibold text-sky-800">
              Separate partial refunds count separately
            </p>
          </div>
        </div>
      </dl>
    </section>
  );
}
