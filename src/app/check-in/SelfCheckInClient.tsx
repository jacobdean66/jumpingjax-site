"use client";

import Link from "next/link";
import { useState } from "react";

export const PENDING_SELF_CHECK_IN_KEY = "jumpingjax:pending-self-check-in";

type State = "form" | "submitting" | "complete";

export function SelfCheckInClient() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [state, setState] = useState<State>("form");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === "submitting") return;
    setState("submitting");
    setError(null);
    const payload = { firstName: firstName.trim(), lastName: lastName.trim(), age: Number(age) };
    try {
      const response = await fetch("/api/open-play/self-check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; needsWaiver?: boolean; error?: string }
        | null;
      if (result?.needsWaiver) {
        window.sessionStorage.setItem(PENDING_SELF_CHECK_IN_KEY, JSON.stringify(payload));
        window.location.assign("/waiver?afterCheckIn=1");
        return;
      }
      if (!response.ok || !result?.ok) throw new Error(result?.error || "Check-in could not be completed.");
      window.sessionStorage.removeItem(PENDING_SELF_CHECK_IN_KEY);
      setState("complete");
    } catch (caught) {
      setState("form");
      setError(caught instanceof Error ? caught.message : "Check-in could not be completed.");
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#cffafe_0,#fff8e8_48%,#fce7f3_100%)] px-4 py-10 text-slate-950 sm:py-14">
      <section className="mx-auto w-full max-w-xl rounded-[2rem] border-2 border-white bg-white/95 p-6 shadow-[0_22px_60px_rgba(15,23,42,0.14)] sm:p-9">
        <p className="text-center text-sm font-black uppercase tracking-[0.16em] text-cyan-800">Jumping Jax Open Play</p>
        {state === "complete" ? (
          <div className="text-center" role="status">
            <div className="mx-auto mt-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl" aria-hidden="true">✓</div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-emerald-950">You&apos;re checked in!</h1>
            <p className="mt-4 text-lg font-semibold leading-8 text-slate-700">Please see the front desk to finish admission.</p>
            <button type="button" onClick={() => { setFirstName(""); setLastName(""); setAge(""); setState("form"); }} className="mt-8 min-h-14 w-full rounded-full bg-slate-950 px-6 text-lg font-black text-white">Check in another person</button>
          </div>
        ) : (
          <>
            <h1 className="mt-3 text-center text-4xl font-black tracking-tight sm:text-5xl">Check yourself in</h1>
            <p className="mx-auto mt-4 max-w-md text-center text-base font-semibold leading-7 text-slate-600">Enter the name and current age shown on your signed waiver.</p>
            <form onSubmit={submit} className="mt-8 grid gap-5">
              <label className="text-base font-black text-slate-800">First name<input autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={100} required className="mt-2 min-h-16 w-full rounded-2xl border-2 border-slate-300 bg-white px-5 text-xl outline-none focus:border-cyan-600" /></label>
              <label className="text-base font-black text-slate-800">Last name<input autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={100} required className="mt-2 min-h-16 w-full rounded-2xl border-2 border-slate-300 bg-white px-5 text-xl outline-none focus:border-cyan-600" /></label>
              <label className="text-base font-black text-slate-800">Age<input type="number" inputMode="numeric" min="0" max="120" value={age} onChange={(event) => setAge(event.target.value)} required className="mt-2 min-h-16 w-full rounded-2xl border-2 border-slate-300 bg-white px-5 text-xl outline-none focus:border-cyan-600" /></label>
              {error ? <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-800">{error}</p> : null}
              <button type="submit" disabled={state === "submitting"} className="min-h-16 rounded-full bg-emerald-600 px-6 text-xl font-black text-white shadow-[0_6px_0_#047857] active:translate-y-1 active:shadow-none disabled:opacity-60">{state === "submitting" ? "Checking waiver…" : "Check in"}</button>
            </form>
            <p className="mt-7 text-center text-sm font-semibold text-slate-600">No waiver yet? We&apos;ll take you to the waiver automatically.</p>
            <Link href="/waiver" className="mt-3 flex min-h-12 items-center justify-center rounded-full border-2 border-orange-300 bg-orange-50 px-5 font-black text-orange-900">Sign a waiver</Link>
          </>
        )}
      </section>
    </main>
  );
}

