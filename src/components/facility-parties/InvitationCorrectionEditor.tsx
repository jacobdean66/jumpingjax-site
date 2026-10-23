"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { InvitationThemeSearch } from "./InvitationThemeSearch";
import { PartyInvitationCard, type PartyInvitationCardProps } from "./PartyInvitationCard";
import type { ThemeDesign } from "@/lib/facility-parties/invitations/theme-search";
import { invitationSnapshotFromChoice } from "@/lib/facility-parties/invitations/snapshot";
import type { InvitationCorrectionPlan } from "@/lib/facility-parties/invitations/correction";

export function InvitationCorrectionEditor({ bookingId, initialRequest = "", ...card }: PartyInvitationCardProps & { bookingId: string; initialRequest?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState(initialRequest);
  const [plan, setPlan] = useState<InvitationCorrectionPlan | null>(null);
  const [headline, setHeadline] = useState(card.snapshot.customHeadline ?? "");
  const [optionIndex, setOptionIndex] = useState(card.snapshot.optionIndex);
  const [design, setDesign] = useState<ThemeDesign | null>(null);
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const lock = useRef(false);
  async function request(save: boolean) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setSaved(false);
    try {
      const response = await fetch(`/api/admin/facility/${encodeURIComponent(bookingId)}/invitation/correction`, { method: save ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(save ? { baseRevision: revision, headline, optionIndex, sourceText: design?.sourceText ?? card.snapshot.sourceText, ...(design ? { confirmationToken: design.confirmationToken } : {}) } : { message }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The correction is unavailable. Please try again.");
      if (save) { setPlan(null); setSaved(true); router.refresh(); }
      else {
        setPlan(body.plan); setRevision(body.baseRevision); setDesign(null);
        setHeadline(body.plan.headline ?? card.snapshot.customHeadline ?? "");
        setOptionIndex(body.plan.optionIndex ?? card.snapshot.optionIndex);
        setQuery(body.plan.artworkQuery ?? card.snapshot.sourceText);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again."); }
    finally { setBusy(false); lock.current = false; }
  }
  const preview = { ...invitationSnapshotFromChoice(design?.sourceText ?? card.snapshot.sourceText, optionIndex, 0, card.snapshot.colorHint, design?.theme ?? card.snapshot.confirmedTheme), customHeadline: headline };
  const pictureReady = Boolean(design || (!plan?.artworkQuery && card.snapshot.confirmedTheme));
  const changed = headline !== (card.snapshot.customHeadline ?? "") || optionIndex !== card.snapshot.optionIndex || Boolean(design);
  return <section className="my-6 rounded-2xl border border-indigo-200 bg-white p-5 print:hidden" aria-label="Invitation Agent corrections">
    <h2 className="text-xl font-bold text-slate-950">Fix this invitation</h2>
    <p className="mt-2 text-slate-700">Tell the Invitation Agent what to change. Review the preview, then save when it looks right.</p>
    <label className="mt-4 block font-bold text-slate-900">What should change?<textarea className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal" maxLength={800} rows={3} value={message} disabled={busy} onChange={event => { setMessage(event.target.value); setPlan(null); setError(""); }} placeholder={'For example: Make the message friendlier, try the banner layout, and find a dinosaur picture.'} /></label>
    <button type="button" disabled={busy || message.trim().length < 3} onClick={() => void request(false)} className="mt-3 rounded-xl bg-indigo-800 px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? "Working…" : "Ask Invitation Agent"}</button>
    {plan ? <div className="mt-5 space-y-4">
      <p className="whitespace-pre-wrap text-base leading-7 text-slate-800">{plan.explanation}</p>
      <label className="block font-bold">Invitation message<input className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal" value={headline} maxLength={100} disabled={busy} onChange={event => setHeadline(event.target.value)} placeholder="Leave blank to use the standard wording" /><span className="text-sm font-normal text-slate-600">Use {"{name}"} or {"{age}"} for the party’s saved details.</span></label>
      <label className="block font-bold">Layout<select className="ml-3 rounded-lg border border-slate-300 p-2" value={optionIndex} disabled={busy} onChange={event => setOptionIndex(Number(event.target.value))}>{["Spotlight", "Portrait", "Banner"].map((label, index) => <option key={label} value={index}>{label}</option>)}</select></label>
      {plan.artworkQuery || !card.snapshot.confirmedTheme ? <div><label className="block font-bold">Find the right picture<input className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal" value={query} disabled={busy} maxLength={160} onChange={event => { setQuery(event.target.value); setDesign(null); }} /></label><InvitationThemeSearch key={query} query={query} design={design} onConfirmed={setDesign} onClear={() => setDesign(null)} /></div> : null}
      <div className="grid gap-5 lg:grid-cols-2"><div><h3 className="mb-2 font-bold">Saved invitation</h3><PartyInvitationCard {...card} /></div><div><h3 className="mb-2 font-bold">Correction preview</h3><PartyInvitationCard {...card} snapshot={preview} /></div></div>
      {!pictureReady ? <p className="font-semibold text-amber-800">Confirm the right picture above before saving the correction.</p> : null}
      <button type="button" disabled={busy || !pictureReady || !changed} onClick={() => void request(true)} className="rounded-xl bg-sky-800 px-5 py-3 font-bold text-white disabled:opacity-50">Approve and save correction</button>
      <p className="text-sm text-slate-600">Saving updates this invitation. It does not send messages or print anything.</p>
    </div> : null}
    {saved ? <p role="status" className="mt-3 font-semibold text-emerald-800">Your invitation correction was saved.</p> : null}
    {error ? <p role="alert" className="mt-3 font-semibold text-rose-800">{error}</p> : null}
  </section>;
}
