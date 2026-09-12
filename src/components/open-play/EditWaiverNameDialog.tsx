"use client";

import { useState } from "react";

import {
  saveWaiverParticipantNameCorrection,
  type NameCorrectionSuccess,
} from "@/lib/open-play/check-in-client";

export type EditableWaiverName = {
  participantId: string;
  legacyParticipantId?: string;
  source?: "native" | "legacy_smartwaiver";
  firstName: string;
  lastName: string;
  fullName: string;
  originalFirstName: string;
  originalLastName: string;
  nameCorrected: boolean;
};

type Props = {
  target: EditableWaiverName | null;
  onClose: () => void;
  onSaved: (correction: NameCorrectionSuccess["correction"]) => void;
};

export function EditWaiverNameDialog({ target, onClose, onSaved }: Props) {
  if (!target) return null;

  return (
    <EditWaiverNameDialogContent
      key={`${target.participantId}:${target.fullName}`}
      target={target}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function EditWaiverNameDialogContent({
  target,
  onClose,
  onSaved,
}: Props & { target: EditableWaiverName }) {
  const [firstName, setFirstName] = useState(target.firstName);
  const [lastName, setLastName] = useState(target.lastName);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signedName = `${target.originalFirstName} ${target.originalLastName}`.trim();
  const nextName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const unchanged =
    target.firstName.trim().toLowerCase() === firstName.trim().toLowerCase() &&
    target.lastName.trim().toLowerCase() === lastName.trim().toLowerCase();

  async function submit() {
    if (!target || saving) return;
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (!reason.trim()) {
      setError("Correction reason is required.");
      return;
    }
    if (unchanged) {
      setError("Enter a new corrected name before saving.");
      return;
    }
    const ok = window.confirm(
      `Save corrected display/search name "${nextName}" for ${target.fullName}? The signed waiver document will not be changed.`,
    );
    if (!ok) return;

    setSaving(true);
    try {
      const correction = await saveWaiverParticipantNameCorrection({
        participantId: target.participantId,
        legacyParticipantId: target.legacyParticipantId,
        source: target.source,
        firstName,
        lastName,
        reason,
      });
      onSaved(correction);
      onClose();
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message)
          : "Name correction failed. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-4 sm:items-center sm:justify-center"
      role="presentation"
    >
      <section
        aria-labelledby="edit-waiver-name-heading"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="edit-waiver-name-heading" className="text-xl font-black text-slate-950">
              Edit name
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Signed name: {signedName || target.fullName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm font-black text-slate-700 disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-bold text-slate-700">
            First name
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              disabled={saving}
              maxLength={80}
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-base outline-none focus:border-sky-500 disabled:opacity-60"
            />
          </label>
          <label className="block text-sm font-bold text-slate-700">
            Last name
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              disabled={saving}
              maxLength={80}
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-base outline-none focus:border-sky-500 disabled:opacity-60"
            />
          </label>
        </div>

        <label className="mt-3 block text-sm font-bold text-slate-700">
          Correction reason
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={saving}
            maxLength={500}
            rows={3}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base outline-none focus:border-sky-500 disabled:opacity-60"
          />
        </label>

        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          This changes only the staff display/search name. The original signed waiver
          and stored document remain unchanged.
        </p>

        {error ? (
          <p className="mt-3 text-sm font-semibold text-rose-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-black text-slate-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save name"}
          </button>
        </div>
      </section>
    </div>
  );
}
