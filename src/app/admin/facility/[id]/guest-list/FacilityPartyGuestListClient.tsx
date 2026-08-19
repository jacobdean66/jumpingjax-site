"use client";

import { useMemo, useState } from "react";

import type { FacilityPartyGuest } from "@/lib/facility-parties/check-in";

function formatDob(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [year, month, day] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)));
}

function statusLabel(guest: FacilityPartyGuest): string {
  return guest.checkedInAt ? "Here" : "Not here yet";
}

export function FacilityPartyGuestListClient({
  bookingId,
  initialGuests,
}: {
  bookingId: string;
  initialGuests: FacilityPartyGuest[];
}) {
  const [guests, setGuests] = useState(initialGuests);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkedInCount = useMemo(
    () => guests.filter((guest) => Boolean(guest.checkedInAt)).length,
    [guests],
  );

  async function setPresent(guest: FacilityPartyGuest, present: boolean) {
    if (pendingId) return;
    setPendingId(guest.id);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/facility/${encodeURIComponent(bookingId)}/guest-list/${encodeURIComponent(
          guest.id,
        )}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ present }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; guest?: FacilityPartyGuest; error?: string }
        | null;
      if (!response.ok || !payload?.ok || !payload.guest) {
        throw new Error(payload?.error || "Could not update this guest.");
      }
      setGuests((current) =>
        current.map((item) => (item.id === guest.id ? payload.guest! : item)),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not update this guest.",
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="mt-6 space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Guest list</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              {checkedInCount} of {guests.length} guests marked here.
            </p>
          </div>
          <p className="rounded-full bg-cyan-50 px-4 py-2 text-sm font-black text-cyan-950">
            Tell staff your name and walk through
          </p>
        </div>
        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-900"
          >
            {error}
          </p>
        ) : null}
      </div>

      {guests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-black text-slate-950">No guests yet</p>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            Guests will appear here after they scan the invitation QR and find or
            sign their waiver.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {guests.map((guest) => {
            const present = Boolean(guest.checkedInAt);
            return (
              <article
                key={guest.id}
                className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-black text-slate-950">
                      {guest.firstName} {guest.lastName}
                    </h3>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        present
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {statusLabel(guest)}
                    </span>
                  </div>
                  <dl className="mt-2 grid gap-1 text-sm font-semibold text-slate-600 sm:grid-cols-3">
                    <div>
                      <dt className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                        DOB
                      </dt>
                      <dd>{formatDob(guest.dob)}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                        Waiver signer
                      </dt>
                      <dd>{guest.signerName}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                        Waiver valid through
                      </dt>
                      <dd>{formatDob(guest.waiverExpiresOn)}</dd>
                    </div>
                  </dl>
                </div>
                <button
                  type="button"
                  disabled={pendingId === guest.id}
                  onClick={() => {
                    void setPresent(guest, !present);
                  }}
                  className={`inline-flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    present
                      ? "border-2 border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  }`}
                >
                  {pendingId === guest.id
                    ? "Saving..."
                    : present
                      ? "Undo checkmark"
                      : "Mark here"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
