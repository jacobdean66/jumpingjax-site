"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  fetchWaiverCompletion,
  type CompletionFailure,
  type CompletionSuccess,
} from "@/lib/waivers/public-client";
import type { BirthdayPartyOption } from "@/lib/open-play/check-in-client";

type LoadState =
  | { status: "loading" }
  | { status: "ok"; data: CompletionSuccess; partyMessage: string | null }
  | { status: "error"; data: CompletionFailure };

function formatExpiresOn(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function WaiverCompleteClient({
  birthdayParties,
  businessDayYmd,
}: {
  birthdayParties: BirthdayPartyOption[];
  businessDayYmd: string;
}) {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const token = typeof params.token === "string" ? params.token : "";
  const partyBookingId = searchParams.get("booking") ?? "";
  const partyDate = searchParams.get("date");
  const isFacilityParty =
    searchParams.get("source") === "facility-party" && Boolean(partyBookingId);
  const atFacility = isFacilityParty && searchParams.get("arrival") === "1";
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [joiningPartyId, setJoiningPartyId] = useState<string | null>(null);
  const [joinedPartyMessage, setJoinedPartyMessage] = useState<string | null>(null);
  const [isOpenPlayGuest, setIsOpenPlayGuest] = useState(false);
  const [joinPartyError, setJoinPartyError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    void (async () => {
      const result = await fetchWaiverCompletion(token, {
        signal: controller.signal,
      });
      if (controller.signal.aborted || requestIdRef.current !== requestId) return;
      if (result.ok) {
        let partyMessage: string | null = null;
        if (isFacilityParty) {
          try {
            const response = await fetch("/api/facility-party/check-in/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              cache: "no-store",
              signal: controller.signal,
              body: JSON.stringify({
                bookingId: partyBookingId,
                partyDate,
                publicToken: token,
                atFacility,
              }),
            });
            const payload = (await response.json().catch(() => null)) as
              | { ok?: boolean; message?: string }
              | null;
            if (response.ok && payload?.ok && payload.message) {
              partyMessage = payload.message;
            }
          } catch {
            partyMessage = null;
          }
        }
        setState({ status: "ok", data: result, partyMessage });
      } else {
        setState({ status: "error", data: result });
      }
    })();
    return () => controller.abort();
  }, [atFacility, isFacilityParty, partyBookingId, partyDate, token]);

  async function joinBirthdayParty(party: BirthdayPartyOption) {
    if (joiningPartyId) return;
    setJoiningPartyId(party.id);
    setJoinPartyError(null);
    try {
      const response = await fetch("/api/facility-party/check-in/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          bookingId: party.id,
          partyDate: businessDayYmd,
          publicToken: token,
          atFacility: true,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; error?: string }
        | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "We could not check you into that party.");
      }
      setJoinedPartyMessage(payload.message || `You are checked in for ${party.label}.`);
    } catch (error) {
      setJoinPartyError(error instanceof Error ? error.message : "We could not check you into that party.");
    } finally {
      setJoiningPartyId(null);
    }
  }

  return (
    <main className="min-h-screen bg-cyan-100 px-4 py-10 text-slate-950 sm:px-6 sm:py-14">
      <section className="mx-auto w-full max-w-lg rounded-[1.75rem] border-2 border-white bg-white/95 px-5 py-8 text-center shadow-[0_18px_48px_rgba(8,145,178,0.16)] sm:px-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-800">
          Jumping Jax waiver
        </p>

        {state.status === "loading" ? (
          <>
            <h1 className="mt-3 text-3xl font-black tracking-tight">
              Checking confirmation…
            </h1>
            <p
              role="status"
              aria-live="polite"
              className="mt-4 text-sm leading-6 text-slate-600"
            >
              Please wait while we look up this waiver confirmation.
            </p>
          </>
        ) : null}

        {state.status === "ok" ? (
          <>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Waiver received
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-700">
              Thanks — your waiver confirmation is on file. This page shows only
              a short confirmation summary.
            </p>
            {state.partyMessage ? (
              <p className="mt-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black leading-6 text-emerald-950">
                {state.partyMessage}
              </p>
            ) : null}
            {!isFacilityParty &&
            birthdayParties.length > 0 &&
            !joinedPartyMessage &&
            !isOpenPlayGuest ? (
              <section className="mt-6 rounded-3xl border-2 border-orange-200 bg-orange-50 p-4 text-left">
                <h2 className="text-lg font-black text-orange-950">
                  Are you here for a birthday party today?
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-orange-900">
                  Choose the party and we will check everyone on this waiver in automatically.
                </p>
                <div className="mt-3 grid gap-2">
                  {birthdayParties.map((party) => (
                    <button
                      key={party.id}
                      type="button"
                      disabled={Boolean(joiningPartyId)}
                      onClick={() => void joinBirthdayParty(party)}
                      className="min-h-12 rounded-2xl border-2 border-orange-300 bg-white px-4 text-left font-black text-orange-950 transition hover:border-orange-600 disabled:opacity-60"
                    >
                      {joiningPartyId === party.id ? "Checking you in…" : party.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={Boolean(joiningPartyId)}
                    onClick={() => setIsOpenPlayGuest(true)}
                    className="min-h-12 rounded-2xl border-2 border-cyan-300 bg-cyan-50 px-4 text-left font-black text-cyan-950 transition hover:border-cyan-600 hover:bg-cyan-100 disabled:opacity-60"
                  >
                    No — we’re here for Open Play
                  </button>
                </div>
                {joinPartyError ? (
                  <p role="alert" className="mt-3 text-sm font-bold text-red-800">{joinPartyError}</p>
                ) : null}
              </section>
            ) : null}
            {joinedPartyMessage ? (
              <p className="mt-6 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black leading-6 text-emerald-950">
                {joinedPartyMessage}
              </p>
            ) : null}
            {isOpenPlayGuest ? (
              <p className="mt-6 rounded-2xl border-2 border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-black leading-6 text-cyan-950">
                You’re all set for Open Play. Please see the front desk to purchase admission.
              </p>
            ) : null}
            <dl className="mx-auto mt-6 max-w-sm space-y-3 rounded-3xl border-2 border-cyan-100 bg-cyan-50 px-4 py-5 text-left text-sm">
              <div>
                <dt className="font-black uppercase tracking-wide text-cyan-900">
                  Status
                </dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {state.data.status || "completed"}
                  {state.data.expired ? " (past validity date)" : ""}
                </dd>
              </div>
              <div>
                <dt className="font-black uppercase tracking-wide text-cyan-900">
                  Participants covered
                </dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {state.data.participantCount}
                </dd>
              </div>
              <div>
                <dt className="font-black uppercase tracking-wide text-cyan-900">
                  Valid through
                </dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {state.data.expiresOn
                    ? `Day before ${formatExpiresOn(state.data.expiresOn)}`
                    : "Not available"}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              A final signed PDF is not provided on this page. Staff can help if
              you need a record at the facility.
            </p>
          </>
        ) : null}

        {state.status === "error" ? (
          <>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Confirmation unavailable
            </h1>
            <p role="alert" className="mt-4 text-base leading-7 text-slate-700">
              {state.data.message}
            </p>
          </>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/waiver"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-orange-600 px-7 text-base font-black text-white shadow-[0_5px_0_rgba(154,52,18,0.25)] transition hover:bg-orange-700"
          >
            Start another waiver
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-cyan-200 bg-cyan-50 px-7 text-base font-bold text-cyan-950 transition hover:bg-cyan-100"
          >
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
