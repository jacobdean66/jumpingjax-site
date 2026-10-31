"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PARTY_PITCH_PATH, REVIEW_STATUSES, campaignIssues, entriesOpen, type PitchCampaign, type PitchEntry } from "@/lib/party-pitch/model";

const fieldClass = "mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-medium text-slate-950 focus:outline-none focus:ring-2 focus:ring-purple-500";
const labels = { new: "New", reviewed: "Reviewed", shortlisted: "Shortlisted", not_selected: "Not selected" };
async function save(body: unknown) {
  const response = await fetch("/api/admin/party-pitches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Changes could not be saved.");
  return result;
}
function EntryCard({ entry, onSaved }: { entry: PitchEntry; onSaved: (entry: PitchEntry) => void }) {
  const [status, setStatus] = useState(entry.status);
  const [notes, setNotes] = useState(entry.reviewNotes);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(""); setFailed(false);
    try { await save({ action: "review", id: entry.id, status, reviewNotes: notes }); onSaved({ ...entry, status, reviewNotes: notes }); setMessage("Review saved."); }
    catch (e) { setFailed(true); setMessage(e instanceof Error ? e.message : "Review could not be saved."); }
    finally { setBusy(false); }
  }
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-black">{entry.title}</h3><p className="mt-1 font-semibold text-slate-600">{entry.name}</p></div><span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-black text-purple-900">{labels[entry.status]}</span></div>
    <p className="mt-4 whitespace-pre-wrap break-words leading-relaxed">{entry.pitch}</p>
    <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
      <div><dt className="font-black">Contact</dt><dd className="break-all"><a className="text-sky-700 underline" href={`mailto:${entry.email}`}>{entry.email}</a>{entry.phone ? <p>{entry.phone}</p> : null}</dd></div>
      <div><dt className="font-black">Event plans</dt><dd>{entry.guests} guests · ZIP {entry.zip}<p>Preferred month: {entry.eventMonth}</p></dd></div>
      <div><dt className="font-black">Submitted</dt><dd>{new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))} Eastern<p>Source: {entry.source || "Direct / unspecified"}</p></dd></div>
    </dl>
    <form onSubmit={submit} className="mt-5 grid items-end gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-[180px_1fr_auto]">
      <label className="text-sm font-bold">Review status<select className={fieldClass} value={status} onChange={e => setStatus(e.target.value as PitchEntry["status"])}>{REVIEW_STATUSES.map(s => <option key={s} value={s}>{labels[s]}</option>)}</select></label>
      <label className="text-sm font-bold">Private review notes<textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} maxLength={5000} className={fieldClass} /></label>
      <button disabled={busy} className="min-h-11 rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{busy ? "Saving…" : "Save review"}</button>
      {message ? <p role={failed ? "alert" : "status"} className={`text-sm font-bold sm:col-span-3 ${failed ? "text-rose-700" : "text-teal-800"}`}>{message}</p> : null}
    </form>
  </article>;
}

export function PartyPitchesClient({ initialConfig, initialEntries }: { initialConfig: PitchCampaign; initialEntries: PitchEntry[] }) {
  const router = useRouter();
  const [config, setConfig] = useState(initialConfig);
  const [savedConfig, setSavedConfig] = useState(initialConfig);
  const [entries, setEntries] = useState(initialEntries);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [visibleCount, setVisibleCount] = useState(25);
  const issues = campaignIssues(config);
  const filtered = entries.filter(e => (filter === "all" || e.status === filter) && [e.name, e.email, e.title, e.pitch, e.zip].join(" ").toLowerCase().includes(search.toLowerCase()));
  function change(key: keyof PitchCampaign, value: string) { setConfig(current => ({ ...current, [key]: value })); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(""); setFailed(false);
    try { const result = await save({ action: "settings", config }); setSavedConfig(result.config); setConfig(result.config); setMessage("Campaign settings saved."); router.refresh(); }
    catch (e) { setFailed(true); setMessage(e instanceof Error ? e.message : "Settings could not be saved."); }
    finally { setBusy(false); }
  }
  return <>
    <div className="mt-7 flex flex-wrap items-center justify-between gap-4"><p className="max-w-2xl text-sm font-semibold text-slate-600">Read every pitch, keep private notes, and build your shortlist. Status changes do not notify entrants or choose a winner.</p><div className="flex flex-wrap gap-3"><button onClick={() => window.location.reload()} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black">Refresh entries</button><Link href={PARTY_PITCH_PATH} className="rounded-xl border border-purple-300 bg-white px-4 py-3 text-sm font-black text-purple-900">View contest page</Link></div></div>
    <section className="mt-6 grid gap-3 sm:grid-cols-4">{[["Total entries", entries.length], ["New", entries.filter(e => e.status === "new").length], ["Shortlisted", entries.filter(e => e.status === "shortlisted").length], ["Entry status", entriesOpen(savedConfig) ? "Open" : savedConfig.status === "published" ? "Outside entry window" : savedConfig.status]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-2xl font-black capitalize">{value}</p></div>)}</section>
    <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-5" open={initialConfig.status === "draft"}>
      <summary className="cursor-pointer text-xl font-black">Contest setup &amp; entry dates</summary>
      <p className="mt-3 text-sm text-slate-600">Save a draft while details are undecided. Opening entries requires the exact prize, verified retail value, eligible area, dates, and complete Award Rules. All dates use Eastern Time; entries close at 11:59 p.m. One entry per email. Adults 18+. The winner chooses the party date.</p>
      <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">Status<select className={fieldClass} value={config.status} onChange={e => change("status", e.target.value)}><option value="draft">Draft — entries closed</option><option value="published">Published — accept entries during the entry window</option><option value="paused">Paused</option><option value="closed">Closed</option></select></label>
        <label className="text-sm font-bold">Verified prize retail value ($)<input type="number" min="0.01" step="0.01" className={fieldClass} value={config.retailValue} onChange={e => change("retailValue", e.target.value)} /></label>
        <label className="text-sm font-bold sm:col-span-2">Exact prize contents and fulfillment terms<textarea rows={3} maxLength={3000} className={fieldClass} value={config.prize} onChange={e => change("prize", e.target.value)} placeholder="Include equipment, delivery, setup, collection, mandatory fees, taxes, availability, and weather arrangements." /></label>
        <label className="text-sm font-bold sm:col-span-2">Eligible area<input maxLength={1000} className={fieldClass} value={config.eligibleArea} onChange={e => change("eligibleArea", e.target.value)} /></label>
        <label className="text-sm font-bold">Entries open<input type="date" className={fieldClass} value={config.opensOn} onChange={e => change("opensOn", e.target.value)} /></label>
        <label className="text-sm font-bold">Entries close<input type="date" className={fieldClass} value={config.closesOn} onChange={e => change("closesOn", e.target.value)} /></label>
        <label className="text-sm font-bold">Winner announcement<input type="date" className={fieldClass} value={config.announcesOn} onChange={e => change("announcesOn", e.target.value)} /></label>
        <label className="text-sm font-bold sm:col-span-2">Google Ads campaign ID <span className="font-normal">(after publishing the Display campaign)</span><input inputMode="numeric" pattern="[0-9]{1,19}" maxLength={19} className={fieldClass} value={config.googleCampaignId || ""} onChange={e => change("googleCampaignId", e.target.value)} placeholder="Leave blank until the published campaign ID is verified" /><span className="mt-2 block text-xs font-normal text-slate-600">Connects this contest to Google impressions, clicks and spend. Saving an ID does not launch an ad or authorize a budget. Use the campaign ID from Google Ads, not a draft ID or customer ID.</span></label>
        <label className="text-sm font-bold sm:col-span-2">Award Rules<textarea rows={8} maxLength={20000} className={fieldClass} value={config.rules} onChange={e => change("rules", e.target.value)} placeholder="Sponsor, eligibility and exclusions, 1 prize and its value, no purchase necessary, judging criteria and weights, judges, tie procedure, notification, claiming and fulfillment, privacy and publication permissions." /></label>
        {issues.length ? <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950 sm:col-span-2"><p className="font-black">Before entries can open</p><ul className="mt-2 list-disc space-y-1 pl-5">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div> : null}
        {message ? <p role={failed ? "alert" : "status"} className={`text-sm font-bold sm:col-span-2 ${failed ? "text-rose-700" : "text-teal-800"}`}>{message}</p> : null}
        <div className="sm:col-span-2"><button disabled={busy} className="rounded-xl bg-purple-800 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "Saving…" : "Save contest settings"}</button></div>
      </form>
    </details>
    <section className="mt-8" aria-label="All party pitch applicants">
      <div className="flex flex-wrap items-end gap-4"><label className="min-w-56 flex-1 text-sm font-bold">Search applicants and pitches<input type="search" value={search} onChange={e => { setSearch(e.target.value); setVisibleCount(25); }} className={fieldClass} placeholder="Name, email, party idea, or ZIP" /></label><label className="text-sm font-bold">Review status<select value={filter} onChange={e => { setFilter(e.target.value); setVisibleCount(25); }} className={fieldClass}><option value="all">All statuses</option>{REVIEW_STATUSES.map(s => <option key={s} value={s}>{labels[s]}</option>)}</select></label></div>
      <p className="my-4 text-sm font-semibold text-slate-500">{filtered.length} matching {filtered.length === 1 ? "entry" : "entries"} · newest first</p>
      {filtered.length ? <div className="space-y-4">{filtered.slice(0, visibleCount).map(entry => <EntryCard key={entry.id} entry={entry} onSaved={updated => setEntries(current => current.map(e => e.id === updated.id ? updated : e))} />)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-9 text-center"><h2 className="text-xl font-black">{entries.length ? "No pitches match these filters" : "No party pitches yet"}</h2><p className="mt-3 text-sm text-slate-600">{entries.length ? "Try another name, phrase, or review status." : "Once entries open, every saved application will appear here with its full pitch and contact details."}</p></div>}
      {filtered.length > visibleCount ? <button className="mt-5 rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold" onClick={() => setVisibleCount(n => n + 25)}>Show more entries ({filtered.length - visibleCount} remaining)</button> : null}
    </section>
  </>;
}
