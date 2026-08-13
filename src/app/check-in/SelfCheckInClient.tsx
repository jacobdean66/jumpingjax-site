"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export const PENDING_SELF_CHECK_IN_KEY = "jumpingjax:pending-self-check-in";

type State = "form" | "searching" | "results" | "checking-in" | "complete";
type WaiverMatch = {
  source: "native" | "legacy";
  participantId: string;
  firstName: string;
  lastName: string;
  ageYears: number;
};

export function SelfCheckInClient() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [state, setState] = useState<State>("form");
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<WaiverMatch[]>([]);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(PENDING_SELF_CHECK_IN_KEY);
    if (!saved) return;
    void Promise.resolve().then(() => {
      try {
        const pending = JSON.parse(saved) as { firstName?: string; lastName?: string; age?: number };
        setFirstName(pending.firstName ?? "");
        setLastName(pending.lastName ?? "");
        setAge(typeof pending.age === "number" ? String(pending.age) : "");
      } catch {
        window.sessionStorage.removeItem(PENDING_SELF_CHECK_IN_KEY);
      }
    });
  }, []);

  function resetResults() {
    if (state === "results") setState("form");
    setMatches([]);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === "searching" || state === "checking-in") return;
    setState("searching");
    setError(null);
    const payload = { firstName: firstName.trim(), lastName: lastName.trim(), age: Number(age) };
    try {
      const response = await fetch("/api/open-play/self-check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; matches?: WaiverMatch[]; error?: string }
        | null;
      if (!response.ok || !result?.ok) throw new Error(result?.error || "Waiver search could not be completed.");
      setMatches(result.matches ?? []);
      setState("results");
    } catch (caught) {
      setState("form");
      setError(caught instanceof Error ? caught.message : "Waiver search could not be completed.");
    }
  }

  async function checkIn(match: WaiverMatch) {
    if (state === "checking-in") return;
    setState("checking-in");
    setError(null);
    const payload = { firstName: firstName.trim(), lastName: lastName.trim(), age: Number(age) };
    try {
      const response = await fetch("/api/open-play/self-check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, mode: "check-in", source: match.source, participantId: match.participantId }),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; needsWaiver?: boolean; error?: string } | null;
      if (result?.needsWaiver) throw new Error("That waiver is no longer available. Please search again.");
      if (!response.ok || !result?.ok) throw new Error(result?.error || "Check-in could not be completed.");
      window.sessionStorage.removeItem(PENDING_SELF_CHECK_IN_KEY);
      setState("complete");
    } catch (caught) {
      setState("results");
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
            <button type="button" onClick={() => { setFirstName(""); setLastName(""); setAge(""); setMatches([]); setState("form"); }} className="mt-8 min-h-14 w-full rounded-full bg-slate-950 px-6 text-lg font-black text-white">Check in another person</button>
          </div>
        ) : (
          <>
            <h1 className="mt-3 text-center text-4xl font-black tracking-tight sm:text-5xl">Check yourself in</h1>
            <p className="mx-auto mt-4 max-w-md text-center text-base font-semibold leading-7 text-slate-600">Enter the first name, last name, and current age on the signed waiver.</p>
            <form onSubmit={submit} className="mt-8 grid gap-5">
              <label className="text-base font-black text-slate-800">First name<input autoComplete="given-name" value={firstName} onChange={(event) => { setFirstName(event.target.value); resetResults(); }} maxLength={100} required className="mt-2 min-h-16 w-full rounded-2xl border-2 border-slate-300 bg-white px-5 text-xl outline-none focus:border-cyan-600" /></label>
              <label className="text-base font-black text-slate-800">Last name<input autoComplete="family-name" value={lastName} onChange={(event) => { setLastName(event.target.value); resetResults(); }} maxLength={100} required className="mt-2 min-h-16 w-full rounded-2xl border-2 border-slate-300 bg-white px-5 text-xl outline-none focus:border-cyan-600" /></label>
              <label className="text-base font-black text-slate-800">Age<input type="number" inputMode="numeric" min="0" max="120" value={age} onChange={(event) => { setAge(event.target.value); resetResults(); }} required className="mt-2 min-h-16 w-full rounded-2xl border-2 border-slate-300 bg-white px-5 text-xl outline-none focus:border-cyan-600" /></label>
              {error ? <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-800">{error}</p> : null}
              <button type="submit" disabled={state === "searching" || state === "checking-in"} className="min-h-16 rounded-full bg-emerald-600 px-6 text-xl font-black text-white shadow-[0_6px_0_#047857] active:translate-y-1 active:shadow-none disabled:opacity-60">{state === "searching" ? "Checking for waiver…" : "Check for waiver"}</button>
            </form>
            {state === "results" || state === "checking-in" ? (
              <section className="mt-7" aria-live="polite">
                {matches.length ? (
                  <>
                    <h2 className="text-center text-2xl font-black">Choose the correct waiver</h2>
                    <p className="mt-2 text-center font-semibold text-slate-600">Tap the matching name and age to check in.</p>
                    <div className="mt-4 grid gap-3">
                      {matches.map((match) => (
                        <button key={`${match.source}:${match.participantId}`} type="button" disabled={state === "checking-in"} onClick={() => void checkIn(match)} className="min-h-20 rounded-2xl border-2 border-cyan-300 bg-cyan-50 px-5 text-left text-xl font-black text-cyan-950 shadow-sm active:bg-cyan-100 disabled:opacity-60">
                          {match.firstName} {match.lastName} — Age {match.ageYears}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 text-center">
                    <h2 className="text-xl font-black text-amber-950">No current waiver found</h2>
                    <p className="mt-2 font-semibold text-amber-900">Check the spelling and age, or sign a new waiver.</p>
                  </div>
                )}
              </section>
            ) : null}
            <p className="mt-7 text-center text-sm font-semibold text-slate-600">No waiver yet? Sign one below, then return here to choose the correct person.</p>
            <Link href="/waiver" onClick={() => window.sessionStorage.setItem(PENDING_SELF_CHECK_IN_KEY, JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), age: Number(age) }))} className="mt-3 flex min-h-12 items-center justify-center rounded-full border-2 border-orange-300 bg-orange-50 px-5 font-black text-orange-900">Sign a waiver</Link>
          </>
        )}
      </section>
    </main>
  );
}
