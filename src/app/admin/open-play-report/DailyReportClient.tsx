"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { DailyReportActivity } from "@/components/open-play/DailyReportActivity";
import { DailyReportSummary } from "@/components/open-play/DailyReportSummary";
import {
  fetchDailyReport,
  normalizeReportDateInput,
  toReportSummaryView,
  type DailyReport,
  type StaffFacingError,
} from "@/lib/open-play/daily-report-client";

type Props = {
  initialDateYmd: string;
};

type LoadState =
  | { status: "loading"; dateYmd: string }
  | { status: "ready"; dateYmd: string; report: DailyReport }
  | { status: "error"; dateYmd: string; message: string; forbidden?: boolean };

export function DailyReportClient({ initialDateYmd }: Props) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(initialDateYmd);
  const [loadState, setLoadState] = useState<LoadState>({
    status: "loading",
    dateYmd: initialDateYmd,
  });
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const dateYmd = normalizeReportDateInput(selectedDate);
    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    let cancelled = false;

    void (async () => {
      // Defer setState so the effect body does not update state synchronously.
      await Promise.resolve();
      if (cancelled || requestId !== requestIdRef.current) return;

      if (!dateYmd) {
        setLoadState({
          status: "error",
          dateYmd: selectedDate,
          message: "Choose a valid business date (YYYY-MM-DD).",
        });
        return;
      }

      setLoadState({ status: "loading", dateYmd });

      try {
        const report = await fetchDailyReport(dateYmd, controller.signal);
        if (cancelled || requestId !== requestIdRef.current) return;
        setLoadState({ status: "ready", dateYmd, report });
        window.requestAnimationFrame(() => statusRef.current?.focus());
      } catch (error) {
        if (controller.signal.aborted || cancelled) return;
        if (requestId !== requestIdRef.current) return;
        const mapped = error as StaffFacingError;
        if (mapped?.requiresSignIn) {
          router.refresh();
          return;
        }
        setLoadState({
          status: "error",
          dateYmd,
          message: mapped?.message || "The daily report could not be loaded. Try again.",
          forbidden: Boolean(mapped?.forbidden),
        });
        window.requestAnimationFrame(() => statusRef.current?.focus());
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedDate, router]);

  function retry() {
    const dateYmd = normalizeReportDateInput(selectedDate);
    if (!dateYmd) {
      setLoadState({
        status: "error",
        dateYmd: selectedDate,
        message: "Choose a valid business date (YYYY-MM-DD).",
      });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;
    setLoadState({ status: "loading", dateYmd });

    void (async () => {
      try {
        const report = await fetchDailyReport(dateYmd, controller.signal);
        if (requestId !== requestIdRef.current) return;
        setLoadState({ status: "ready", dateYmd, report });
        window.requestAnimationFrame(() => statusRef.current?.focus());
      } catch (error) {
        if (controller.signal.aborted) return;
        if (requestId !== requestIdRef.current) return;
        const mapped = error as StaffFacingError;
        if (mapped?.requiresSignIn) {
          router.refresh();
          return;
        }
        setLoadState({
          status: "error",
          dateYmd,
          message: mapped?.message || "The daily report could not be loaded. Try again.",
          forbidden: Boolean(mapped?.forbidden),
        });
        window.requestAnimationFrame(() => statusRef.current?.focus());
      }
    })();
  }

  const summary =
    loadState.status === "ready" ? toReportSummaryView(loadState.report) : null;

  return (
    <div id="daily-report" className="mx-auto mt-4 max-w-xl scroll-mt-4 space-y-4 pb-10">
      <form
        className="sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-slate-100/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:bg-white sm:shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const next = String(form.get("report-date") ?? "");
          const normalized = normalizeReportDateInput(next);
          if (normalized) setSelectedDate(normalized);
        }}
      >
        <label htmlFor="report-date" className="block text-sm font-bold text-slate-700">
          Report date
          <input
            id="report-date"
            name="report-date"
            type="date"
            required
            value={selectedDate}
            onChange={(event) => {
              const normalized = normalizeReportDateInput(event.target.value);
              if (normalized) setSelectedDate(normalized);
            }}
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-sky-500"
          />
        </label>
        <p className="mt-2 text-xs font-semibold text-slate-500">
          Choose a date to load its visits and totals.
        </p>
        <button
          type="submit"
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-black text-white"
        >
          Load report
        </button>
      </form>

      {loadState.status === "loading" ? (
        <div
          ref={statusRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600 outline-none"
        >
          Loading report for {loadState.dateYmd}…
        </div>
      ) : null}

      {loadState.status === "error" ? (
        <div
          ref={statusRef}
          tabIndex={-1}
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 outline-none"
        >
          <p className="text-sm font-semibold text-rose-800">{loadState.message}</p>
          {!loadState.forbidden ? (
            <button
              type="button"
              onClick={retry}
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-rose-300 bg-white px-5 text-sm font-black text-rose-900"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {loadState.status === "ready" && summary ? (
        <>
          <div
            ref={statusRef}
            tabIndex={-1}
            role="status"
            aria-live="polite"
            className="sr-only outline-none"
          >
            Report loaded for {summary.businessDayYmd}
          </div>

          {summary.empty ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600">
              No Open Play activity for {summary.businessDayYmd}. This is an empty
              day, not an error.
            </div>
          ) : null}

          {summary.zeroDollarActiveDay ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              This day has attendance with $0.00 combined net retained (for example
              watching-only groups or fully offset adjustments).
            </div>
          ) : null}

          <DailyReportSummary summary={summary} />
          <DailyReportActivity report={loadState.report} />
        </>
      ) : null}
    </div>
  );
}
