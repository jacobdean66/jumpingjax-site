"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ENTRY_STATUSES, MAX_ENTRY_PHOTOS, MAX_PHOTO_BYTES, entryCounts, photoUrl, type BackyardCampaign, type BackyardEntry } from "@/lib/admin/backyard-takeover";
import { backyardTimeInput, backyardTimeUtc, entryReadiness, type BackyardSettings } from "@/lib/admin/backyard-tracking";

const API = "/api/admin/campaigns/backyard-takeover";
const inputClass = "mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base font-normal text-slate-950";
const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
const caption = "🦆 GREENWOOD, WE MAY HAVE OVERDONE IT. 😂\n\nA giant duck. A Jeep full of rubber ducks. A whole inflatable parade. THIS PARTY HAS NO CHILL.\n\nWe’re dreaming up a Jumping Jax BACKYARD TAKEOVER—and your yard could be next.\n\nStart dreaming up your celebration. Contest dates, rental prize details and how to enter are coming soon!\n\nThe Jeep and UFO are part of the artwork, not the rental prize.\n\n#JumpingJax #GreenwoodSC #BackyardTakeover";

export function BackyardTakeoverClient({ initial }: { initial: { campaign: BackyardCampaign; entries: BackyardEntry[]; settings: BackyardSettings } }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [entryId, setEntryId] = useState(() => globalThis.crypto?.randomUUID?.() ?? "");
  const counts = entryCounts(initial.entries);
  const filtered = useMemo(() => initial.entries.filter(entry =>
    (filter === "all" || entry.status === filter) && `${entry.name} ${entry.email} ${entry.city} ${entry.zip} ${entry.partyIdea}`.toLowerCase().includes(search.trim().toLowerCase()),
  ), [initial.entries, filter, search]);

  async function send(key: string, body: FormData | Record<string, unknown>) {
    setBusy(key); setMessage(""); setFailed(false);
    try {
      const isUpload = body instanceof FormData;
      const response = await fetch(API, { method: "POST", headers: isUpload ? undefined : { "Content-Type": "application/json" }, body: isUpload ? body : JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Changes could not be saved.");
      setMessage(key === "new" ? "Customer entry and photos saved privately." : "Changes saved.");
      router.refresh();
      return true;
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "Could not save. Please try again."); return false; }
    finally { setBusy(""); }
  }

  async function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const files = form.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
    if (files.length > MAX_ENTRY_PHOTOS || files.some(file => file.size > MAX_PHOTO_BYTES)) {
      setFailed(true); setMessage("Choose up to three photos, each no larger than 1 MB."); return;
    }
    const body = new FormData();
    body.set("entry", JSON.stringify({ id: entryId || crypto.randomUUID(), name: form.get("name"), email: form.get("email"), phone: form.get("phone"), city: form.get("city"), zip: form.get("zip"), partyIdea: form.get("partyIdea"), source: form.get("source"), permission: form.get("permission") === "on", marketingConsent: form.get("marketingConsent") === "on", photoPermission: form.get("photoPermission") === "on" }));
    files.forEach(file => body.append("photos", file));
    if (await send("new", body)) { element.reset(); setEntryId(crypto.randomUUID()); }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget), values = Object.fromEntries(form);
    try {
      const settings: BackyardSettings = { ...initial.settings, opensAt: backyardTimeUtc(String(values.opensAt ?? "")), closesAt: backyardTimeUtc(String(values.closesAt ?? "")),
        announcesOn: String(values.announcesOn ?? ""), eligibleArea: String(values.eligibleArea ?? ""), retailValue: String(values.retailValue ?? ""),
        rulesConfirmed: form.get("rulesConfirmed") === "on", googleCampaignId: String(values.googleCampaignId ?? ""), googleConversionDestination: String(values.googleConversionDestination ?? "") };
      await send("settings", { action: "settings", ...values, settings });
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "Check the campaign dates."); }
  }

  async function review(event: FormEvent<HTMLFormElement>, entry: BackyardEntry) {
    event.preventDefault();
    await send(entry.id, { action: "review", id: entry.id, revision: entry.revision, ...Object.fromEntries(new FormData(event.currentTarget)) });
  }

  return <>
    <section className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Campaign entry totals">
      {[["Customer entries", counts.total], ["Reviewed", counts.reviewed], ["Shortlisted / selected", counts.shortlisted], ["Private photos", counts.photos]].map(([label, count]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 text-3xl font-black tabular-nums">{count}</p></div>)}
    </section>
    <p role="status" aria-live="polite" className={`mt-4 text-sm font-bold ${failed ? "text-rose-700" : "text-emerald-700"}`}>{message}</p>

    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-black">Customer entries</h2><div className="flex flex-wrap gap-3"><button type="button" onClick={() => router.refresh()} className="min-h-11 text-sm font-bold text-sky-700">Refresh entries</button><a href={`${API}?format=csv`} className="inline-flex min-h-11 items-center text-sm font-bold text-sky-700">Export all to CSV</a></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]"><label className="text-sm font-bold">Search<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, email, city or party idea" className={inputClass} /></label><label className="text-sm font-bold">Review status<select value={filter} onChange={event => setFilter(event.target.value)} className={inputClass}><option value="all">All entries</option>{ENTRY_STATUSES.map(status => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></label></div>
      {initial.entries.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6"><h3 className="font-black">The first backyard starts here.</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">Customer submissions will appear here automatically once entries open. You can also record customer entries and photos below.</p></div> : filtered.length === 0 ? <p className="mt-5 text-sm text-slate-600">No entries match this search.</p> : <div className="mt-5 grid gap-4">
        {filtered.map(entry => <article key={entry.id} data-entry-id={entry.id} className="min-w-0 rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-lg font-black">{entry.name}</h3><p className="text-sm text-slate-600">{entry.city}, {entry.zip} · {entry.source}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${entry.status === "winner" ? "bg-yellow-100 text-yellow-900" : entry.status === "shortlisted" ? "bg-cyan-100 text-cyan-900" : "bg-slate-100 text-slate-700"}`}>{entry.status}</span></div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 break-all text-sm"><a href={`mailto:${entry.email}`} className="text-sky-700 underline">{entry.email}</a>{entry.phone ? <span>{entry.phone}</span> : null}</div>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{entry.partyIdea}</p>
          {entry.photos.length ? <div className="mt-4 grid grid-cols-3 gap-2">{entry.photos.map((path, index) => <a key={path} href={photoUrl(entry.id, path)} target="_blank" rel="noreferrer" aria-label={`Open ${entry.name}'s backyard photo ${index + 1}`}>
            {/* Private images require the owner's session cookie, not a public image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl(entry.id, path)} alt={`${entry.name}'s backyard, photo ${index + 1}`} className="aspect-[4/3] w-full rounded-lg border border-slate-200 object-cover" loading="lazy" />
          </a>)}</div> : <p className="mt-3 text-xs text-slate-500">No photos attached.</p>}
          <p className="mt-3 text-xs text-slate-500">Marketing permission: {entry.marketingConsent ? "Yes" : "Not granted"} · Public photo permission: {entry.photoPermission ? "Yes" : "Not granted"}</p>
          <form key={`${entry.status}-${entry.reviewNotes}-${entry.score}`} onSubmit={event => review(event, entry)} className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
            <fieldset disabled={Boolean(busy)} className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Status<select name="status" defaultValue={entry.status} className={inputClass}>{ENTRY_STATUSES.map(status => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></label><label className="text-sm font-bold">Judging score (optional)<input type="number" name="score" defaultValue={entry.score ?? ""} min="0" max="100" step="1" className={inputClass} /></label><label className="text-sm font-bold sm:col-span-2">Private review notes<textarea name="reviewNotes" defaultValue={entry.reviewNotes} maxLength={4000} rows={2} className={inputClass} /></label></fieldset>
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">Entered {new Date(entry.createdAt).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" })}</p><button disabled={Boolean(busy)} className={buttonClass}>{busy === entry.id ? "Saving…" : "Save review"}</button></div>
          </form>
        </article>)}
      </div>}
    </section>

    <details className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
      <summary className="cursor-pointer text-xl font-black">Add a customer entry</summary>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">Record an entry received directly from a customer. Photos are private and visible to the owner. No email or message is sent from this form.</p>
      <form onSubmit={addEntry} className="mt-4 grid gap-4">
        <fieldset disabled={Boolean(busy)} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">Customer name<input name="name" required maxLength={120} autoComplete="name" className={inputClass} /></label>
          <label className="text-sm font-bold">Email<input name="email" type="email" required maxLength={254} autoComplete="email" className={inputClass} /></label>
          <label className="text-sm font-bold">Phone (optional)<input name="phone" type="tel" maxLength={40} autoComplete="tel" className={inputClass} /></label>
          <label className="text-sm font-bold">City<input name="city" required maxLength={100} autoComplete="address-level2" className={inputClass} /></label>
          <label className="text-sm font-bold">ZIP code<input name="zip" required pattern="[0-9]{5}(-[0-9]{4})?" maxLength={10} autoComplete="postal-code" className={inputClass} /></label>
          <label className="text-sm font-bold">Entry source<select name="source" className={inputClass}><option value="manual">Direct / manual</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="google">Google</option><option value="other">Other</option></select></label>
          <label className="text-sm font-bold sm:col-span-2">What would they celebrate?<textarea name="partyIdea" required minLength={10} maxLength={2000} rows={3} className={inputClass} /></label>
          <label className="text-sm font-bold sm:col-span-2">Backyard photos (optional)<input type="file" name="photos" multiple accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full text-sm font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-50 file:px-3 file:py-2 file:font-bold file:text-cyan-900" /><span className="mt-2 block text-xs font-normal text-slate-500">Up to 3 JPG, PNG or WebP photos, 1 MB each. Location metadata is removed when saved.</span></label>
          <label className="flex items-start gap-2 text-sm sm:col-span-2"><input name="permission" type="checkbox" required className="mt-1 size-4 shrink-0" />The customer has confirmed they are 18+ and have permission to enter this property.</label>
          <label className="flex items-start gap-2 text-sm sm:col-span-2"><input name="marketingConsent" type="checkbox" className="mt-1 size-4 shrink-0" />The customer separately agreed to marketing messages.</label>
          <label className="flex items-start gap-2 text-sm sm:col-span-2"><input name="photoPermission" type="checkbox" className="mt-1 size-4 shrink-0" />The customer separately agreed to public use of their photos.</label>
        </fieldset>
        <button disabled={Boolean(busy)} className={`${buttonClass} justify-self-start`}>{busy === "new" ? "Saving entry and photos…" : "Save private entry"}</button>
      </form>
    </details>

    <details className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
      <summary className="cursor-pointer text-xl font-black">Campaign planning & ad tracking</summary>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">Finalize the prize and rules, choose the entry window, and connect the new ad campaign IDs. Opening contest entries does not publish or activate advertising.</p>
      {entryReadiness(initial.campaign,initial.settings).length > 0 && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950"><p className="font-black">Before entries can open</p><ul className="mt-2 list-disc space-y-1 pl-5">{entryReadiness(initial.campaign,initial.settings).map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
      <form onSubmit={saveSettings} className="mt-4 grid gap-4">
        <fieldset disabled={Boolean(busy)} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">Customer entry status<select name="status" defaultValue={initial.campaign.status} className={inputClass}><option value="draft">Draft — entries closed</option><option value="published">Open / scheduled — requires finalized details</option><option value="paused">Paused</option><option value="closed">Closed</option></select></label>
          <label className="text-sm font-bold">Entries open (Eastern time)<input name="opensAt" type="datetime-local" defaultValue={backyardTimeInput(initial.settings.opensAt)} className={inputClass} /></label>
          <label className="text-sm font-bold">Entries close (Eastern time)<input name="closesAt" type="datetime-local" defaultValue={backyardTimeInput(initial.settings.closesAt)} className={inputClass} /></label>
          <label className="text-sm font-bold">Winner announcement date<input name="announcesOn" type="date" defaultValue={initial.settings.announcesOn} className={inputClass} /></label>
          <label className="text-sm font-bold">Maximum prize value ($)<input name="retailValue" type="number" min="0.01" step="0.01" defaultValue={initial.settings.retailValue} className={inputClass} /></label>
          <label className="text-sm font-bold sm:col-span-2">Eligible area<input name="eligibleArea" maxLength={300} defaultValue={initial.settings.eligibleArea} className={inputClass} /></label>
          <label className="text-sm font-bold">Google campaign ID (optional)<input name="googleCampaignId" inputMode="numeric" pattern="[0-9]*" defaultValue={initial.settings.googleCampaignId} className={inputClass} /><span className="mt-1 block text-xs font-normal text-slate-500">Use the new Backyard Takeover campaign, not the existing 15% offer.</span></label>
          <label className="text-sm font-bold">Meta campaign ID (optional)<input name="metaCampaignId" inputMode="numeric" pattern="[0-9]*" defaultValue={initial.campaign.metaCampaignId} className={inputClass} /></label>
          <label className="text-sm font-bold sm:col-span-2">Google contest-entry conversion destination (optional)<input name="googleConversionDestination" placeholder="AW-…/contest-entry-label" defaultValue={initial.settings.googleConversionDestination} maxLength={150} className={inputClass} /><span className="mt-1 block text-xs font-normal text-slate-500">Website entries are counted automatically. Add a separate Google conversion action here to send saved entries to Google Ads.</span></label>
          <label className="text-sm font-bold sm:col-span-2">Meta campaign name (optional)<input name="metaCampaignName" maxLength={200} defaultValue={initial.campaign.metaCampaignName} className={inputClass} /></label>
          <label className="text-sm font-bold sm:col-span-2">Proposed prize<textarea name="prize" maxLength={2000} rows={2} defaultValue={initial.campaign.prize} className={inputClass} /></label>
          <label className="text-sm font-bold sm:col-span-2">Rules & planning notes<textarea name="rules" maxLength={8000} rows={5} defaultValue={initial.campaign.rules} className={inputClass} /></label>
          <label className="flex items-start gap-2 text-sm sm:col-span-2"><input name="rulesConfirmed" type="checkbox" defaultChecked={initial.settings.rulesConfirmed} className="mt-1 size-4 shrink-0" />The official rules, prize, eligibility and judging process have been finalized and reviewed for this contest.</label>
        </fieldset>
        <div className="flex flex-wrap items-center gap-4"><button disabled={Boolean(busy)} className={buttonClass}>{busy === "settings" ? "Saving…" : "Save planning details"}</button><Link href={initial.campaign.metaCampaignId ? `/admin/ad-analytics?campaign_id=${encodeURIComponent(initial.campaign.metaCampaignId)}` : "/admin/ad-analytics"} className="inline-flex min-h-11 items-center text-sm font-bold text-sky-700">{initial.campaign.metaCampaignId ? "View linked Meta campaign" : "Open Meta Ad Analytics"}</Link><Link href="/admin/ad-analytics/google" className="inline-flex min-h-11 items-center text-sm font-bold text-sky-700">Open Google Ad Analytics</Link></div>
        {!initial.campaign.metaCampaignId && !initial.settings.googleCampaignId ? <p className="text-xs text-slate-500">Platform ad clicks remain unlinked until the new campaign IDs are saved. Website source tracking is ready through the destination links above.</p> : null}
      </form>
    </details>

    <details className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
      <summary className="cursor-pointer text-xl font-black">Social post caption · Draft</summary>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{caption}</p>
      <button type="button" className="mt-4 min-h-11 text-sm font-bold text-sky-700" onClick={async () => { try { await navigator.clipboard.writeText(caption); setFailed(false); setMessage("Draft caption copied."); } catch { setFailed(true); setMessage("Copy is unavailable in this browser. Select the caption text instead."); } }}>Copy draft caption</button>
    </details>
  </>;
}
