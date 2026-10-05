"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { INFLATABLE_PROMOTION_CODE, PROMOTION_STORAGE_EVENT, PROMOTION_STORAGE_KEY } from "@/lib/rentals/ad-promotion";

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

export function ClaimRentalPromotion() {
  const code = useRentalPromotion();
  const [error, setError] = useState("");
  return <div className="mt-6 space-y-4">
    <button type="button" onClick={() => {
      try { sessionStorage.setItem(PROMOTION_STORAGE_KEY, INFLATABLE_PROMOTION_CODE); }
      catch { setError("Allow browser storage to save this offer, or contact us and mention the Google 15% offer."); return; }
      setError("");
      window.dispatchEvent(new Event(PROMOTION_STORAGE_EVENT));
    }} className="min-h-12 rounded-full bg-cyan-300 px-6 py-3 font-black text-slate-950">
      {code ? "15% offer saved for this visit" : "Claim my 15% discount"}
    </button>
    {code && <p role="status" className="text-emerald-200">Your discount will appear in your rental estimate and request.</p>}
    {error && <p role="alert" className="text-amber-200">{error}</p>}
    <Link href="/rentals" className="block w-fit rounded-full border border-white/30 px-6 py-3 font-bold">Browse inflatable rentals</Link>
  </div>;
}
