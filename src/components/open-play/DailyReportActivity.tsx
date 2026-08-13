"use client";

import { useState } from "react";

import {
  attendeeStatusLabel,
  classificationLabel,
  formatCents,
  formatSignedCents,
  sortVisitsForDisplay,
  toLedgerActivityRows,
  visitStatusLabel,
  type DailyReport,
} from "@/lib/open-play/daily-report-client";

type Props = {
  report: DailyReport;
};

export function DailyReportActivity({ report }: Props) {
  const visits = sortVisitsForDisplay(report);
  const checkedIn = visits.flatMap((visit) =>
    visit.status === "voided"
      ? []
      : visit.attendees.filter((attendee) => attendee.status === "active"),
  );
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

  if (visits.length === 0) {
    return (
      <section
        id="todays-check-ins"
        aria-labelledby="daily-report-activity-heading"
        className="scroll-mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-4"
      >
        <h2 id="daily-report-activity-heading" className="text-xl font-black text-slate-950">
          Visit activity
        </h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          No visits recorded for this date.
        </p>
      </section>
    );
  }

  function toggle(visitId: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(visitId)) next.delete(visitId);
      else next.add(visitId);
      return next;
    });
  }

  return (
    <section
      id="todays-check-ins"
      aria-labelledby="daily-report-activity-heading"
      className="scroll-mt-4 space-y-3"
    >
      <h2 id="daily-report-activity-heading" className="text-xl font-black text-slate-950">
        Today&apos;s check-ins
      </h2>
      <p className="text-sm font-semibold text-slate-600">
        Everyone checked in for this business day. Expand a visit for attendee,
        payment, and correction details.
      </p>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {checkedIn.map((attendee) => (
          <li
            key={attendee.id}
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"
          >
            <p className="font-black text-slate-950">
              {attendee.fullName ?? "Unknown attendee"}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Age {attendee.ageYearsOnVisit ?? "—"}
            </p>
          </li>
        ))}
      </ul>

      <ul className="grid gap-3">
        {visits.map((visit) => {
          const open = openIds.has(visit.visitId);
          const ledger = toLedgerActivityRows(visit.payments ?? []);
          const panelId = `visit-panel-${visit.visitId}`;
          return (
            <li
              key={visit.visitId}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <button
                type="button"
                className="flex min-h-12 w-full items-start justify-between gap-3 text-left"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => toggle(visit.visitId)}
              >
                <div className="min-w-0">
                  <p className="text-base font-black text-slate-950">
                    Visit {visit.visitId.slice(0, 8)}…
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {visitStatusLabel(visit.status)}
                    {" · "}
                    {new Intl.DateTimeFormat("en-US", {
                      timeZone: "America/New_York",
                      hour: "numeric",
                      minute: "2-digit",
                      timeZoneName: "short",
                    }).format(new Date(visit.createdAt))}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    Net {formatCents(visit.combinedTotalCents)} · Cash{" "}
                    {formatCents(visit.cashTotalCents)} · Card{" "}
                    {formatCents(visit.cardTotalCents)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {visit.attendees.length} attendee
                    {visit.attendees.length === 1 ? "" : "s"} · {ledger.length} ledger
                    entr{ledger.length === 1 ? "y" : "ies"}
                  </p>
                  <p className="mt-1 text-xs font-black uppercase tracking-wide text-amber-800">
                    {visit.source === "legacy_smartwaiver"
                      ? "Legacy Smartwaiver"
                      : "Native waiver"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700">
                  {open ? "Hide" : "Details"}
                </span>
              </button>

              {open ? (
                <div id={panelId} className="mt-4 space-y-4 border-t border-slate-200 pt-4">
                  {visit.notes ? (
                    <p className="text-sm font-semibold text-slate-600">Notes: {visit.notes}</p>
                  ) : null}

                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">
                      Attendees
                    </h3>
                    <ul className="mt-2 grid gap-2">
                      {visit.attendees.map((attendee) => (
                        <li
                          key={attendee.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                        >
                          <p className="text-base font-black text-slate-950">
                            {attendee.fullName ?? "Unknown attendee"}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-600">
                            Age {attendee.ageYearsOnVisit ?? "—"} ·{" "}
                            {classificationLabel(attendee.classification)}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-600">
                            {attendeeStatusLabel(attendee.status)} · Unit price{" "}
                            {formatCents(attendee.unitPriceCents)}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            Attendee {attendee.id.slice(0, 8)}…
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">
                      Payment ledger
                    </h3>
                    {ledger.length === 0 ? (
                      <p className="mt-2 text-sm font-semibold text-slate-500">
                        No payment entries for this visit.
                      </p>
                    ) : (
                      <ul className="mt-2 grid gap-2">
                        {ledger.map((entry) => (
                          <li
                            key={entry.id}
                            className={
                              entry.isOriginal
                                ? "rounded-xl border border-slate-200 bg-white p-3"
                                : "rounded-xl border border-amber-200 bg-amber-50 p-3"
                            }
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-black text-slate-950">
                                  {entry.entryTypeLabel}
                                </p>
                                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  {entry.isOriginal ? "Original entry" : "Adjustment entry"}
                                </p>
                              </div>
                              <p className="shrink-0 text-base font-black text-slate-950">
                                {formatSignedCents(entry.amountCents)}
                              </p>
                            </div>
                            <p className="mt-2 text-sm font-semibold capitalize text-slate-700">
                              {entry.method}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {entry.createdAtLabel}
                            </p>
                            {entry.relatedEntryId ? (
                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                Related entry {entry.relatedEntryId.slice(0, 8)}…
                              </p>
                            ) : null}
                            {entry.attendeeId ? (
                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                Attendee {entry.attendeeId.slice(0, 8)}…
                              </p>
                            ) : null}
                            {entry.reason ? (
                              <p className="mt-2 text-sm font-semibold text-slate-700">
                                Reason: {entry.reason}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
