"use client";

import { useMemo, useState } from "react";

import {
  buildMethodCorrectionPayload,
  buildRefundPayload,
  buildRemoveAttendeePayload,
  buildVoidPayload,
  chargeActionBlockedReason,
  dollarsInputToCents,
  formatCents,
  listOriginalCharges,
  toChargeActionView,
  type CorrectionPayload,
  type PaymentMethod,
  type VisitReportRow,
} from "@/lib/open-play/corrections-client";

type Props = {
  visit: VisitReportRow;
  disabled: boolean;
  disabledReason?: "submitting" | "needs_reload" | null;
  onSubmit: (payload: CorrectionPayload, label: string) => void;
};

type ActionKind = "method" | "refund" | "void" | "remove";

export function CorrectionActionPanel({
  visit,
  disabled,
  disabledReason = null,
  onSubmit,
}: Props) {
  const charges = useMemo(() => listOriginalCharges(visit.payments ?? []), [visit.payments]);
  const activeAttendees = useMemo(
    () => (visit.attendees ?? []).filter((item) => item.status === "active"),
    [visit.attendees],
  );

  const [action, setAction] = useState<ActionKind>("refund");
  const [chargeId, setChargeId] = useState(charges[0]?.id ?? "");
  const [toMethod, setToMethod] = useState<PaymentMethod>("card");
  const [refundDollars, setRefundDollars] = useState("");
  const [reason, setReason] = useState("");
  const [attendeeId, setAttendeeId] = useState(activeAttendees[0]?.id ?? "");
  const [alsoRemoveAttendee, setAlsoRemoveAttendee] = useState(false);
  const [confirmDestructive, setConfirmDestructive] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const selectedCharge = charges.find((item) => item.id === chargeId) ?? null;
  const chargeView = selectedCharge
    ? toChargeActionView(visit.payments ?? [], selectedCharge)
    : null;

  const visitLocked = visit.status === "voided";

  const actionBlockedReason = (() => {
    if (visitLocked) return null;
    if (action === "remove") {
      return activeAttendees.length === 0
        ? "No active attendees are available to remove."
        : null;
    }
    if (charges.length === 0) {
      return "This visit has no original charges to correct.";
    }
    if (!chargeView) return "Select an original charge.";
    return chargeActionBlockedReason(chargeView, action);
  })();

  function submit() {
    setLocalError(null);
    try {
      if (visitLocked) {
        setLocalError("Voided visits cannot accept corrections.");
        return;
      }
      if (actionBlockedReason) {
        setLocalError(actionBlockedReason);
        return;
      }
      if (action === "remove") {
        if (!confirmDestructive) {
          setLocalError("Confirm attendee removal before submitting.");
          return;
        }
        onSubmit(
          buildRemoveAttendeePayload({
            attendeeId,
            reason,
            relatedEntryId: null,
          }),
          "Remove attendee",
        );
        return;
      }

      if (!selectedCharge || !chargeView) {
        setLocalError("Select an original charge.");
        return;
      }

      if (action === "method") {
        onSubmit(
          buildMethodCorrectionPayload({
            relatedEntryId: selectedCharge.id,
            fromMethod: selectedCharge.method,
            toMethod,
            amountCents: selectedCharge.amountCents,
            reason,
            attendeeId: selectedCharge.attendeeId,
          }),
          "Payment-method correction",
        );
        return;
      }

      if (action === "refund") {
        const cents = dollarsInputToCents(refundDollars);
        if (cents == null) {
          setLocalError("Enter a valid refund amount greater than zero.");
          return;
        }
        if (cents > chargeView.remainingCents) {
          setLocalError(
            `Refund cannot exceed the remaining balance of ${formatCents(chargeView.remainingCents)}.`,
          );
          return;
        }
        onSubmit(
          buildRefundPayload({
            relatedEntryId: selectedCharge.id,
            method: chargeView.effectiveMethod,
            amountCents: cents,
            reason,
            attendeeId: selectedCharge.attendeeId,
          }),
          "Refund",
        );
        return;
      }

      if (action === "void") {
        if (!confirmDestructive) {
          setLocalError("Confirm the void before submitting.");
          return;
        }
        onSubmit(
          buildVoidPayload({
            relatedEntryId: selectedCharge.id,
            reason,
            attendeeId: selectedCharge.attendeeId,
            removeAttendeeId: alsoRemoveAttendee
              ? selectedCharge.attendeeId
              : null,
          }),
          "Void charge",
        );
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Invalid correction request.");
    }
  }

  return (
    <section
      aria-labelledby="corrections-actions-heading"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="corrections-actions-heading" className="text-xl font-black text-slate-950">
        Apply correction
      </h2>
      <p className="mt-2 text-sm font-semibold text-slate-600">
        Server results are authoritative. Method corrections are accounting adjustments, not new
        charges.
      </p>

      {visitLocked ? (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">
          This visit is voided. Corrections are not available.
        </p>
      ) : null}

      <fieldset className="mt-4" disabled={disabled || visitLocked}>
        <legend className="text-sm font-bold text-slate-700">Operation</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              ["refund", "Refund"],
              ["method", "Method change"],
              ["void", "Void charge"],
              ["remove", "Remove attendee"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex min-h-12 items-center justify-center rounded-xl border px-3 text-sm font-black ${
                action === value
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-800"
              }`}
            >
              <input
                type="radio"
                name="correction-action"
                value={value}
                checked={action === value}
                onChange={() => {
                  setAction(value);
                  setConfirmDestructive(false);
                  setLocalError(null);
                }}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {action !== "remove" ? (
        <label className="mt-4 block text-sm font-bold text-slate-700">
          Original charge
          <select
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base"
            value={chargeId}
            disabled={disabled || visitLocked || charges.length === 0}
            onChange={(event) => setChargeId(event.target.value)}
          >
            {charges.length === 0 ? <option value="">No charges</option> : null}
            {charges.map((entry) => {
              const view = toChargeActionView(visit.payments ?? [], entry);
              return (
                <option key={entry.id} value={entry.id}>
                  {formatCents(entry.amountCents)} {entry.method}
                  {view.voided ? " (voided)" : ` · remain ${formatCents(view.remainingCents)}`}
                </option>
              );
            })}
          </select>
        </label>
      ) : (
        <label className="mt-4 block text-sm font-bold text-slate-700">
          Active attendee
          <select
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base"
            value={attendeeId}
            disabled={disabled || visitLocked || activeAttendees.length === 0}
            onChange={(event) => setAttendeeId(event.target.value)}
          >
            {activeAttendees.length === 0 ? <option value="">No active attendees</option> : null}
            {activeAttendees.map((attendee) => (
              <option key={attendee.id} value={attendee.id}>
                {attendee.classification} · {attendee.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
      )}

      {chargeView && action !== "remove" ? (
        <p className="mt-2 text-xs font-semibold text-slate-500">
          Effective method {chargeView.effectiveMethod}. Remaining{" "}
          {formatCents(chargeView.remainingCents)}.
        </p>
      ) : null}

      {action === "method" ? (
        <label className="mt-4 block text-sm font-bold text-slate-700">
          Change to
          <select
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base"
            value={toMethod}
            disabled={disabled || visitLocked}
            onChange={(event) => setToMethod(event.target.value as PaymentMethod)}
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
          </select>
        </label>
      ) : null}

      {action === "refund" ? (
        <label className="mt-4 block text-sm font-bold text-slate-700">
          Refund amount (USD)
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={refundDollars}
            disabled={disabled || visitLocked}
            onChange={(event) => setRefundDollars(event.target.value)}
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base"
          />
        </label>
      ) : null}

      {action === "void" ? (
        <label className="mt-4 flex min-h-12 items-center gap-3 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={alsoRemoveAttendee}
            disabled={disabled || visitLocked || !selectedCharge?.attendeeId}
            onChange={(event) => setAlsoRemoveAttendee(event.target.checked)}
            className="h-5 w-5"
          />
          Also remove linked attendee after void
        </label>
      ) : null}

      {(action === "void" || action === "remove") && (
        <label className="mt-4 flex min-h-12 items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-900">
          <input
            type="checkbox"
            checked={confirmDestructive}
            disabled={disabled || visitLocked}
            onChange={(event) => setConfirmDestructive(event.target.checked)}
            className="mt-1 h-5 w-5"
          />
          <span>
            I understand this is destructive. Original ledger history remains visible; adjustments
            will be appended.
          </span>
        </label>
      )}

      <label className="mt-4 block text-sm font-bold text-slate-700">
        Reason
        <textarea
          value={reason}
          disabled={disabled || visitLocked}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base"
          placeholder="Required for audit"
        />
      </label>

      {actionBlockedReason && !visitLocked ? (
        <p
          role="status"
          className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950"
        >
          {actionBlockedReason}
        </p>
      ) : null}

      {localError ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-rose-800">
          {localError}
        </p>
      ) : null}

      <button
        type="button"
        disabled={disabled || visitLocked || Boolean(actionBlockedReason)}
        onClick={submit}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-50"
      >
        {disabledReason === "submitting"
          ? "Submitting…"
          : disabledReason === "needs_reload"
            ? "Reload ledger first"
            : "Submit to server"}
      </button>
    </section>
  );
}
