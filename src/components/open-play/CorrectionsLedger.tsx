"use client";

import {
  attendeeStatusLabel,
  classificationLabel,
  entryTypeLabel,
  formatCents,
  formatSignedCents,
  formatTimestamp,
  isOriginalEntry,
  sortLedgerEntries,
  visitStatusLabel,
  type VisitReportRow,
} from "@/lib/open-play/corrections-client";

type Props = {
  visit: VisitReportRow;
};

export function CorrectionsLedger({ visit }: Props) {
  const ledger = sortLedgerEntries(visit.payments ?? []);

  return (
    <section
      aria-labelledby="corrections-ledger-heading"
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div>
        <h2 id="corrections-ledger-heading" className="text-xl font-black text-slate-950">
          Visit ledger
        </h2>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          {visitStatusLabel(visit.status)} · Net {formatCents(visit.combinedTotalCents)} · Cash{" "}
          {formatCents(visit.cashTotalCents)} · Card {formatCents(visit.cardTotalCents)}
        </p>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          Visit {visit.visitId}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Attendees</h3>
        <ul className="mt-2 grid gap-2">
          {(visit.attendees ?? []).map((attendee) => (
            <li
              key={attendee.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <p className="text-sm font-black text-slate-950">
                {classificationLabel(attendee.classification)}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                {attendeeStatusLabel(attendee.status)} · Unit {formatCents(attendee.unitPriceCents)}
              </p>
              <p className="mt-1 break-all text-xs font-semibold text-slate-500">
                Attendee {attendee.id}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">
          Payment entries
        </h3>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          Original charges and later adjustments remain visible.
        </p>
        {ledger.length === 0 ? (
          <p className="mt-2 text-sm font-semibold text-slate-500">No payment entries.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {ledger.map((entry) => {
              const original = isOriginalEntry(entry);
              return (
                <li
                  key={entry.id}
                  className={
                    original
                      ? "rounded-xl border border-slate-200 bg-white p-3"
                      : "rounded-xl border border-amber-200 bg-amber-50 p-3"
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-950">
                        {entryTypeLabel(entry.entryType)}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {original ? "Original entry" : "Adjustment entry"}
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
                    {formatTimestamp(entry.createdAt)}
                  </p>
                  <p className="mt-1 break-all text-xs font-semibold text-slate-500">
                    Entry {entry.id}
                  </p>
                  {entry.relatedEntryId ? (
                    <p className="mt-1 break-all text-xs font-semibold text-slate-500">
                      Related {entry.relatedEntryId}
                    </p>
                  ) : null}
                  {entry.attendeeId ? (
                    <p className="mt-1 break-all text-xs font-semibold text-slate-500">
                      Attendee {entry.attendeeId}
                    </p>
                  ) : null}
                  {entry.reason ? (
                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      Reason: {entry.reason}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
