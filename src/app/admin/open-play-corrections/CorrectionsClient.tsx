"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { CorrectionActionPanel } from "@/components/open-play/CorrectionActionPanel";
import { CorrectionsLedger } from "@/components/open-play/CorrectionsLedger";
import {
  beginCorrectionMutation,
  beginReportRequest,
  canBrowseVisitsAndDates,
  canStartPostMutationReload,
  canSubmitCorrection,
  createCorrectionsGateState,
  entryTypeLabel,
  fetchVisitsForBusinessDay,
  formatSignedCents,
  isVisitUuid,
  normalizeYmd,
  postVisitCorrection,
  resolveReportRequest,
  selectVisitFromCachedReport,
  settleCorrectionMutation,
  shouldShowMutationForVisit,
  type CorrectionPayload,
  type CorrectionsGateState,
  type OwnerFacingError,
  type PaymentEntry,
  type ReportLoadKind,
  type ReportRequestHandle,
  type VisitReportRow,
} from "@/lib/open-play/corrections-client";

type Props = {
  initialDateYmd: string;
};

type LoadState =
  | { status: "idle" }
  | { status: "loading"; dateYmd: string; loadKind: ReportLoadKind }
  | { status: "ready"; dateYmd: string; visits: VisitReportRow[] }
  | { status: "error"; dateYmd: string; message: string; forbidden?: boolean };

type MutationState =
  | { status: "idle" }
  | { status: "submitting"; label: string; visitId: string }
  | { status: "success"; label: string; entries: PaymentEntry[]; visitId: string }
  | {
      status: "error";
      message: string;
      visitId: string;
      forbidden?: boolean;
      ambiguous?: boolean;
      financialReversalRequired?: boolean;
    };

export function CorrectionsClient({ initialDateYmd }: Props) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(initialDateYmd);
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });
  const [manualVisitId, setManualVisitId] = useState("");
  const [visit, setVisit] = useState<VisitReportRow | null>(null);
  const [mutation, setMutation] = useState<MutationState>({ status: "idle" });
  const [gate, setGate] = useState<CorrectionsGateState>(() =>
    createCorrectionsGateState(),
  );
  const gateRef = useRef(gate);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const lastReadyRef = useRef<{ dateYmd: string; visits: VisitReportRow[] } | null>(
    null,
  );
  const statusRef = useRef<HTMLDivElement | null>(null);

  function commitGate(next: CorrectionsGateState) {
    gateRef.current = next;
    setGate(next);
  }

  function restoreLastReadyOrIdle() {
    if (lastReadyRef.current) {
      setLoadState({
        status: "ready",
        dateYmd: lastReadyRef.current.dateYmd,
        visits: lastReadyRef.current.visits,
      });
      return;
    }
    setLoadState({ status: "idle" });
  }

  function cancelInFlightReportLoad() {
    abortRef.current?.abort();
    abortRef.current = null;
    requestIdRef.current += 1;
  }

  async function loadDay(
    dateInput: string,
    options?: { loadKind?: ReportLoadKind },
  ) {
    const loadKind: ReportLoadKind = options?.loadKind ?? "browse";
    const started = beginReportRequest(gateRef.current, {
      kind: loadKind,
      nextRequestId: requestIdRef.current + 1,
    });
    if (!started) return;

    const dateYmd = normalizeYmd(dateInput);
    if (!dateYmd) {
      setLoadState({
        status: "error",
        dateYmd: dateInput,
        message: "Choose a valid business date (YYYY-MM-DD).",
      });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const request: ReportRequestHandle = started.request;
    requestIdRef.current = request.requestId;
    setLoadState({ status: "loading", dateYmd, loadKind });
    if (loadKind === "browse") {
      setMutation({ status: "idle" });
    }

    try {
      const report = await fetchVisitsForBusinessDay(dateYmd, controller.signal);
      const decision = resolveReportRequest(
        gateRef.current,
        request,
        requestIdRef.current,
      );
      if (decision.action === "ignore") return;
      if (decision.action === "discard_stale_browse") {
        commitGate(decision.state);
        restoreLastReadyOrIdle();
        return;
      }

      commitGate(decision.state);
      lastReadyRef.current = { dateYmd, visits: report.visits };
      setLoadState({ status: "ready", dateYmd, visits: report.visits });
      const selectedId = decision.state.selectedVisitId;
      if (selectedId) {
        setVisit(report.visits.find((item) => item.visitId === selectedId) ?? null);
      }
      if (decision.clearMutationPanel) {
        setMutation({ status: "idle" });
      }
      window.requestAnimationFrame(() => statusRef.current?.focus());
    } catch (error) {
      if (controller.signal.aborted) return;
      if (request.requestId !== requestIdRef.current) return;
      const mapped = error as OwnerFacingError;
      if (mapped?.requiresSignIn) {
        router.refresh();
        return;
      }
      setLoadState({
        status: "error",
        dateYmd,
        message: mapped?.message || "Visits could not be loaded.",
        forbidden: Boolean(mapped?.forbidden),
      });
      window.requestAnimationFrame(() => statusRef.current?.focus());
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await loadDay(initialDateYmd, { loadKind: "browse" });
    })();
    return () => {
      cancelled = true;
    };
    // Initial load only; later loads are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDateYmd]);

  function pickVisitFromReady(visitId: string) {
    const next = selectVisitFromCachedReport(gateRef.current, visitId);
    if (next === gateRef.current) return;
    commitGate(next);
    setManualVisitId(visitId);
    setMutation({ status: "idle" });
    if (loadState.status !== "ready") {
      setVisit(null);
      return;
    }
    setVisit(loadState.visits.find((item) => item.visitId === visitId) ?? null);
  }

  async function reloadSelectedVisit() {
    if (!canStartPostMutationReload(gateRef.current)) return;
    const dateYmd =
      loadState.status === "ready" ||
      loadState.status === "loading" ||
      loadState.status === "error"
        ? loadState.dateYmd
        : selectedDate;
    await loadDay(dateYmd, { loadKind: "post_mutation_reload" });
  }

  async function handleSubmit(payload: CorrectionPayload, label: string) {
    if (!canSubmitCorrection(gateRef.current)) return;
    if (!visit || !isVisitUuid(visit.visitId)) {
      setMutation({
        status: "error",
        message: "Select a visit before submitting a correction.",
        visitId: gateRef.current.selectedVisitId || "",
      });
      return;
    }

    const postedVisitId = visit.visitId;
    // Cancel in-flight browse/day GETs so a stale resolve cannot clear a newer gate.
    cancelInFlightReportLoad();
    restoreLastReadyOrIdle();

    const begun = beginCorrectionMutation(gateRef.current, postedVisitId);
    if (begun === gateRef.current) return;
    commitGate(begun);
    setMutation({ status: "submitting", label, visitId: postedVisitId });
    const controller = new AbortController();

    try {
      const result = await postVisitCorrection(
        postedVisitId,
        payload,
        visit.source,
        controller.signal,
      );
      commitGate(settleCorrectionMutation(gateRef.current, "success"));
      setMutation({
        status: "success",
        label,
        entries: result.entries,
        visitId: postedVisitId,
      });
      window.requestAnimationFrame(() => statusRef.current?.focus());
    } catch (error) {
      const mapped = error as OwnerFacingError;
      if (mapped?.requiresSignIn) {
        commitGate(settleCorrectionMutation(gateRef.current, "error"));
        router.refresh();
        return;
      }
      const ambiguous = Boolean(mapped?.ambiguous);
      commitGate(
        settleCorrectionMutation(gateRef.current, ambiguous ? "ambiguous" : "error"),
      );
      setMutation({
        status: "error",
        message: mapped?.message || "The correction could not be applied.",
        visitId: postedVisitId,
        forbidden: Boolean(mapped?.forbidden),
        ambiguous,
        financialReversalRequired: Boolean(mapped?.financialReversalRequired),
      });
      window.requestAnimationFrame(() => statusRef.current?.focus());
    }
  }

  const browseLocked = !canBrowseVisitsAndDates(gate);
  const reloadEnabled = canStartPostMutationReload(gate);
  const showMutation = shouldShowMutationForVisit({
    mutationVisitId: gate.mutationVisitId,
    selectedVisitId: visit?.visitId ?? gate.selectedVisitId,
  });

  return (
    <div className="mx-auto mt-4 max-w-xl space-y-4 pb-10">
      <form
        className="sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-slate-100/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:bg-white sm:shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          if (browseLocked) return;
          const normalized = normalizeYmd(selectedDate);
          if (normalized) void loadDay(normalized, { loadKind: "browse" });
        }}
      >
        <fieldset disabled={browseLocked}>
          <label htmlFor="corrections-date" className="block text-sm font-bold text-slate-700">
            Report date
            <input
              id="corrections-date"
              type="date"
              required
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-sky-500 disabled:opacity-50"
            />
          </label>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Loads visits and ledgers for the selected date.
          </p>
          <button
            type="submit"
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-50"
          >
            Load visits
          </button>
        </fieldset>
      </form>

      {loadState.status === "loading" ? (
        <div
          ref={statusRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600 outline-none"
        >
          {loadState.loadKind === "post_mutation_reload"
            ? `Reloading ledger for ${loadState.dateYmd}…`
            : `Loading visits for ${loadState.dateYmd}…`}
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
              disabled={browseLocked && !reloadEnabled}
              onClick={() => {
                if (reloadEnabled) {
                  void loadDay(loadState.dateYmd, { loadKind: "post_mutation_reload" });
                  return;
                }
                if (!browseLocked) {
                  void loadDay(loadState.dateYmd, { loadKind: "browse" });
                }
              }}
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-rose-300 bg-white px-5 text-sm font-black text-rose-900 disabled:opacity-50"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {loadState.status === "ready" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Visits</h2>
          {browseLocked ? (
            <p className="mt-2 text-xs font-semibold text-amber-800">
              Visit selection and day loading are locked until you reload after the correction
              outcome.
            </p>
          ) : null}
          {loadState.visits.length === 0 ? (
            <p className="mt-2 text-sm font-semibold text-slate-500">
              No Open Play visits for {loadState.dateYmd}.
            </p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {loadState.visits.map((item) => (
                <li key={item.visitId}>
                  <button
                    type="button"
                    disabled={browseLocked}
                    onClick={() => pickVisitFromReady(item.visitId)}
                    className={`flex min-h-12 w-full flex-col items-start rounded-xl border px-4 py-3 text-left disabled:opacity-50 ${
                      gate.selectedVisitId === item.visitId
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-900"
                    }`}
                  >
                    <span className="text-sm font-black">
                      {item.status} · {item.attendees.length} attendee
                      {item.attendees.length === 1 ? "" : "s"}
                    </span>
                    <span className="mt-1 break-all text-xs font-semibold opacity-80">
                      {item.visitId}
                    </span>
                    <span className="mt-1 text-xs font-black uppercase tracking-wide opacity-80">
                      {item.source === "legacy_smartwaiver"
                        ? "Legacy Smartwaiver"
                        : "Native waiver"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <label className="mt-4 block text-sm font-bold text-slate-700">
            Or paste visit UUID
            <input
              value={manualVisitId}
              disabled={browseLocked}
              onChange={(event) => setManualVisitId(event.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base disabled:opacity-50"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </label>
          <button
            type="button"
            disabled={browseLocked}
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-black text-slate-900 disabled:opacity-50"
            onClick={() => {
              if (browseLocked) return;
              const id = manualVisitId.trim();
              if (!isVisitUuid(id)) {
                setMutation({
                  status: "error",
                  message: "Visit id must be a UUID.",
                  visitId: gate.selectedVisitId || "",
                });
                return;
              }
              pickVisitFromReady(id);
              if (
                loadState.status === "ready" &&
                !loadState.visits.some((item) => item.visitId === id)
              ) {
                setVisit(null);
                setMutation({
                  status: "error",
                  message:
                    "That visit UUID is not in the selected date. Load the correct date or confirm the id.",
                  visitId: id,
                });
              }
            }}
          >
            Use visit UUID
          </button>
        </section>
      ) : null}

      {gate.needsReload ? (
        <div
          role="status"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950"
        >
          Reload the visit before another correction so the ledger stays trustworthy.
          <button
            type="button"
            disabled={!reloadEnabled}
            onClick={() => void reloadSelectedVisit()}
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-amber-300 bg-white px-5 text-sm font-black text-amber-950 disabled:opacity-50"
          >
            Reload visit ledger
          </button>
        </div>
      ) : null}

      {showMutation && mutation.status === "submitting" ? (
        <div
          ref={statusRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600 outline-none"
        >
          Submitting {mutation.label}…
        </div>
      ) : null}

      {showMutation && mutation.status === "error" ? (
        <div
          ref={statusRef}
          tabIndex={-1}
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 outline-none"
        >
          <p className="text-sm font-semibold text-rose-800">{mutation.message}</p>
          {mutation.financialReversalRequired ? (
            <p className="mt-2 text-sm font-semibold text-rose-800">
              Use refund or void first, then remove the attendee.
            </p>
          ) : null}
          {mutation.ambiguous ? (
            <p className="mt-2 text-sm font-semibold text-rose-800">
              Do not automatically resend. Reload and inspect the ledger first.
            </p>
          ) : null}
        </div>
      ) : null}

      {showMutation && mutation.status === "success" ? (
        <div
          ref={statusRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 outline-none"
        >
          <p className="text-sm font-black text-emerald-950">
            {mutation.label} applied. Server returned {mutation.entries.length} ledger entr
            {mutation.entries.length === 1 ? "y" : "ies"}.
          </p>
          <ul className="mt-3 grid gap-2">
            {mutation.entries.map((entry) => (
              <li
                key={entry.id || `${entry.entryType}-${entry.amountCents}-${entry.createdAt}`}
                className="rounded-xl border border-emerald-200 bg-white p-3 text-sm"
              >
                <p className="font-black text-slate-950">
                  {entryTypeLabel(entry.entryType)} · {formatSignedCents(entry.amountCents)} ·{" "}
                  {entry.method}
                </p>
                {entry.attendeeId === null ? (
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Attendee identity null on success row
                  </p>
                ) : entry.attendeeId ? (
                  <p className="mt-1 break-all text-xs font-semibold text-slate-500">
                    Attendee {entry.attendeeId}
                  </p>
                ) : null}
                {entry.relatedEntryId ? (
                  <p className="mt-1 break-all text-xs font-semibold text-slate-500">
                    Related {entry.relatedEntryId}
                  </p>
                ) : (
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Related entry identity null/omitted
                  </p>
                )}
              </li>
            ))}
          </ul>
          {mutation.entries.length === 0 ? (
            <p className="mt-2 text-sm font-semibold text-emerald-900">
              No payment rows were returned (for example a free attendee removal). Reload to confirm
              attendee status.
            </p>
          ) : null}
        </div>
      ) : null}

      {visit ? (
        <>
          <CorrectionsLedger visit={visit} />
          <CorrectionActionPanel
            key={visit.visitId}
            visit={visit}
            disabled={gate.submitting || gate.needsReload}
            disabledReason={
              gate.submitting ? "submitting" : gate.needsReload ? "needs_reload" : null
            }
            onSubmit={(payload, label) => void handleSubmit(payload, label)}
          />
        </>
      ) : null}
    </div>
  );
}
