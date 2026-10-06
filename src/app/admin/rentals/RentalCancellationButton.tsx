"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

type Props = {
  endpoint: string;
  customerName: string;
  eventDate: string;
  spanDays: number;
  itemNames: string[];
  currentStatus: string;
  retryCalendarOnly?: boolean;
};

type CancellationResponse = {
  ok?: boolean;
  message?: string;
  calendarSyncFailed?: boolean;
};

function dateSpanLabel(eventDate: string, spanDays: number): string {
  if (spanDays <= 1) return eventDate;
  const start = new Date(`${eventDate}T12:00:00`);
  if (Number.isNaN(start.getTime())) return `${eventDate} (${spanDays} days)`;
  const end = new Date(start);
  end.setDate(end.getDate() + spanDays - 1);
  const endYmd = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  return `${eventDate} through ${endYmd} (${spanDays} days)`;
}

export function RentalCancellationButton({
  endpoint,
  customerName,
  eventDate,
  spanDays,
  itemNames,
  currentStatus,
  retryCalendarOnly = false,
}: Props) {
  const router = useRouter();
  const titleId = useId();
  const workingRef = useRef(false);
  const [completed, setCompleted] = useState(false);
  const [open, setOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState(false);

  async function confirmCancellation() {
    if (workingRef.current) return;
    workingRef.current = true;
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

      if (!response.ok || result.ok !== true) {
        setMessage(result.message ?? (retryCalendarOnly ? "Calendar removal could not be started. Try again." : "The rental could not be cancelled."));
        setWarning(true);
        return;
      }

      setMessage(result.message ?? "Rental cancelled.");
      setWarning(result.calendarSyncFailed === true);
      setCompleted(result.calendarSyncFailed !== true);
      setOpen(false);
      router.refresh();
    } catch {
      setMessage(retryCalendarOnly ? "Could not confirm calendar removal. Refresh to check its status." : "Could not confirm cancellation. Refresh to check the rental’s status before trying again.");
      setWarning(true);
    } finally {
      workingRef.current = false;
      setIsWorking(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      {!completed ? <button
        type="button"
        disabled={isWorking}
        onClick={() => retryCalendarOnly ? void confirmCancellation() : setOpen(true)}
        className="min-h-11 rounded-full bg-orange-500 px-4 py-2 text-xs font-black text-white hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:cursor-wait disabled:opacity-50"
      >
        {isWorking ? (retryCalendarOnly ? "Removing calendar events…" : "Cancelling…") : retryCalendarOnly ? "Retry calendar removal" : "Cancel rental"}
      </button> : null}

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

      {open && !retryCalendarOnly ? (
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
              Cancel {customerName}’s rental?
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              This cancels the booking, releases its inventory and active route work, and removes its Google Calendar events. Your booking history will be retained.
            </p>

            <dl className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div>
                <dt className="font-black text-slate-500">Customer</dt>
                <dd className="break-words font-bold text-slate-950">{customerName}</dd>
              </div>
              <div>
                <dt className="font-black text-slate-500">Rental dates</dt>
                <dd className="font-bold text-slate-950">
                  {dateSpanLabel(eventDate, spanDays)}
                </dd>
              </div>
              <div>
                <dt className="font-black text-slate-500">Current status</dt>
                <dd className="font-bold capitalize text-slate-950">{currentStatus}</dd>
              </div>
              <div>
                <dt className="font-black text-slate-500">Affected items</dt>
                <dd>
                  <ul className="mt-1 list-disc space-y-1 pl-5 font-bold text-slate-950">
                    {itemNames.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isWorking}
                className="min-h-12 rounded-xl border border-slate-300 px-4 py-3 font-black text-slate-800 disabled:opacity-50"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={confirmCancellation}
                disabled={isWorking}
                className="min-h-12 rounded-xl bg-rose-600 px-4 py-3 font-black text-white hover:bg-rose-700 disabled:cursor-wait disabled:bg-rose-300"
              >
                {isWorking ? "Cancelling and removing calendar events…" : "Cancel rental"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </span>
  );
}
