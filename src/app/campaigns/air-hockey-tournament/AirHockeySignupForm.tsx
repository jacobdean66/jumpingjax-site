"use client";

import { useMemo, useState } from "react";

export function AirHockeySignupForm({ isOpen }: { isOpen: boolean }) {
  const [state, setState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [playerCount, setPlayerCount] = useState("1");
  const utm = useMemo(() => {
    if (typeof window === "undefined") return {};
    const params = new URLSearchParams(window.location.search);
    return { utmSource: params.get("utm_source"), utmMedium: params.get("utm_medium"), utmCampaign: params.get("utm_campaign"), utmContent: params.get("utm_content"), landingUrl: window.location.href };
  }, []);
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOpen) return;
    const form = new FormData(event.currentTarget);
    setState("saving");
    const response = await fetch("/api/campaigns/air-hockey/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ parentName: form.get("parentName"), childName: form.get("childName"), email: form.get("email"), phone: form.get("phone"), playerCount, notes: form.get("notes"), ...utm }) });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) { setMessage(payload.error ?? "Signup could not be saved."); setState("error"); return; }
    event.currentTarget.reset();
    setPlayerCount("1");
    setState("success");
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-black text-slate-800">Parent name<input required name="parentName" disabled={!isOpen || state === "saving"} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base font-semibold" /></label>
        <label className="text-sm font-black text-slate-800">Player name<input name="childName" disabled={!isOpen || state === "saving"} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base font-semibold" /></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-black text-slate-800">Email<input required type="email" name="email" disabled={!isOpen || state === "saving"} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base font-semibold" /></label>
        <label className="text-sm font-black text-slate-800">Phone<input required type="tel" name="phone" disabled={!isOpen || state === "saving"} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base font-semibold" /></label>
      </div>
      <label className="text-sm font-black text-slate-800">Players<select value={playerCount} onChange={(event) => setPlayerCount(event.target.value)} disabled={!isOpen || state === "saving"} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base font-semibold">{[1, 2, 3, 4, 5, 6, 7, 8].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
      <label className="text-sm font-black text-slate-800">Notes<textarea name="notes" rows={3} disabled={!isOpen || state === "saving"} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base font-semibold" /></label>
      <button type="submit" disabled={!isOpen || state === "saving"} className="inline-flex min-h-12 items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-base font-black text-white disabled:bg-slate-400">{state === "saving" ? "Saving..." : isOpen ? "Join the tournament list" : "Signups not open yet"}</button>
      {state === "success" ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-950">You are on the list. Jumping Jax will follow up with the final tournament details.</p> : null}
      {state === "error" ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-950">{message}</p> : null}
    </form>
  );
}
