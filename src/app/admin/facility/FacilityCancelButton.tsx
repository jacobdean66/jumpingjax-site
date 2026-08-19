"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

type Props = {
  bookingId: string;
  customerName: string;
  partyLabel: string | null;
  readableDate: string | null;
  readableTime: string | null;
  currentStatus: string;
};

type CancelResponse = {
  ok?: boolean;
  message?: string;
  calendarSyncFailed?: boolean;
};

export function FacilityCancelButton({
  bookingId,
  customerName,
  partyLabel,
  readableDate,
  readableTime,
  currentStatus,
}: Props) {
  const router = useRouter();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState(false);

  async function confirmCancellation() {
    if (isWorking) return;
    setIsWorking(true);
    setMessage(null);
    setWarning(false);

    try {
      const response = await fetch(
        `/api/admin/facility/${encodeURIComponent(bookingId)}/cancel`,
        {
          method: "POST",
          cache: "no-store",
          headers: { Accept: "application/json" },
        },
      );
      const result = (await response.json().catch(() => ({}))) as CancelResponse;
      if (!response.ok || result.ok === false) {
        setMessage(result.message ?? "The facility party could not be cancelled.");
        setWarning(true);
        return;
      }

      setMessage(result.message ?? "Facility party cancelled.");
      setWarning(result.calendarSyncFailed === true);
      setOpen(false);
      router.refresh();
    } catch {
      setMessage(
        "Could not reach the server. The facility party was not cancelled.",
      );
      setWarning(true);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <span className="inline-flex max-w-full flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMessage(null);
          setWarning(false);
        }}
        disabled={isWorking}
        className="min-h-11 rounded-full bg-orange-500 px-4 py-2 text-xs font-black text-white hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:cursor-wait disabled:bg-orange-300"
      >
        Cancel
      </button>
      {message ? (
        <span
          role={warning ? "alert" : "status"}
          className={`max-w-72 text-xs font-bold ${
            warning ? "text-rose-700" : "text-emerald-700"
          }`}
        >
          {message}
        </span>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-950/60 p-3 sm:items-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !isWorking) {
              setOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <h2 id={titleId} className="text-2xl font-black text-slate-950">
              Cancel this facility party?
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              The booking history will be kept. This date and time will be
              reopened for new facility party bookings unless another booking
              already holds it.
            </p>

            <dl className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div>
                <dt className="font-black text-slate-500">Customer</dt>
                <dd className="break-words font-bold text-slate-950">
                  {customerName}
                </dd>
              </div>
              <div>
                <dt className="font-black text-slate-500">Party</dt>
                <dd className="font-bold text-slate-950">
                  {partyLabel ?? "Facility party"}
                </dd>
              </div>
              <div>
                <dt className="font-black text-slate-500">Date and time</dt>
                <dd className="font-bold text-slate-950">
                  {readableDate ?? "Date not set"} — {readableTime ?? "Time not set"}
                </dd>
              </div>
              <div>
                <dt className="font-black text-slate-500">Current status</dt>
                <dd className="font-bold capitalize text-slate-950">
                  {currentStatus}
                </dd>
              </div>
            </dl>

            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-950">
              This cannot be undone from this screen. The cancelled party remains
              in history and no longer blocks availability.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isWorking}
                className="min-h-12 rounded-xl border border-slate-300 px-4 py-3 font-black text-slate-800 disabled:opacity-50"
              >
                Keep party
              </button>
              <button
                type="button"
                onClick={confirmCancellation}
                disabled={isWorking}
                className="min-h-12 rounded-xl bg-rose-600 px-4 py-3 font-black text-white hover:bg-rose-700 disabled:cursor-wait disabled:bg-rose-300"
              >
                {isWorking ? "Cancelling..." : "Confirm cancellation"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </span>
  );
}
