"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "found";
      message: string;
      guestName: string | null;
    }
  | {
      status: "missing";
      message: string;
      signWaiverUrl: string;
    }
  | { status: "error"; message: string };

const fieldClass =
  "mt-1.5 w-full min-h-12 rounded-xl border-2 border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-200";

export function PartyCheckInClient({
  bookingId,
  partyDate,
}: {
  bookingId: string;
  partyDate: string | null;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [state, setState] = useState<LookupState>({ status: "idle" });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (state.status === "loading") return;

    setState({ status: "loading" });
    let response: Response;
    try {
      response = await fetch("/api/facility-party/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          bookingId,
          partyDate,
          firstName,
          lastName,
          dob,
        }),
      });
    } catch {
      setState({
        status: "error",
        message: "We could not check that waiver right now. Please try again.",
      });
      return;
    }

    const payload = (await response.json().catch(() => null)) as
      | {
          ok?: boolean;
          found?: boolean;
          message?: string;
          guestName?: string | null;
          signWaiverUrl?: string | null;
          error?: string;
        }
      | null;

    if (!response.ok || !payload?.ok) {
      setState({
        status: "error",
        message: payload?.error || "We could not check that waiver right now.",
      });
      return;
    }

    if (payload.found) {
      setState({
        status: "found",
        message: payload.message || "You are checked in for the party.",
        guestName: payload.guestName ?? null,
      });
      return;
    }

    setState({
      status: "missing",
      message: payload.message || "We did not find your waiver yet.",
      signWaiverUrl: payload.signWaiverUrl || "/waiver",
    });
  }

  return (
    <main className="min-h-screen bg-cyan-100 px-4 py-8 text-slate-950 sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-xl rounded-[1.75rem] border-2 border-white bg-white/95 px-4 py-6 shadow-[0_18px_48px_rgba(8,145,178,0.16)] sm:px-7 sm:py-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-800">
          Jumping Jax party check-in
        </p>
        <h1 className="mt-2 text-balance text-3xl font-black tracking-tight sm:text-4xl">
          Get ready for the party
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
          Search for your Jumping Jax waiver. If we find it, we will add you to
          this party guest list before you arrive.
        </p>
        {partyDate ? (
          <p className="mt-4 rounded-2xl border-2 border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-950">
            You are checking in for the party on {partyDate}.
          </p>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold text-slate-800">
              Guest first name
              <input
                className={fieldClass}
                autoComplete="given-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </label>
            <label className="block text-sm font-bold text-slate-800">
              Guest last name
              <input
                className={fieldClass}
                autoComplete="family-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
            </label>
          </div>
          <label className="block text-sm font-bold text-slate-800">
            Guest date of birth
            <input
              type="date"
              className={fieldClass}
              value={dob}
              onChange={(event) => setDob(event.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={state.status === "loading"}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-orange-600 px-6 text-base font-black text-white shadow-[0_5px_0_rgba(154,52,18,0.25)] transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state.status === "loading" ? "Checking..." : "Check waiver"}
          </button>
        </form>

        {state.status === "found" ? (
          <div className="mt-6 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-950">
            <p className="text-lg font-black">You are ready</p>
            <p className="mt-2 text-sm font-semibold leading-6">{state.message}</p>
            {state.guestName ? (
              <p className="mt-2 text-xs font-bold text-emerald-800">
                Guest: {state.guestName}
              </p>
            ) : null}
          </div>
        ) : null}

        {state.status === "missing" ? (
          <div className="mt-6 rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-4 text-amber-950">
            <p className="text-lg font-black">Waiver needed</p>
            <p className="mt-2 text-sm font-semibold leading-6">{state.message}</p>
            <Link
              href={state.signWaiverUrl}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-orange-600 px-6 text-base font-black text-white shadow-[0_5px_0_rgba(154,52,18,0.25)] transition hover:bg-orange-700"
            >
              Sign waiver
            </Link>
          </div>
        ) : null}

        {state.status === "error" ? (
          <p
            role="alert"
            className="mt-6 rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-900"
          >
            {state.message}
          </p>
        ) : null}
      </section>
    </main>
  );
}
