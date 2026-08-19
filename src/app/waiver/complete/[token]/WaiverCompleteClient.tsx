"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  fetchWaiverCompletion,
  type CompletionFailure,
  type CompletionSuccess,
} from "@/lib/waivers/public-client";

const PENDING_SELF_CHECK_IN_KEY = "jumpingjax:pending-self-check-in";

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

export function WaiverCompleteClient() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const token = typeof params.token === "string" ? params.token : "";
  const partyBookingId = searchParams.get("booking") ?? "";
  const partyDate = searchParams.get("date");
  const isFacilityParty =
    searchParams.get("source") === "facility-party" && Boolean(partyBookingId);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [selfCheckInState, setSelfCheckInState] = useState<"idle" | "ready">("idle");
  const requestIdRef = useRef(0);
  const selfCheckInAttemptedRef = useRef(false);

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
  }, [isFacilityParty, partyBookingId, partyDate, token]);

  useEffect(() => {
    if (state.status !== "ok" || selfCheckInAttemptedRef.current) return;
    const saved = window.sessionStorage.getItem(PENDING_SELF_CHECK_IN_KEY);
    if (!saved) return;
    selfCheckInAttemptedRef.current = true;
    void Promise.resolve().then(() => setSelfCheckInState("ready"));
  }, [state]);

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
            {selfCheckInState !== "idle" ? (
              <div
                className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-4 text-sm font-bold text-cyan-900"
                role="status"
              >
                Your waiver is saved. Return to check-in and choose the correct name and age.
              </div>
            ) : null}
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
          {selfCheckInState === "ready" ? (
            <Link
              href="/check-in"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-emerald-600 px-7 text-base font-black text-white"
            >
              Finish check-in
            </Link>
          ) : null}
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
