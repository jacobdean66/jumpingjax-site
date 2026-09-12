"use client";

import Link from "next/link";

import {
  classificationLabel,
  formatCents,
  type CheckInConflict,
  type SelectedAttendeeDraft,
  type AdmissionClassification,
} from "@/lib/open-play/check-in-client";

type Props = {
  conflicts: CheckInConflict[];
  pendingAttendees: SelectedAttendeeDraft[];
  visitDateYmd: string;
  onKeepExistingAndContinue: (conflict: CheckInConflict) => void;
  onRemovePending: (selectionKey: string) => void;
  onEditName: (conflict: CheckInConflict) => void;
};

export function CheckInConflictPanel({
  conflicts,
  pendingAttendees,
  visitDateYmd,
  onKeepExistingAndContinue,
  onRemovePending,
  onEditName,
}: Props) {
  if (conflicts.length === 0) return null;

  const conflictIds = new Set(conflicts.map((conflict) => conflictSelectionKey(conflict)));
  const remainingCount = pendingAttendees.filter(
    (attendee) => !conflictIds.has(attendee.selectionKey),
  ).length;

  return (
    <section
      aria-labelledby="check-in-conflicts-heading"
      className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm"
      role="alert"
    >
      <h2 id="check-in-conflicts-heading" className="text-lg font-black text-amber-950">
        Already checked in today
      </h2>
      <p className="mt-1 text-sm font-semibold text-amber-900">
        Choose how to handle each conflict. No check-in will be duplicated or undone
        unless you open Corrections and make that change there.
      </p>
      {remainingCount === 0 ? (
        <p className="mt-2 rounded-xl bg-white/70 p-3 text-sm font-bold text-amber-950">
          Everyone in this pending group is already checked in. Confirmation is disabled
          until you remove a conflict or adjust the existing visit in Corrections.
        </p>
      ) : (
        <p className="mt-2 text-sm font-bold text-amber-950">
          {remainingCount} non-conflicting attendee{remainingCount === 1 ? "" : "s"} can
          still be checked in.
        </p>
      )}

      <ul className="mt-3 grid gap-3">
        {conflicts.map((conflict) => (
          <li key={conflict.attendeeId} className="rounded-xl border border-amber-200 bg-white p-3">
            <div className="flex flex-col gap-1">
              <p className="text-base font-black text-slate-950">{conflict.fullName}</p>
              <p className="text-sm font-semibold text-slate-600">
                Existing visit {conflict.visitId.slice(0, 8)} ·{" "}
                {classificationLabel(conflict.classification as AdmissionClassification)} ·{" "}
                {formatCents(conflict.unitPriceCents)}
              </p>
              {conflict.nameCorrected ? (
                <p className="text-xs font-bold text-amber-800">
                  Corrected from {conflict.originalFirstName} {conflict.originalLastName}
                </p>
              ) : null}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={remainingCount === 0}
                onClick={() => onKeepExistingAndContinue(conflict)}
                className="inline-flex min-h-10 items-center justify-center rounded-full bg-emerald-600 px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Keep existing and continue
              </button>
              <button
                type="button"
                onClick={() => onRemovePending(conflictSelectionKey(conflict))}
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-3 text-sm font-black text-slate-800"
              >
                Remove from pending group
              </button>
              <Link
                href={`/admin/open-play-corrections?date=${encodeURIComponent(visitDateYmd)}&visit=${encodeURIComponent(conflict.visitId)}`}
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-3 text-center text-sm font-black text-slate-800"
              >
                Open Corrections
              </Link>
              <button
                type="button"
                onClick={() => onEditName(conflict)}
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-3 text-sm font-black text-slate-800"
              >
                Open Edit name
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function conflictSelectionKey(conflict: CheckInConflict): string {
  return conflict.source === "legacy_smartwaiver"
    ? `legacy:${conflict.legacyParticipantId ?? ""}`
    : conflict.participantId;
}
