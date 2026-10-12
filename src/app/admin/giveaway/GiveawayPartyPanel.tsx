"use client";

import { useCallback, useEffect, useState } from "react";
import type { GiveawayPartyBooking, GiveawayPartyGuest, GiveawayPartyView } from "@/lib/giveaway/party-rsvps";

const buttonClass = "min-h-11 rounded-full bg-cyan-700 px-5 py-2 text-sm font-black text-white hover:bg-cyan-800 disabled:cursor-wait disabled:opacity-50";
const secondaryClass = "min-h-11 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50";

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });
}

async function fetchPartyView(drawMonth: string, signal?: AbortSignal): Promise<GiveawayPartyView> {
  const response = await fetch(`/api/admin/giveaway/party?drawMonth=${encodeURIComponent(drawMonth)}`, { cache: "no-store", signal });
  const result = await response.json();
  if (!response.ok || result.ok !== true || result.drawMonth !== drawMonth) throw new Error(result.error || "The guest list could not be loaded.");
  return result;
}

export function GiveawayPartyRoster({ guests }: { guests: GiveawayPartyGuest[] }) {
  if (!guests.length) return <p className="rounded-xl border border-dashed border-cyan-300 bg-white p-5 font-semibold text-slate-600">No RSVPs yet. Guests will appear here after they RSVP using the party invitation link.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Giveaway party RSVP guest list</caption>
        <thead className="bg-slate-100 text-xs font-black uppercase text-slate-600"><tr><th className="p-3">Guest</th><th className="p-3">Type</th><th className="p-3">RSVP recorded</th><th className="p-3">Attendance</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{guests.map(guest => <tr key={guest.id}>
          <td className="break-words p-3 font-bold text-slate-950">{guest.name}</td>
          <td className="p-3">{guest.kind}</td>
          <td className="p-3 text-slate-600">{dateTime(guest.rsvpedAt)}</td>
          <td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-black ${guest.checkedInAt ? "bg-emerald-100 text-emerald-800" : "bg-cyan-100 text-cyan-900"}`}>{guest.checkedInAt ? "Checked in" : "RSVP — not checked in"}</span>{guest.checkedInAt ? <p className="mt-2 text-xs text-slate-500">{dateTime(guest.checkedInAt)}</p> : null}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

export function GiveawayPartyPanel({ drawMonth, monthLabel }: { drawMonth: string; monthLabel: string }) {
  const [view, setView] = useState<GiveawayPartyView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showGuests, setShowGuests] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [choicesLoading, setChoicesLoading] = useState(false);
  const [choices, setChoices] = useState<GiveawayPartyBooking[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchPartyView(drawMonth);
      setView(result);
      setSelectedId(result.linkedBookingId || "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The guest list could not be loaded."); }
    finally { setLoading(false); }
  }, [drawMonth]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchPartyView(drawMonth, controller.signal).then(result => {
      setView(result);
      setSelectedId(result.linkedBookingId || "");
      setLoading(false);
    }).catch(cause => {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "The guest list could not be loaded.");
      setLoading(false);
    });
    return () => controller.abort();
  }, [drawMonth]);
  useEffect(() => {
    if (!showGuests || editing || saving) return;
    const interval = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 30_000);
    return () => clearInterval(interval);
  }, [showGuests, editing, saving, refresh]);

  async function findParties() {
    setChoicesLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/giveaway/party?drawMonth=${encodeURIComponent(drawMonth)}&choices=1&q=${encodeURIComponent(search)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(result.error || "Saved parties could not be loaded.");
      setChoices(result.choices);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Saved parties could not be loaded."); }
    finally { setChoicesLoading(false); }
  }

  async function saveLink() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/giveaway/party", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drawMonth, bookingId: selectedId || null, expectedBookingId: view?.linkedBookingId ?? null }),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(result.error || "The party link could not be saved.");
      setView(result);
      setEditing(false);
      setShowGuests(Boolean(result.party));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The party link could not be saved."); }
    finally { setSaving(false); }
  }

  const party = view?.party;
  const options = [...choices];
  if (party && !options.some(option => option.id === party.id)) options.unshift(party);
  return (
    <section aria-labelledby={`giveaway-party-heading-${drawMonth}`} className="mt-4 rounded-2xl border-2 border-cyan-200 bg-cyan-50/70 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 id={`giveaway-party-heading-${drawMonth}`} className="text-xl font-black text-slate-950">Giveaway party &amp; RSVPs</h3>
          {loading && !view ? <p className="mt-2 font-semibold text-slate-600" role="status">Loading this month’s party…</p> : party ? <p className="mt-2 font-bold text-cyan-950">{party.childName} · {party.date} · {party.time}<span className="mt-1 block text-sm font-semibold text-slate-600">{party.room} · {party.status}</span></p> : view ? <p className="mt-2 font-semibold text-slate-600">{view.missingParty ? "The linked party is no longer available. Choose another saved party." : `No giveaway party is linked to ${monthLabel} yet.`}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {party ? <button type="button" className={buttonClass} aria-expanded={showGuests} aria-controls={`giveaway-rsvps-${drawMonth}`} onClick={() => setShowGuests(current => !current)}>{showGuests ? "Hide RSVPs" : "View RSVPs"}</button> : null}
          <button type="button" className={secondaryClass} disabled={loading || saving} onClick={() => { setEditing(current => !current); if (!editing) void findParties(); }}>{editing ? "Close party selector" : party || view?.missingParty ? "Change linked party" : "Link giveaway party"}</button>
          <button type="button" className={secondaryClass} disabled={loading || saving || editing} onClick={() => void refresh()}>{loading ? "Refreshing…" : "Refresh RSVPs"}</button>
        </div>
      </div>
      {party && view?.counts ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-live="polite">{[["RSVPs", view.counts.rsvps], ["Children", view.counts.children], ["Adults", view.counts.adults], ["Checked in", view.counts.checkedIn]].map(([label, count]) => <div key={label} className="rounded-xl bg-white p-3"><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{count}</p></div>)}</div> : null}
      {error ? <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 font-semibold text-rose-900">{error}</p> : null}
      {editing ? <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <p className="font-semibold text-slate-700">Choose the saved facility party for {monthLabel}’s giveaway.</p>
        <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); void findParties(); }}>
          <label className="min-w-0 flex-1 text-sm font-bold">Search by child or parent<input type="search" value={search} onChange={event => setSearch(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label>
          <button className={secondaryClass} disabled={choicesLoading || saving}>{choicesLoading ? "Finding…" : "Find parties"}</button>
        </form>
        <label className="block text-sm font-bold">Saved party<select value={selectedId} onChange={event => setSelectedId(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3" disabled={saving || choicesLoading}>
          <option value="">No linked party</option>{options.map(option => <option key={option.id} value={option.id}>{option.childName} — {option.customerName} — {option.date} — {option.time} ({option.status})</option>)}
        </select></label>
        {!choicesLoading && !choices.length ? <p className="text-sm text-slate-600">No matching saved parties. Try another child or parent name.</p> : null}
        <button type="button" className={buttonClass} disabled={saving || choicesLoading || selectedId === (view?.linkedBookingId ?? "")} onClick={() => void saveLink()}>{saving ? "Saving…" : "Save party link"}</button>
      </div> : null}
      {showGuests && party ? <div id={`giveaway-rsvps-${drawMonth}`} className="mt-5 space-y-3">
        <p className="text-sm font-semibold text-slate-600">This list refreshes every 30 seconds while open. RSVP is separate from arriving and checking in.</p>
        <GiveawayPartyRoster guests={view.guests} />
        <a href={`/admin/facility/${encodeURIComponent(party.id)}/guest-list`} className="inline-flex min-h-11 items-center rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">Open guest list &amp; check-in</a>
      </div> : null}
    </section>
  );
}
