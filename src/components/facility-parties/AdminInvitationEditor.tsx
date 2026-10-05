"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InvitationThemeSearch } from "./InvitationThemeSearch";
import { PartyInvitationCard } from "./PartyInvitationCard";
import type { ThemeDesign } from "@/lib/facility-parties/invitations/theme-search";
import { invitationSnapshotFromChoice } from "@/lib/facility-parties/invitations/snapshot";

export function AdminInvitationEditor(props: {
  bookingId: string; themeText: string; childName: string; childAge: string;
  customerPhone: string; dateLabel: string; timeLabel: string; waiverUrl: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(props.themeText);
  const [design, setDesign] = useState<ThemeDesign | null>(null);
  const [optionIndex, setOptionIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (!design || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/facility/${encodeURIComponent(props.bookingId)}/invitation`, {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceText: design.sourceText, confirmationToken: design.confirmationToken, optionIndex }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The invitation could not be saved. Please retry.");
      router.refresh(); setDesign(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The invitation could not be saved."); }
    finally { setBusy(false); }
  }
  return <section className="my-6 rounded-2xl border border-slate-200 bg-white p-5 print:hidden" aria-label="Create party invitations">
    <h2 className="text-xl font-black text-slate-950">Create or change party invitations</h2>
    <p className="mt-2 text-slate-700">Search for the party theme, confirm the right picture, then choose a design and save it to this party.</p>
    <label className="mt-4 block font-bold text-slate-900" htmlFor="admin-invitation-theme">Party theme</label>
    <input id="admin-invitation-theme" className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-slate-950" maxLength={160} value={query} disabled={busy} onChange={event => { setQuery(event.target.value); setDesign(null); setError(""); }} />
    <InvitationThemeSearch key={query} query={query} design={design} onConfirmed={next => { setDesign(next); setOptionIndex(0); }} onClear={() => setDesign(null)} />
    {design ? <>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {["Spotlight", "Portrait", "Banner"].map((label, index) => <div key={label} className="min-w-0">
          <label className="mb-2 flex items-center gap-2 font-bold text-slate-950"><input type="radio" name="invitation-layout" checked={optionIndex === index} disabled={busy} onChange={() => setOptionIndex(index)} />{label}</label>
          <PartyInvitationCard {...props} snapshot={invitationSnapshotFromChoice(design.sourceText, index, 0, "", design.theme)} />
        </div>)}
      </div>
      <button type="button" onClick={() => void save()} disabled={busy} className="mt-4 rounded-xl bg-sky-700 px-5 py-3 font-black text-white disabled:opacity-50">{busy ? "Saving invitation…" : "Save invitations to this party"}</button>
    </> : null}
    {error ? <p role="alert" className="mt-3 font-bold text-red-700">{error}</p> : null}
  </section>;
}
