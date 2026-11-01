"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { MAX_ENTRY_PHOTOS } from "@/lib/admin/backyard-takeover";
import { prepareBackyardPhoto } from "@/lib/admin/backyard-photo-client";

let landing: Promise<boolean> | null = null;
function allowed() {
  const privacy = navigator as Navigator & { globalPrivacyControl?: boolean };
  return navigator.doNotTrack !== "1" && privacy.globalPrivacyControl !== true;
}
async function activity(kind: "landing" | "form_started" | "rental_click") {
  if (!allowed()) return false;
  try {
    const response = await fetch("/api/campaigns/backyard-takeover/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, query: window.location.search.slice(0, 3000) }), keepalive: true });
    return response.ok && (await response.json()).tracked === true;
  } catch { return false; }
}

const field = "mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-normal text-slate-950";
export function BackyardEntryForm({ open, preview = false, conversionDestination = "", eligibleArea, termsVersion, notice }: { open: boolean; preview?: boolean; conversionDestination?: string; eligibleArea: string; termsVersion: string; notice?: { title: string; message: string } }) {
  const started = useRef(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [saved, setSaved] = useState(false);
  useEffect(() => {
    if (preview) return;
    landing ??= activity("landing");
    let current = true;
    void landing.then(recorded => { if (recorded && current) trackAnalyticsEvent("backyard_landing_view", { campaign: "backyard_takeover" }); });
    return () => { current = false; };
  }, [preview]);
  function begin() {
    if (preview || started.current) return;
    started.current = true;
    void (landing ?? Promise.resolve()).then(async () => { if (await activity("form_started")) trackAnalyticsEvent("backyard_form_start", { campaign: "backyard_takeover" }); });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!open || preview) return;
    const form = new FormData(event.currentTarget);
    const photos = form.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
    if (photos.length < 1 || photos.length > MAX_ENTRY_PHOTOS) { setMessage("Choose one to three backyard photos."); return; }
    setBusy(true); setMessage("");
    try {
      form.delete("photos");
      for (const photo of photos) form.append("photos", await prepareBackyardPhoto(photo));
      await landing;
      form.set("attribution", window.location.search.slice(0, 3000));
      form.set("termsVersion", termsVersion);
      const response = await fetch("/api/campaigns/backyard-takeover", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Your entry could not be saved. Please try again.");
      setSaved(true);
      if (allowed() && data.created && typeof data.receiptId === "string") {
        trackAnalyticsEvent("backyard_entry_saved", { campaign: "backyard_takeover", transaction_id: data.receiptId });
        if (conversionDestination) trackAnalyticsEvent("conversion", { send_to: conversionDestination, transaction_id: data.receiptId });
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  }
  const rentalLink = <Link href="/rentals" onClick={() => { if (!preview) void (landing ?? Promise.resolve()).then(() => activity("rental_click")); }} className="mt-4 inline-flex min-h-12 items-center justify-center rounded-full bg-cyan-300 px-6 py-3 font-black text-slate-950">Explore party rentals</Link>;
  if (saved) return <section role="status" className="rounded-3xl bg-white p-6 text-slate-950 sm:p-8"><h2 className="text-3xl font-black">Your backyard is on the list.</h2><p className="mt-4 leading-relaxed">Thank you! Your entry has been received. Keep your party idea handy and watch for the winner announcement.</p><p className="mt-3 text-sm text-slate-600">One entry per customer each month. Repeated submissions do not add extra entries.</p>{rentalLink}</section>;
  return <>
    {(open || preview) ? <form onSubmit={submit} onFocusCapture={begin} className="rounded-3xl bg-white p-6 text-slate-950 sm:p-8" id="enter">
      <h2 className="text-3xl font-black">Show us your backyard.</h2><p className="mt-3 text-sm leading-relaxed text-slate-600">Upload your photos and tell us what you’d celebrate. Free entry for adults in {eligibleArea}; one entry per customer each month.</p>
      {preview ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">Owner preview. Submissions are disabled while the contest is closed.</p> : null}
      <fieldset disabled={busy || preview} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">Your name<input name="name" required maxLength={120} autoComplete="name" className={field} /></label>
        <label className="text-sm font-bold">Email<input name="email" type="email" required maxLength={254} autoComplete="email" className={field} /></label>
        <label className="text-sm font-bold">Phone (optional)<input name="phone" type="tel" maxLength={40} autoComplete="tel" className={field} /></label>
        <label className="text-sm font-bold">City<input name="city" required maxLength={100} autoComplete="address-level2" className={field} /></label>
        <label className="text-sm font-bold">ZIP code<input name="zip" required pattern="[0-9]{5}(-[0-9]{4})?" autoComplete="postal-code" className={field} /></label>
        <label className="text-sm font-bold sm:col-span-2">What would you celebrate?<textarea name="partyIdea" required minLength={10} maxLength={2000} rows={4} className={field} /></label>
        <label className="text-sm font-bold sm:col-span-2">Backyard photos<input name="photos" type="file" multiple required accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="mt-3 block w-full text-sm font-normal" /><span className="mt-2 block font-normal text-slate-500">1–3 photos, up to 20 MB each. Large photos are resized automatically. Please avoid people, house numbers and license plates. Photos are reviewed privately.</span></label>
        <label className="hidden" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
        <label className="flex items-start gap-3 text-sm sm:col-span-2"><input name="permission" type="checkbox" required className="mt-1 size-4 shrink-0" />I am 18 or older, live in the eligible area, and have permission to enter this property.</label>
        <label className="flex items-start gap-3 text-sm sm:col-span-2"><input name="rulesAccepted" type="checkbox" required className="mt-1 size-4 shrink-0" /><span>I have read and accept the <a href="#rules" className="font-bold underline">official contest rules</a> and <Link href="/privacy" className="font-bold underline">privacy policy</Link>.</span></label>
        <label className="flex items-start gap-3 text-sm sm:col-span-2"><input name="marketingConsent" type="checkbox" className="mt-1 size-4 shrink-0" />Optional: I agree to receive Jumping Jax marketing messages.</label>
        <label className="flex items-start gap-3 text-sm sm:col-span-2"><input name="photoPermission" type="checkbox" className="mt-1 size-4 shrink-0" />Optional: Jumping Jax may use my submitted backyard photos publicly.</label>
      </fieldset>
      <p role="alert" className="mt-4 text-sm font-bold text-rose-700">{message}</p>
      <button disabled={busy || preview} className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-orange-500 px-6 py-3 text-lg font-black text-slate-950 disabled:opacity-50">{busy ? "Saving your entry…" : "Enter my backyard"}</button>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">Your contact information and photos are used to administer this contest. Marketing and public photo permission are optional. Campaign links record limited visit and source information; supported browser tracking preferences are respected.</p>
    </form> : <section className="rounded-3xl bg-white p-6 text-slate-950 sm:p-8"><p className="text-sm font-black uppercase tracking-widest text-orange-700">{notice ? "Backyard Takeover" : "Coming soon"}</p><h2 className="mt-3 text-3xl font-black">{notice?.title ?? "Your backyard could be next."}</h2><p className="mt-4 leading-relaxed text-slate-600">{notice?.message ?? "We’re putting the final touches on the prize, dates and entry rules. Check back here for the Backyard Takeover contest."}</p><p className="mt-4 text-xs leading-relaxed text-slate-500">Campaign links record limited visit and source information. Supported browser tracking preferences are respected. <Link href="/privacy" className="underline">Privacy policy</Link></p>{rentalLink}</section>}
  </>;
}
