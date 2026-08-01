"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

type Props = {
  bookingId: string;
  customerName: string;
  eventDate: string;
  itemNames: string[];
};

type RestoreResponse = { ok?: boolean; message?: string };

export function RentalRestoreButton({
  bookingId,
  customerName,
  eventDate,
  itemNames,
}: Props) {
  const router = useRouter();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function restore() {
    if (isWorking) return;
    setIsWorking(true);
    setMessage(null);
    setFailed(false);
    try {
      const response = await fetch(
        `/api/admin/rentals/${encodeURIComponent(bookingId)}/restore`,
        { method: "POST", cache: "no-store", headers: { Accept: "application/json" } },
      );
      const result = (await response.json().catch(() => ({}))) as RestoreResponse;
      if (!response.ok || result.ok === false) {
        setFailed(true);
        setMessage(result.message ?? "The rental could not be restored.");
        return;
      }
      setMessage(result.message ?? "Rental restored to pending.");
      setOpen(false);
      router.refresh();
    } catch {
      setFailed(true);
      setMessage("Could not reach the server. The rental remains cancelled.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <span className="inline-flex max-w-full flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isWorking}
        className="min-h-11 rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:cursor-wait disabled:bg-emerald-300"
      >
        Restore rental
      </button>
      {message && !open ? (
        <span
          role={failed ? "alert" : "status"}
          className={`max-w-80 break-words text-xs font-bold ${failed ? "text-rose-700" : "text-emerald-700"}`}
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
              Restore this rental?
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              The server will check every item and rental date. A conflict leaves
              this rental cancelled.
            </p>
            <dl className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div>
                <dt className="font-black text-slate-500">Customer</dt>
                <dd className="break-words font-bold text-slate-950">{customerName}</dd>
              </div>
              <div>
                <dt className="font-black text-slate-500">Event date</dt>
                <dd className="font-bold text-slate-950">{eventDate}</dd>
              </div>
              <div>
                <dt className="font-black text-slate-500">Items</dt>
                <dd className="break-words font-bold text-slate-950">
                  {itemNames.join(", ")}
                </dd>
              </div>
            </dl>
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-950">
              A successful restore returns the original booking to pending approval
              and clears stale trailer assignments.
            </p>
            {message && failed ? (
              <p
                role="alert"
                className="mt-4 break-words rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800"
              >
                {message}
              </p>
            ) : null}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isWorking}
                className="min-h-12 rounded-xl border border-slate-300 px-4 py-3 font-black text-slate-800 disabled:opacity-50"
              >
                Keep cancelled
              </button>
              <button
                type="button"
                onClick={restore}
                disabled={isWorking}
                className="min-h-12 rounded-xl bg-emerald-600 px-4 py-3 font-black text-white hover:bg-emerald-700 disabled:cursor-wait disabled:bg-emerald-300"
              >
                {isWorking ? "Checking availability…" : "Confirm restore"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </span>
  );
}
