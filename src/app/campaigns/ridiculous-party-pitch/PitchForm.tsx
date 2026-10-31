"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

const inputClass = "mt-2 block w-full rounded-xl border border-purple-200 bg-white px-4 py-3 font-medium text-slate-950 focus:outline-none focus:ring-2 focus:ring-purple-500";

export function PitchForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pitch, setPitch] = useState("");
  const words = pitch.trim() ? pitch.trim().split(/\s+/).length : 0;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (words > 150) { setError("Keep your pitch to 150 words or fewer."); return; }
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams(window.location.search);
    setBusy(true);
    try {
      const response = await fetch("/api/campaigns/ridiculous-party-pitch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...Object.fromEntries(form), guests: Number(form.get("guests")),
          adultAcknowledged: form.get("adultAcknowledged") === "on", rulesAcknowledged: form.get("rulesAcknowledged") === "on",
          utmSource: params.get("utm_source"), utmMedium: params.get("utm_medium"), utmCampaign: params.get("utm_campaign"), utmContent: params.get("utm_content"),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.id) throw new Error(result.error || "Your pitch could not be saved.");
      setConfirmation(result.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Your pitch could not be saved. Please try again."); }
    finally { setBusy(false); }
  }
  if (confirmation) return <section className="rounded-3xl border-2 border-teal-300 bg-teal-50 p-6 sm:p-9" role="status">
    <h2 className="text-3xl font-black text-purple-950">Your ridiculous idea is officially on the list.</h2>
    <p className="mt-4 leading-relaxed">Your entry is saved. We&apos;ll contact the selected entrant using the details provided. One entry per email; resubmitting does not replace your original pitch.</p>
    <p className="mt-3 break-all text-sm">Entry reference: {confirmation}</p>
    <p className="mt-5 font-bold">Already want to make it happen?</p>
    <Link href="/rentals" className="mt-3 inline-block rounded-full bg-purple-800 px-6 py-3 font-black text-white">Explore party rentals</Link>
  </section>;
  return <form onSubmit={submit} className="rounded-3xl border-2 border-purple-100 bg-white p-6 shadow-lg sm:p-9">
    <h2 className="text-3xl font-black text-purple-950">What&apos;s your ridiculous reason?</h2>
    <p className="mt-3 text-slate-600">Tell us what you&apos;re celebrating, why it deserves a party, and how you&apos;d make it happen. No video or purchase needed.</p>
    <div className="mt-6 grid gap-5 sm:grid-cols-2">
      <label className="font-bold">Your name<input name="name" autoComplete="name" required maxLength={100} className={inputClass} /></label>
      <label className="font-bold">Email<input name="email" type="email" autoComplete="email" required maxLength={200} className={inputClass} /></label>
      <label className="font-bold">Phone <span className="font-normal">(optional)</span><input name="phone" type="tel" autoComplete="tel" maxLength={40} className={inputClass} /></label>
      <label className="font-bold">Event ZIP code<input name="zip" autoComplete="postal-code" inputMode="numeric" required pattern="[0-9]{5}(-[0-9]{4})?" maxLength={10} className={inputClass} /></label>
      <label className="font-bold">Preferred event month<input name="eventMonth" type="month" required className={inputClass} /></label>
      <label className="font-bold">Approximate guest count<input name="guests" type="number" required min={1} max={1000} step={1} className={inputClass} /></label>
      <label className="font-bold sm:col-span-2">Give your party a name<input name="title" required maxLength={120} placeholder="The Recliner Retirement Reception" className={inputClass} /></label>
      <label className="font-bold sm:col-span-2">Your party pitch<textarea name="pitch" required minLength={20} maxLength={3000} rows={5} value={pitch} onChange={e => setPitch(e.target.value)} aria-describedby="pitch-word-count" className={inputClass} /><span id="pitch-word-count" className={`mt-2 block text-sm ${words > 150 ? "text-rose-700" : "text-slate-500"}`}>{words} / 150 words</span></label>
    </div>
    <div className="absolute -left-[9999px]" aria-hidden="true"><label>Leave this blank<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <label className="mt-5 flex items-start gap-3 text-sm"><input type="checkbox" name="adultAcknowledged" required className="mt-1 size-4 shrink-0" /><span>I am 18 or older and meet the eligibility requirements in the Award Rules.</span></label>
    <label className="mt-4 flex items-start gap-3 text-sm"><input type="checkbox" name="rulesAcknowledged" required className="mt-1 size-4 shrink-0" /><span>I have read and agree to the <a href="#award-rules" className="font-bold underline">Award Rules</a>. My entry is original and safe to carry out. One entry per email.</span></label>
    <p className="mt-4 text-xs leading-relaxed text-slate-500">Your contact details and pitch are used to administer the contest and contact the selected entrant. Entries are reviewed privately; submission does not subscribe you to marketing. See our <Link href="/privacy" className="underline">privacy policy</Link>.</p>
    {error ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 font-bold text-rose-800">{error}</p> : null}
    <button type="submit" disabled={busy || words > 150} className="mt-6 min-h-12 rounded-full bg-purple-800 px-8 py-3 font-black text-white hover:bg-purple-900 disabled:opacity-50">{busy ? "Saving your pitch…" : "Pitch my party"}</button>
  </form>;
}
