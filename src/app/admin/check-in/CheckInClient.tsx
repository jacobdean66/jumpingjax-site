"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { CheckInGroupPanel } from "@/components/open-play/CheckInGroupPanel";
import {
  CheckInSearchForm,
  CheckInSearchResults,
} from "@/components/open-play/CheckInSearch";
import { CheckInSuccessPanel } from "@/components/open-play/CheckInSuccessPanel";
import {
  buildVisitCreateBody,
  buildLegacyCheckInBody,
  canSubmitCheckInGroup,
  computeGroupTotalsPreview,
  createOpenPlayVisitRequest,
  createLegacyCheckInRequest,
  formatCents,
  resultToDraft,
  searchWaivers,
  todayBusinessDayYmd,
  type AdultPlayMode,
  type CheckInStep,
  type PaymentMethodChoice,
  type SelectedAttendeeDraft,
  type StaffFacingError,
  type StaffSearchResult,
  type VisitCreateSuccess,
} from "@/lib/open-play/check-in-client";

const SEARCH_DEBOUNCE_MS = 400;

type Props = {
  visitDateYmd?: string;
};

export function CheckInClient({ visitDateYmd }: Props) {
  const router = useRouter();
  const resolvedVisitDate = visitDateYmd ?? todayBusinessDayYmd();

  const [step, setStep] = useState<CheckInStep>("search");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<StaffSearchResult[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [explicitSearchToken, setExplicitSearchToken] = useState(0);

  const [attendees, setAttendees] = useState<SelectedAttendeeDraft[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<VisitCreateSuccess | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchStatusRef = useRef<HTMLDivElement | null>(null);
  const submitErrorRef = useRef<HTMLDivElement | null>(null);
  const successHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const submitLockRef = useRef(false);
  const searchRequestIdRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);

  const selectedIds = useMemo(
    () => new Set(attendees.map((item) => item.selectionKey)),
    [attendees],
  );

  const totals = useMemo(
    () => computeGroupTotalsPreview(attendees, resolvedVisitDate),
    [attendees, resolvedVisitDate],
  );

  // Debounce typed search; do not hit the API on every keystroke.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  const searchActive = step === "search" && debouncedQuery.length >= 2;
  // Never leave results from an older, valid query visible after the search
  // text is shortened below the API's two-character minimum.
  const displayResults = searchActive ? results : null;
  const displaySearchLoading = searchActive && searchLoading;
  const displaySearchError = searchActive ? searchError : null;

  useEffect(() => {
    if (!searchActive) {
      searchAbortRef.current?.abort();
      return;
    }

    const q = debouncedQuery;
    const requestId = ++searchRequestIdRef.current;
    const controller = new AbortController();
    searchAbortRef.current?.abort();
    searchAbortRef.current = controller;

    let cancelled = false;

    void (async () => {
      // Defer loading flag so the effect body itself does not setState sync.
      await Promise.resolve();
      if (cancelled || requestId !== searchRequestIdRef.current) return;
      setSearchLoading(true);
      setSearchError(null);

      try {
        const { results: next } = await searchWaivers(q, controller.signal);
        if (cancelled || requestId !== searchRequestIdRef.current) return;
        setResults(next);
        setSearchLoading(false);
        window.requestAnimationFrame(() => {
          searchStatusRef.current?.focus();
        });
      } catch (error) {
        if (controller.signal.aborted || cancelled) return;
        if (requestId !== searchRequestIdRef.current) return;
        setSearchLoading(false);
        const mapped = error as StaffFacingError;
        if (mapped?.requiresSignIn) {
          router.refresh();
          return;
        }
        setSearchError(mapped?.message || "Search failed. Try again.");
        setResults([]);
        window.requestAnimationFrame(() => {
          searchStatusRef.current?.focus();
        });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [searchActive, debouncedQuery, explicitSearchToken, router]);

  useEffect(() => {
    if (step === "success") {
      window.requestAnimationFrame(() => {
        successHeadingRef.current?.focus();
      });
    }
  }, [step]);

  useEffect(() => {
    if (submitError) {
      window.requestAnimationFrame(() => {
        submitErrorRef.current?.focus();
      });
    }
  }, [submitError]);

  function handleExplicitSearch() {
    const trimmed = query.trim();
    setDebouncedQuery(trimmed);
    setExplicitSearchToken((value) => value + 1);
  }

  function addAttendee(result: StaffSearchResult) {
    if (result.expired) return;
    if (result.source === "legacy_smartwaiver" && result.checkInEligible === false) {
      return;
    }
    const key = result.selectionKey || result.participantId;
    setAttendees((current) => {
      if (current.some((item) => item.selectionKey === key)) {
        return current;
      }
      if (current.length > 0 && current[0]?.source !== result.source) {
        setSubmitError(
          "Finish this group first, then check in guests from the other waiver system.",
        );
        return current;
      }
      return [...current, resultToDraft(result)];
    });
    if (attendees.length === 0 || attendees[0]?.source === result.source) {
      setSubmitError(null);
    }
  }

  function removeAttendee(selectionKey: string) {
    setAttendees((current) =>
      current.filter((item) => item.selectionKey !== selectionKey),
    );
  }

  function setAdultMode(selectionKey: string, mode: AdultPlayMode) {
    setAttendees((current) =>
      current.map((item) => {
        if (item.selectionKey !== selectionKey) return item;
        return {
          ...item,
          adultMode: mode,
          paymentMethod: mode === "watching" ? null : item.paymentMethod,
        };
      }),
    );
  }

  function setPaymentMethod(
    selectionKey: string,
    method: PaymentMethodChoice | null,
  ) {
    setAttendees((current) =>
      current.map((item) =>
        item.selectionKey === selectionKey
          ? { ...item, paymentMethod: method }
          : item,
      ),
    );
  }

  async function submitVisit() {
    if (submitLockRef.current || submitting) return;

    const gate = canSubmitCheckInGroup(attendees, resolvedVisitDate);
    if (!gate.ok) {
      setSubmitError(gate.message);
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const nativeBody = buildVisitCreateBody({
        visitDateYmd: resolvedVisitDate,
        attendees,
      });
      const legacyBody = buildLegacyCheckInBody({
        visitDateYmd: resolvedVisitDate,
        attendees,
      });

      let created: VisitCreateSuccess | null = null;
      if (nativeBody.attendees.length > 0) {
        created = await createOpenPlayVisitRequest(nativeBody);
      }
      if (legacyBody.attendees.length > 0) {
        const legacyCreated = await createLegacyCheckInRequest(legacyBody);
        created = created
          ? {
              ...created,
              attendees: [...created.attendees, ...legacyCreated.attendees],
              paymentEntries: [
                ...created.paymentEntries,
                ...legacyCreated.paymentEntries,
              ],
            }
          : legacyCreated;
      }
      if (!created) {
        throw {
          code: "validation",
          message: "No attendees to check in.",
          correctable: true,
          requiresSignIn: false,
        } satisfies StaffFacingError;
      }
      setSuccess(created);
      setAttendees([]);
      setResults(null);
      setQuery("");
      setDebouncedQuery("");
      setStep("success");
    } catch (error) {
      const mapped = error as StaffFacingError;
      if (mapped?.requiresSignIn) {
        router.refresh();
        return;
      }
      setSubmitError(
        mapped?.message || "Check-in failed. Fix the group and try again.",
      );
    } finally {
      setSubmitting(false);
      // Keep lock until this attempt fully ends; unlock so staff can retry
      // after a correctable error. Success path clears group so resubmit is impossible.
      submitLockRef.current = false;
    }
  }

  function startNewCheckIn() {
    submitLockRef.current = false;
    setSubmitting(false);
    setSuccess(null);
    setSubmitError(null);
    setAttendees([]);
    setResults(null);
    setQuery("");
    setDebouncedQuery("");
    setSearchError(null);
    setStep("search");
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }

  if (step === "success" && success) {
    return (
      <div className="mx-auto mt-6 max-w-xl">
        <CheckInSuccessPanel
          success={success}
          onNewCheckIn={startNewCheckIn}
          headingRef={successHeadingRef}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto mt-4 max-w-xl space-y-4 pb-28">
      <p className="text-sm font-semibold text-slate-600">
        Visit date <span className="font-black text-slate-950">{resolvedVisitDate}</span>
      </p>

      <CheckInSearchForm
        query={query}
        onQueryChange={setQuery}
        onSubmit={handleExplicitSearch}
        loading={displaySearchLoading}
        disabled={submitting}
        inputRef={searchInputRef}
      />

      <CheckInGroupPanel
        attendees={attendees}
        visitDateYmd={resolvedVisitDate}
        onRemove={removeAttendee}
        onAdultModeChange={setAdultMode}
        onPaymentMethodChange={setPaymentMethod}
      />

      {attendees.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-3 font-semibold text-slate-700">
              <dt>Expected cash</dt>
              <dd>{formatCents(totals.cashTotalCents)}</dd>
            </div>
            <div className="flex justify-between gap-3 font-semibold text-slate-700">
              <dt>Expected card</dt>
              <dd>{formatCents(totals.cardTotalCents)}</dd>
            </div>
            <div className="flex justify-between gap-3 text-base font-black text-slate-950">
              <dt>Expected combined</dt>
              <dd>{formatCents(totals.combinedTotalCents)}</dd>
            </div>
          </dl>
          {totals.hasUncertainPrices ? (
            <p className="mt-2 text-xs font-semibold text-amber-800">
              Some child prices are estimates until the server confirms them.
            </p>
          ) : null}
          {submitError ? (
            <div
              ref={submitErrorRef}
              tabIndex={-1}
              className="mt-3 text-sm font-semibold text-rose-700 outline-none"
              role="alert"
            >
              {submitError}
            </div>
          ) : null}
        </div>
      ) : null}

      <section aria-labelledby="check-in-results-heading" className="space-y-3">
        <h2 id="check-in-results-heading" className="text-lg font-black text-slate-950">
          Search results
        </h2>
        <CheckInSearchResults
          results={displayResults}
          loading={displaySearchLoading}
          error={displaySearchError}
          selectedIds={selectedIds}
          onSelect={addAttendee}
          statusRef={searchStatusRef}
        />
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-xl gap-3">
          <button
            type="button"
            disabled={attendees.length === 0 || submitting}
            onClick={() => {
              void submitVisit();
            }}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Checking in…"
              : attendees.length > 0
                ? `Confirm check-in (${attendees.length})`
                : "Confirm check-in"}
          </button>
        </div>
      </div>
    </div>
  );
}
