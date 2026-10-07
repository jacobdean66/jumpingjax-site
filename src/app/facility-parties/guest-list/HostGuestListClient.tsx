"use client";

import { useEffect, useState } from "react";
import { PartyGuestList } from "../../facility-party-check-in/PartyGuestList";
import type { PublicFacilityParty } from "@/lib/facility-parties/check-in";

export function HostGuestListClient({ bookingId, token }: { bookingId: string; token: string }) {
  const [party, setParty] = useState<PublicFacilityParty | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const params = new URLSearchParams({ booking: bookingId, token });
        const response = await fetch(`/api/facility-party/host-guest-list?${params}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.party) throw new Error(data.error || "The guest list is temporarily unavailable.");
        if (active) { setParty(data.party); setError(""); }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "The guest list is temporarily unavailable.");
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [bookingId, token]);
  return <main className="min-h-screen bg-cyan-100 px-4 py-8 text-slate-950">
    <section className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-lg sm:p-9">
      <p className="font-bold uppercase text-cyan-800">Jumping Jax</p>
      <h1 className="mt-3 text-3xl font-black">Your party guest list</h1>
      {party ? <>
        <p className="mt-3 font-semibold text-slate-600">{[party.partyLabel, party.date, party.time].filter(Boolean).join(" · ")}</p>
        <p className="mt-3 text-slate-600">Your list updates as guests RSVP and check in. Guests can RSVP once your party is confirmed. Keep this host link for yourself.</p>
        <PartyGuestList party={party} />
      </> : !error ? <p className="mt-4">Loading guest list…</p> : null}
      {error ? <p role="alert" className="mt-4 font-semibold text-red-800">{error}</p> : null}
    </section>
  </main>;
}
