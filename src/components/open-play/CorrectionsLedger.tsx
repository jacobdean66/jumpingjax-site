"use client";

import {
  type EditableWaiverName,
} from "@/components/open-play/EditWaiverNameDialog";
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
  onEditName?: (attendee: EditableWaiverName) => void;
};

export function CorrectionsLedger({ visit, onEditName }: Props) {
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
          {(visit.attendees ?? []).map((attendee) => {
            const editableName: EditableWaiverName | null =
              attendee.participantId && attendee.fullName
                ? {
                    participantId: attendee.participantId,
                    firstName: attendee.firstName ?? "",
                    lastName: attendee.lastName ?? "",
                    fullName: attendee.fullName,
                    originalFirstName: attendee.originalFirstName ?? attendee.firstName ?? "",
                    originalLastName: attendee.originalLastName ?? attendee.lastName ?? "",
                    nameCorrected: attendee.nameCorrected === true,
                  }
                : null;
            return (
            <li
              key={attendee.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <p className="text-sm font-black text-slate-950">
                {attendee.fullName || "Unnamed attendee"}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                {classificationLabel(attendee.classification)} ·{" "}
                {attendeeStatusLabel(attendee.status)} · Unit {formatCents(attendee.unitPriceCents)}
              </p>
              {attendee.nameCorrected ? (
                <p className="mt-1 text-xs font-bold text-amber-800">
                  Corrected from {attendee.originalFirstName} {attendee.originalLastName}
                </p>
              ) : null}
              <p className="mt-1 break-all text-xs font-semibold text-slate-500">
                Attendee {attendee.id}
              </p>
              {onEditName && editableName ? (
                <button
                  type="button"
                  onClick={() => onEditName(editableName)}
                  className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-full border border-slate-300 bg-white px-3 text-sm font-black text-slate-800"
                >
                  Edit name
                </button>
              ) : null}
            </li>
            );
          })}
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
