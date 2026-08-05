"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import type { AdminRentalBooking } from "@/lib/admin/operations";

type Props = {
  booking: AdminRentalBooking;
};

type EditResponse = {
  ok?: boolean;
  message?: string;
  calendarSyncFailed?: boolean;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-black uppercase tracking-[0.1em] text-slate-600">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-950 outline-none focus:border-sky-500";

export function RentalEditButton({ booking }: Props) {
  const router = useRouter();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isWorking) return;
    setIsWorking(true);
    setMessage(null);
    setWarning(false);

    const form = new FormData(event.currentTarget);
    const payload = {
      customerName: String(form.get("customerName") ?? ""),
      customerEmail: String(form.get("customerEmail") ?? ""),
      customerPhone: String(form.get("customerPhone") ?? ""),
      eventDate: String(form.get("eventDate") ?? ""),
      eventStartTime: String(form.get("eventStartTime") ?? ""),
      requestedDeliveryWindow: String(
        form.get("requestedDeliveryWindow") ?? "",
      ),
      eventAddress: String(form.get("eventAddress") ?? ""),
      setupLocation: String(form.get("setupLocation") ?? ""),
      setupSurface: String(form.get("setupSurface") ?? ""),
      setupAccess: String(form.get("setupAccess") ?? ""),
      setupNotes: String(form.get("setupNotes") ?? ""),
      paymentMethod: String(form.get("paymentMethod") ?? ""),
    };

    try {
      const response = await fetch(
        `/api/admin/rentals/${encodeURIComponent(booking.id)}`,
        {
          method: "PATCH",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json().catch(() => ({}))) as EditResponse;
      if (!response.ok || result.ok === false) {
        setWarning(true);
        setMessage(result.message ?? "The rental could not be updated.");
        return;
      }
      setMessage(result.message ?? "Rental updated.");
      setWarning(result.calendarSyncFailed === true);
      setOpen(false);
      router.refresh();
    } catch {
      setWarning(true);
      setMessage("Could not reach the server. The rental was not updated.");
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
        className="rounded-full bg-sky-500 px-4 py-2 text-xs font-black text-white hover:bg-sky-600 disabled:cursor-wait disabled:bg-sky-300"
      >
        Edit
      </button>
      {message && !open ? (
        <span
          className={`max-w-56 text-xs font-bold ${
            warning ? "text-amber-800" : "text-slate-600"
          }`}
        >
          {message}
        </span>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 sm:items-center"
          role="presentation"
          onClick={() => {
            if (!isWorking) setOpen(false);
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
            onSubmit={save}
            className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
          >
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 id={titleId} className="text-lg font-black text-slate-950">
                Edit rental #{booking.id}
              </h3>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Pending and approved rentals can be updated. Calendar syncs after
                approved edits.
              </p>
            </div>

            <div className="grid gap-3 overflow-y-auto px-5 py-4 sm:grid-cols-2">
              <Field label="Customer name">
                <input
                  name="customerName"
                  required
                  defaultValue={booking.customerName}
                  className={inputClass}
                />
              </Field>
              <Field label="Phone">
                <input
                  name="customerPhone"
                  defaultValue={booking.customerPhone ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Email">
                <input
                  name="customerEmail"
                  type="email"
                  defaultValue={booking.customerEmail ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Payment method">
                <input
                  name="paymentMethod"
                  required
                  defaultValue={booking.paymentMethod ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Event date">
                <input
                  name="eventDate"
                  type="date"
                  required
                  defaultValue={booking.eventDate}
                  className={inputClass}
                />
              </Field>
              <Field label="Party start (HH:MM)">
                <input
                  name="eventStartTime"
                  type="time"
                  defaultValue={booking.eventStartTime ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Delivery window">
                <input
                  name="requestedDeliveryWindow"
                  defaultValue={booking.requestedDeliveryWindow ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Setup location">
                <input
                  name="setupLocation"
                  defaultValue={booking.setupLocation ?? ""}
                  className={inputClass}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address">
                  <input
                    name="eventAddress"
                    required
                    defaultValue={booking.eventAddress ?? ""}
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Setup surface">
                <input
                  name="setupSurface"
                  defaultValue={booking.setupSurface ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Setup access">
                <input
                  name="setupAccess"
                  defaultValue={booking.setupAccess ?? ""}
                  className={inputClass}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Setup notes">
                  <textarea
                    name="setupNotes"
                    rows={3}
                    defaultValue={booking.setupNotes ?? ""}
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>

            {message ? (
              <p
                className={`px-5 text-sm font-bold ${
                  warning ? "text-amber-800" : "text-rose-700"
                }`}
              >
                {message}
              </p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                disabled={isWorking}
                onClick={() => setOpen(false)}
                className="min-h-12 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isWorking}
                className="min-h-12 rounded-full bg-sky-500 px-5 py-2 text-sm font-black text-white hover:bg-sky-600 disabled:cursor-wait disabled:bg-sky-300"
              >
                {isWorking ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </span>
  );
}
