"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import type { AdminFacilityBooking } from "@/lib/admin/operations";

type Props = {
  booking: AdminFacilityBooking;
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

export function FacilityEditButton({ booking }: Props) {
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
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      parentName: String(form.get("parentName") ?? ""),
      childName: String(form.get("childName") ?? ""),
      childAge: String(form.get("childAge") ?? ""),
      childGender: String(form.get("childGender") ?? ""),
      partyTheme: String(form.get("partyTheme") ?? ""),
      balloonColors: String(form.get("balloonColors") ?? ""),
      tableClothColors: String(form.get("tableClothColors") ?? ""),
      drinkChoice: String(form.get("drinkChoice") ?? ""),
      notes: String(form.get("notes") ?? ""),
      paymentMethod: String(form.get("paymentMethod") ?? ""),
    };

    try {
      const response = await fetch(
        `/api/admin/facility/${encodeURIComponent(booking.id)}`,
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
        setMessage(result.message ?? "The facility party could not be updated.");
        return;
      }
      setMessage(result.message ?? "Facility party updated.");
      setWarning(result.calendarSyncFailed === true);
      setOpen(false);
      router.refresh();
    } catch {
      setWarning(true);
      setMessage(
        "Could not reach the server. The facility party was not updated.",
      );
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
                Edit facility party #{booking.id}
              </h3>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Pending and confirmed parties can be updated. Room and time stay
                the same; calendar syncs after confirmed edits.
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
              <Field label="Parent name">
                <input
                  name="parentName"
                  defaultValue={booking.parentName ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Phone">
                <input
                  name="phone"
                  defaultValue={booking.phone ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Email">
                <input
                  name="email"
                  type="email"
                  defaultValue={booking.email ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Child name">
                <input
                  name="childName"
                  defaultValue={booking.childName ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Child age">
                <input
                  name="childAge"
                  defaultValue={booking.childAge ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Child gender">
                <input
                  name="childGender"
                  defaultValue={booking.childGender ?? ""}
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
              <Field label="Party theme">
                <input
                  name="partyTheme"
                  defaultValue={booking.partyTheme ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Drink choice">
                <input
                  name="drinkChoice"
                  defaultValue={booking.drinkChoice ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Balloon colors">
                <input
                  name="balloonColors"
                  defaultValue={booking.balloonColors ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Table cloth colors">
                <input
                  name="tableClothColors"
                  defaultValue={booking.tableClothColors ?? ""}
                  className={inputClass}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Notes">
                  <textarea
                    name="notes"
                    rows={3}
                    defaultValue={booking.notes ?? ""}
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
