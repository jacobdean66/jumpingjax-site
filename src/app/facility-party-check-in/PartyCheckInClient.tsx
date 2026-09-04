"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import type {
  FacilityPartyWaiverMatch,
  PublicFacilityParty,
} from "@/lib/facility-parties/check-in";

type Screen = "choice" | "search" | "complete";
type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "results"; matches: FacilityPartyWaiverMatch[] }
  | { status: "checking-in"; matches: FacilityPartyWaiverMatch[] }
  | { status: "error"; message: string };

const fieldClass =
  "mt-2 min-h-14 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-lg text-slate-950 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-200";
const choiceClass =
  "min-h-24 rounded-3xl border-2 p-5 text-left shadow-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4";

export function PartyCheckInClient({
  bookingId,
  partyDate,
}: {
  bookingId: string;
  partyDate: string | null;
}) {
  const [party, setParty] = useState<PublicFacilityParty | null>(null);
  const [partyError, setPartyError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("choice");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const [completeMessage, setCompleteMessage] = useState("");

  const waiverUrl = useMemo(() => {
    const params = new URLSearchParams({
      source: "facility-party",
      booking: bookingId,
      arrival: "1",
    });
    if (partyDate) params.set("date", partyDate);
    return `/waiver?${params.toString()}`;
  }, [bookingId, partyDate]);

  const refreshParty = useCallback(async (quiet = false) => {
    try {
      const response = await fetch(
        `/api/facility-party/check-in?bookingId=${encodeURIComponent(bookingId)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; party?: PublicFacilityParty; error?: string }
        | null;
      if (!response.ok || !payload?.ok || !payload.party) {
        throw new Error(payload?.error || "This party link is not available.");
      }
      setParty(payload.party);
      setPartyError(null);
    } catch (error) {
      if (!quiet) {
        setPartyError(
          error instanceof Error ? error.message : "This party link is not available.",
        );
      }
    }
  }, [bookingId]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refreshParty(), 0);
    const timer = window.setInterval(() => void refreshParty(true), 15_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refreshParty]);

  function resetSearch() {
    setFirstName("");
    setLastName("");
    setSearch({ status: "idle" });
  }

  async function findWaiver(event: FormEvent) {
    event.preventDefault();
    if (search.status === "loading" || search.status === "checking-in") return;
    setSearch({ status: "loading" });
    try {
      const response = await fetch("/api/facility-party/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          mode: "search",
          bookingId,
          partyDate,
          firstName,
          lastName,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; matches?: FacilityPartyWaiverMatch[]; error?: string }
        | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "We could not search waivers right now.");
      }
      setSearch({ status: "results", matches: payload.matches ?? [] });
    } catch (error) {
      setSearch({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "We could not search waivers right now.",
      });
    }
  }

  async function checkIn(match: FacilityPartyWaiverMatch) {
    const matches = search.status === "results" ? search.matches : [];
    setSearch({ status: "checking-in", matches });
    try {
      const response = await fetch("/api/facility-party/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          mode: "check-in",
          bookingId,
          partyDate,
          firstName,
          lastName,
          participantId: match.participantId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; error?: string }
        | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "We could not check you in right now.");
      }
      setCompleteMessage(payload.message || "You are checked in for the party.");
      setScreen("complete");
      await refreshParty(true);
    } catch (error) {
      setSearch({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "We could not check you in right now.",
      });
    }
  }

  if (partyError) {
    return (
      <main className="min-h-screen bg-cyan-100 px-4 py-8 text-slate-950 sm:px-6 sm:py-12">
        <section className="mx-auto w-full max-w-xl rounded-[1.75rem] border-2 border-white bg-white/95 px-5 py-8 text-center shadow-[0_18px_48px_rgba(8,145,178,0.16)]">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-800">Jumping Jax party check-in</p>
          <h1 className="mt-3 text-3xl font-black">Party unavailable</h1>
          <p role="alert" className="mt-3 font-semibold text-slate-600">{partyError}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#cffafe_0,#fff8e8_48%,#fce7f3_100%)] px-4 py-7 text-slate-950 sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-2xl rounded-[2rem] border-2 border-white bg-white/95 p-5 shadow-[0_22px_60px_rgba(15,23,42,0.14)] sm:p-9">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-cyan-800">Jumping Jax party check-in</p>
        <h1 className="mt-3 text-balance text-4xl font-black tracking-tight sm:text-5xl">
          {party ? `${party.title}'s party` : "Loading party…"}
        </h1>
        {party ? (
          <p className="mt-3 text-lg font-semibold text-slate-600">
            {[party.partyLabel, party.date, party.time].filter(Boolean).join(" · ")}
          </p>
        ) : null}

        {screen === "choice" ? (
          <section className="mt-8" aria-labelledby="waiver-question">
            <h2 id="waiver-question" className="text-2xl font-black">Do you already have a valid Jumping Jax waiver?</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setScreen("search")}
                className={`${choiceClass} border-emerald-300 bg-emerald-50 text-emerald-950 hover:border-emerald-600 focus-visible:ring-emerald-200`}
              >
                <span className="block text-2xl font-black">Yes</span>
                <span className="mt-1 block font-semibold">Find my waiver by first and last name</span>
              </button>
              <Link
                href={waiverUrl}
                className={`${choiceClass} border-orange-300 bg-orange-50 text-orange-950 hover:border-orange-600 focus-visible:ring-orange-200`}
              >
                <span className="block text-2xl font-black">No</span>
                <span className="mt-1 block font-semibold">Sign a waiver, then check in automatically</span>
              </Link>
            </div>
          </section>
        ) : null}

        {screen === "search" ? (
          <section className="mt-8">
            <button type="button" onClick={() => { resetSearch(); setScreen("choice"); }} className="font-black text-cyan-800">← Back</button>
            <h2 className="mt-4 text-2xl font-black">Find your waiver</h2>
            <p className="mt-2 font-semibold text-slate-600">Enter the participant’s first and last name exactly as it appears on the waiver.</p>
            <form onSubmit={findWaiver} className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="font-black text-slate-800">First name
                <input required maxLength={80} autoComplete="given-name" value={firstName} onChange={(event) => { setFirstName(event.target.value); setSearch({ status: "idle" }); }} className={fieldClass} />
              </label>
              <label className="font-black text-slate-800">Last name
                <input required maxLength={80} autoComplete="family-name" value={lastName} onChange={(event) => { setLastName(event.target.value); setSearch({ status: "idle" }); }} className={fieldClass} />
              </label>
              <button type="submit" disabled={search.status === "loading" || search.status === "checking-in"} className="min-h-14 rounded-full bg-emerald-600 px-6 text-lg font-black text-white shadow-[0_5px_0_#047857] disabled:opacity-60 sm:col-span-2">
                {search.status === "loading" ? "Searching…" : "Find my waiver"}
              </button>
            </form>

            {search.status === "results" || search.status === "checking-in" ? (
              <div className="mt-6" aria-live="polite">
                {search.matches.length ? (
                  <>
                    <h3 className="text-xl font-black">Choose your name</h3>
                    <div className="mt-3 grid gap-3">
                      {search.matches.map((match) => (
                        <button
                          key={match.participantId}
                          type="button"
                          disabled={search.status === "checking-in"}
                          onClick={() => void checkIn(match)}
                          className="min-h-16 rounded-2xl border-2 border-cyan-300 bg-cyan-50 px-5 text-left text-lg font-black text-cyan-950 transition hover:border-cyan-600 disabled:opacity-60"
                        >
                          {match.firstName} {match.lastName}
                          {match.ageYears !== null ? <span className="ml-2 text-sm font-bold text-cyan-800">Age {match.ageYears}</span> : null}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 text-center text-amber-950">
                    <h3 className="text-xl font-black">No current waiver found</h3>
                    <p className="mt-2 font-semibold">Check the spelling or sign a new waiver.</p>
                    <Link href={waiverUrl} className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-orange-600 px-6 font-black text-white">Sign waiver</Link>
                  </div>
                )}
              </div>
            ) : null}
            {search.status === "error" ? <p role="alert" className="mt-5 rounded-2xl border-2 border-red-200 bg-red-50 p-4 font-bold text-red-900">{search.message}</p> : null}
          </section>
        ) : null}

        {screen === "complete" ? (
          <section className="mt-8 rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-950" role="status">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-white text-3xl" aria-hidden="true">✓</div>
            <h2 className="mt-4 text-3xl font-black">You’re checked in!</h2>
            <p className="mt-2 font-semibold leading-7">{completeMessage}</p>
            <button type="button" onClick={() => { resetSearch(); setScreen("choice"); }} className="mt-5 min-h-12 rounded-full bg-slate-950 px-6 font-black text-white">Check in another guest</button>
          </section>
        ) : null}

        <section className="mt-8 border-t-2 border-slate-100 pt-7" aria-labelledby="checked-in-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-800">Live guest list</p>
              <h2 id="checked-in-heading" className="mt-1 text-2xl font-black">Who’s checked in</h2>
            </div>
            <span className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-black text-cyan-950">{party?.checkedInGuests.length ?? 0} here</span>
          </div>
          {party?.checkedInGuests.length ? (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2" aria-live="polite">
              {party.checkedInGuests.map((guest) => (
                <li key={guest.id} className="flex min-h-12 items-center gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 font-black text-cyan-950">
                  <span className="flex size-7 items-center justify-center rounded-full bg-emerald-600 text-sm text-white" aria-hidden="true">✓</span>
                  {guest.displayName}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-5 text-center font-semibold text-slate-600">No guests have checked in yet.</p>
          )}
          <p className="mt-3 text-xs font-semibold text-slate-500">The list refreshes automatically. Last names are shortened for privacy.</p>
        </section>
      </section>
    </main>
  );
}
