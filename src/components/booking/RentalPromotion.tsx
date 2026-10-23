"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { INFLATABLE_PROMOTION_CODE, normalizeInflatablePromotionCode, PROMOTION_STORAGE_EVENT, PROMOTION_STORAGE_KEY } from "@/lib/rentals/ad-promotion-state";

function readPromotion(): string {
  try { return sessionStorage.getItem(PROMOTION_STORAGE_KEY) === INFLATABLE_PROMOTION_CODE ? INFLATABLE_PROMOTION_CODE : ""; }
  catch { return ""; }
}

function subscribe(callback: () => void) {
  window.addEventListener(PROMOTION_STORAGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(PROMOTION_STORAGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useRentalPromotion() {
  return useSyncExternalStore(subscribe, readPromotion, () => "");
}

function savePromotion() {
  sessionStorage.setItem(PROMOTION_STORAGE_KEY, INFLATABLE_PROMOTION_CODE);
  window.dispatchEvent(new Event(PROMOTION_STORAGE_EVENT));
}

export function RentalPromotionNotice({ dark = false }: { dark?: boolean }) {
  const code = useRentalPromotion();
  if (!code) return null;
  return <aside role="status" aria-label="Saved rental discount" className={`mb-5 rounded-2xl border p-4 text-sm ${dark ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100" : "border-emerald-300 bg-emerald-50 text-emerald-950"}`}>
    <p className="font-black">Your rental offer: {code} · 15% off eligible inflatables</p>
    <p className="mt-1">Choose a bounce house, bounce-and-slide combo, or obstacle course. The savings appear in your rental estimate and agreement. Delivery and other services are excluded.</p>
    <nav aria-label="Eligible rental categories" className="mt-3 flex flex-wrap gap-x-4 gap-y-2 font-bold underline"><Link href="/rentals/bounce-houses#rental-units">Bounce houses</Link><Link href="/rentals/combos#rental-units">Combos</Link><Link href="/rentals/obstacle-courses#rental-units">Obstacle courses</Link></nav>
  </aside>;
}

export function RentalPromotionEntry({ discount, eligibleItems }: { discount: number; eligibleItems: boolean }) {
  const code = useRentalPromotion();
  const [entered, setEntered] = useState("");
  const [error, setError] = useState("");
  function apply() {
    if (!normalizeInflatablePromotionCode(entered)) { setError("That code is not recognized. Check the code on your offer."); return; }
    try { savePromotion(); setError(""); }
    catch { setError("This browser could not save the code. Contact Jumping Jax and mention GOOGLE15 before confirming your quote."); }
  }
  return <section aria-label="Rental promo code" className="mt-4 rounded-xl border border-emerald-300/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">
    {code ? <p role="status" className="font-bold">{discount > 0 ? `${code} applied: you save $${discount.toFixed(2)} on eligible inflatables.` : eligibleItems ? `${code} saved. Choose an available date to calculate your 15% savings.` : `${code} saved. Your cart needs an eligible bounce house, combo, or obstacle course for this discount.`}</p> : <>
      <label htmlFor="rental-promo-code" className="block font-bold">Have a rental promo code?</label>
      <div className="mt-2 flex flex-wrap gap-2"><input id="rental-promo-code" value={entered} onChange={event => setEntered(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); apply(); } }} maxLength={32} autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-describedby={error ? "rental-promo-error" : undefined} aria-invalid={Boolean(error)} className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/30 bg-slate-950 px-3 text-white" /><button type="button" onClick={apply} className="min-h-11 rounded-full bg-cyan-300 px-5 font-black text-slate-950">Apply code</button></div>
    </>}
    {error && <p id="rental-promo-error" role="alert" className="mt-2 text-amber-200">{error}</p>}
    <p className="mt-2 text-xs">The discount covers eligible inflatable rental prices only. Delivery, mileage, accessories, foam parties, and facility parties are excluded.</p>
  </section>;
}

export function ClaimRentalPromotion() {
  const code = useRentalPromotion();
  const [error, setError] = useState("");
  return <div className="mt-6 space-y-4">
    {code ? <Link href="/rentals#rental-categories" className="inline-flex min-h-12 items-center rounded-full bg-cyan-300 px-6 py-3 font-black text-slate-950">Choose my inflatable →</Link> : <button type="button" onClick={() => {
      try { savePromotion(); }
      catch { setError("Allow browser storage to save this offer, or contact us and mention the Google 15% offer."); return; }
      setError("");
    }} className="min-h-12 rounded-full bg-cyan-300 px-6 py-3 font-black text-slate-950">
      Claim my 15% discount
    </button>}
    {code && <div role="status" className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 p-4 text-emerald-100"><p className="font-black">Your code: <code className="select-all">{INFLATABLE_PROMOTION_CODE}</code></p><p className="mt-1 text-sm">Choose your inflatable and date next. Your savings appear in the estimate and agreement. Returning in another browser? Enter this code at checkout.</p></div>}
    {error && <p role="alert" className="text-amber-200">{error}</p>}
    {!code && <Link href="/rentals#rental-categories" className="block w-fit rounded-full border border-white/30 px-6 py-3 font-bold">Browse inflatable rentals</Link>}
  </div>;
}
