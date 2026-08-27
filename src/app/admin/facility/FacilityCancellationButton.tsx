"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

type Props = {
  endpoint: string;
  customerName: string;
  partyTime: string;
  childName: string | null;
  kidCount: number | null;
  currentStatus: string;
  retryCalendarOnly?: boolean;
};

type CancellationResponse = {
  ok?: boolean;
  message?: string;
  calendarSyncFailed?: boolean;
};

export function FacilityCancellationButton({
  endpoint,
  customerName,
  partyTime,
  childName,
  kidCount,
  currentStatus,
  retryCalendarOnly = false,
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
      const response = await fetch(endpoint, {
        method: "POST",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const contentType = response.headers.get("content-type") ?? "";
      const result: CancellationResponse = contentType.includes("application/json")
        ? await response.json()
        : {};

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
      setMessage("Could not reach the server. The facility party was not cancelled.");
      setWarning(true);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 rounded-full bg-orange-500 px-4 py-2 text-xs font-black text-white hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-300"
      >
        {retryCalendarOnly ? "Retry Calendar removal" : "Cancel party"}
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
            if (event.currentTarget === event.target && !isWorking) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <h2 id={titleId} className="text-2xl font-black text-slate-950">
              {retryCalendarOnly
                ? "Retry Calendar removal?"
                : "Cancel this facility party?"}
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              {retryCalendarOnly
                ? "The party is already cancelled. This retries removal of its stored Google Calendar event IDs."
                : "The booking and customer history will be retained. The time slot will reopen on the facility calendar."}
            </p>

            <dl className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div>
                <dt className="font-black text-slate-500">Customer</dt>
                <dd className="break-words font-bold text-slate-950">{customerName}</dd>
              </div>
              <div>
                <dt className="font-black text-slate-500">Party time</dt>
                <dd className="font-bold text-slate-950">{partyTime}</dd>
              </div>
              <div>
                <dt className="font-black text-slate-500">Child</dt>
                <dd className="font-bold text-slate-950">{childName ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="font-black text-slate-500">Kids</dt>
                <dd className="font-bold text-slate-950">
                  {kidCount === null ? "Not set" : `${kidCount} kids`}
                </dd>
              </div>
              <div>
                <dt className="font-black text-slate-500">Current status</dt>
                <dd className="font-bold capitalize text-slate-950">{currentStatus}</dd>
              </div>
            </dl>

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
                {isWorking
                  ? retryCalendarOnly
                    ? "Retrying..."
                    : "Cancelling..."
                  : retryCalendarOnly
                    ? "Retry Calendar removal"
                    : "Confirm cancellation"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </span>
  );
}
