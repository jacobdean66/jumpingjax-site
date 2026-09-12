"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { CheckInConflictPanel } from "@/components/open-play/CheckInConflictPanel";
import { CheckInGroupPanel } from "@/components/open-play/CheckInGroupPanel";
import {
  EditWaiverNameDialog,
  type EditableWaiverName,
} from "@/components/open-play/EditWaiverNameDialog";
import {
  CheckInSearchForm,
  CheckInSearchResults,
} from "@/components/open-play/CheckInSearch";
import { CheckInSuccessPanel } from "@/components/open-play/CheckInSuccessPanel";
import {
  buildVisitCreateBody,
  buildLegacyCheckInBody,
  canSubmitCheckInGroup,
  conflictsByParticipantId,
  computeGroupTotalsPreview,
  createOpenPlayVisitRequest,
  createLegacyCheckInRequest,
  fetchOpenPlayVisitConflicts,
  formatCents,
  isAdultRole,
  resultToDraft,
  replaceAttendeeDisplayName,
  searchWaivers,
  todayBusinessDayYmd,
  type BirthdayPartyOption,
  type AdultPlayMode,
  type CheckInConflict,
  type CheckInStep,
  type NameCorrectionSuccess,
  type PaymentMethodChoice,
  type SelectedAttendeeDraft,
  type StaffFacingError,
  type StaffSearchResult,
  type VisitCreateSuccess,
} from "@/lib/open-play/check-in-client";
import { classifyChildAdmission } from "@/lib/open-play/pricing";
import type { StaffWaiverParticipant } from "@/lib/waivers/search";

type Props = {
  visitDateYmd?: string;
  birthdayParties?: BirthdayPartyOption[];
};

export function CheckInClient({ visitDateYmd, birthdayParties = [] }: Props) {
  const router = useRouter();
  const resolvedVisitDate = visitDateYmd ?? todayBusinessDayYmd();

  const [step, setStep] = useState<CheckInStep>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StaffSearchResult[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [attendees, setAttendees] = useState<SelectedAttendeeDraft[]>([]);
  const [conflicts, setConflicts] = useState<CheckInConflict[]>([]);
  const [editNameTarget, setEditNameTarget] = useState<EditableWaiverName | null>(null);
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

  const conflictIds = useMemo(() => conflictsByParticipantId(conflicts), [conflicts]);
  const confirmableAttendees = useMemo(
    () => attendees.filter((attendee) => !conflictIds.has(attendee.participantId)),
    [attendees, conflictIds],
  );
  const confirmableTotals = useMemo(
    () => computeGroupTotalsPreview(confirmableAttendees, resolvedVisitDate),
    [confirmableAttendees, resolvedVisitDate],
  );

  const searchActive = step === "search" && query.trim().length >= 1;
  const displayResults = searchActive ? results : null;
  const displaySearchLoading = searchActive && searchLoading;
  const displaySearchError = searchActive ? searchError : null;

  useEffect(() => {
    if (!searchActive) {
      searchAbortRef.current?.abort();
      return;
    }

    const q = query.trim();
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
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [searchActive, query, router]);

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

  function handleQueryChange(value: string) {
    setQuery(value);
    setSearchError(null);
    if (value.trim()) {
      setSearchLoading(true);
      setResults(null);
    } else {
      searchAbortRef.current?.abort();
      setSearchLoading(false);
      setResults(null);
    }
  }

  function toggleLocation(result: StaffWaiverParticipant) {
    if (result.expired) return;
    if (result.source === "legacy_smartwaiver" && result.checkInEligible === false) {
      return;
    }
    setAttendees((current) => {
      const draft = resultToDraft(result);
      const existing = current.find((item) => item.identityKey === draft.identityKey);
      if (existing) {
        return current.filter((item) => item.identityKey !== draft.identityKey);
      }
      if (current.length > 0 && current[0]?.source !== result.source) {
        setSubmitError(
          "Finish this group first, then check in guests from the other waiver system.",
        );
        return current;
      }
      const defaultPrice = isAdultRole(result.role)
        ? null
        : classifyChildAdmission(result.dobYmd, resolvedVisitDate).unitPriceCents;
      return [...current, { ...draft, priceOverrideCents: defaultPrice }];
    });
    if (attendees.length === 0 || attendees[0]?.source === result.source) {
      setSubmitError(null);
    }
    if (result.participantId) {
      setConflicts((current) =>
        current.filter((conflict) => conflict.participantId !== result.participantId),
      );
    }
  }

  function removeAttendee(selectionKey: string) {
    let removedParticipantId = "";
    setAttendees((current) => {
      const removed = current.find((item) => item.selectionKey === selectionKey);
      removedParticipantId = removed?.participantId ?? "";
      return current.filter((item) => item.selectionKey !== selectionKey);
    });
    if (removedParticipantId) {
      setConflicts((current) =>
        current.filter((item) => item.participantId !== removedParticipantId),
      );
    }
  }

  function setAdultMode(selectionKey: string, mode: AdultPlayMode) {
    setAttendees((current) =>
      current.map((item) =>
        item.selectionKey === selectionKey
          ? {
              ...item,
              adultMode: mode,
              priceOverrideCents: mode === "playing" ? 700 : null,
              paymentMethod: null,
              paymentConfirmed: false,
              birthdayPartyId: null,
              birthdayPartyLabel: null,
            }
          : item,
      ),
    );
  }

  function setPaymentMethod(
    selectionKey: string,
    method: PaymentMethodChoice | null,
  ) {
    setAttendees((current) =>
      current.map((item) =>
        item.selectionKey === selectionKey
          ? {
              ...item,
              paymentMethod: method,
              paymentConfirmed: false,
              birthdayPartyId: null,
              birthdayPartyLabel: null,
              priceOverrideCents:
                method === "free_pass" || method === "birthday_party"
                  ? 0
                  : item.paymentMethod === "free_pass" ||
                      item.paymentMethod === "birthday_party"
                    ? classifyChildAdmission(item.dobYmd, resolvedVisitDate).unitPriceCents
                    : item.priceOverrideCents,
            }
          : item,
      ),
    );
  }

  function setPrice(selectionKey: string, amountCents: number | null) {
    setAttendees((current) =>
      current.map((item) =>
        item.selectionKey === selectionKey
          ? {
              ...item,
              priceOverrideCents: amountCents,
              paymentConfirmed: false,
              paymentMethod:
                item.paymentMethod === "free_pass" || item.paymentMethod === "birthday_party"
                  ? null
                  : item.paymentMethod,
              birthdayPartyId: null,
              birthdayPartyLabel: null,
            }
          : item,
      ),
    );
  }

  function setPaymentConfirmed(selectionKey: string, confirmed: boolean) {
    setAttendees((current) =>
      current.map((item) =>
        item.selectionKey === selectionKey ? { ...item, paymentConfirmed: confirmed } : item,
      ),
    );
  }

  function setBirthdayParty(
    selectionKey: string,
    party: BirthdayPartyOption | null,
  ) {
    setAttendees((current) =>
      current.map((item) =>
        item.selectionKey === selectionKey
          ? {
              ...item,
              birthdayPartyId: party?.id ?? null,
              birthdayPartyLabel: party?.label ?? null,
            }
          : item,
      ),
    );
  }

  function applyNameCorrection(correction: NameCorrectionSuccess["correction"]) {
    setAttendees((current) =>
      current.map((item) => replaceAttendeeDisplayName(item, correction)),
    );
    setResults((current) =>
      current?.map((item) => replaceAttendeeDisplayName(item, correction)) ?? null,
    );
    setConflicts((current) =>
      current.map((item) =>
        item.participantId === correction.participantId
          ? {
              ...item,
              firstName: correction.correctedFirstName,
              lastName: correction.correctedLastName,
              fullName:
                `${correction.correctedFirstName} ${correction.correctedLastName}`.trim(),
              originalFirstName: correction.originalFirstName,
              originalLastName: correction.originalLastName,
              nameCorrected: true,
            }
          : item,
      ),
    );
  }

  async function submitVisit(attendeesToSubmit = attendees) {
    if (submitLockRef.current || submitting) return;

    const gate = canSubmitCheckInGroup(attendeesToSubmit, resolvedVisitDate);
    if (!gate.ok) {
      setSubmitError(gate.message);
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const nativeAttendeesToSubmit = attendeesToSubmit.filter(
        (item) => item.source !== "legacy_smartwaiver" && item.participantId,
      );
      const foundConflicts = await fetchOpenPlayVisitConflicts({
        visitDateYmd: resolvedVisitDate,
        participantIds: nativeAttendeesToSubmit.map((attendee) => attendee.participantId),
      });
      if (foundConflicts.length > 0) {
        setConflicts(foundConflicts);
        setSubmitError(null);
        return;
      }

      const nativeBody = buildVisitCreateBody({
        visitDateYmd: resolvedVisitDate,
        attendees: attendeesToSubmit,
        notes: attendeesToSubmit
          .filter((item) => item.paymentMethod === "birthday_party")
          .map((item) => `${item.fullName} attending ${item.birthdayPartyLabel}`)
          .join("; ") || null,
      });
      const legacyBody = buildLegacyCheckInBody({
        visitDateYmd: resolvedVisitDate,
        attendees: attendeesToSubmit,
        notes: attendeesToSubmit
          .filter((item) => item.paymentMethod === "birthday_party")
          .map((item) => `${item.fullName} attending ${item.birthdayPartyLabel}`)
          .join("; ") || null,
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
      setConflicts([]);
      setResults(null);
      setQuery("");
      setStep("success");
      router.refresh();
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

  function keepExistingAndContinue(conflict: CheckInConflict) {
    const remaining = attendees.filter(
      (attendee) => attendee.participantId !== conflict.participantId,
    );
    const removed = attendees.find(
      (attendee) => attendee.participantId === conflict.participantId,
    );
    if (removed) removeAttendee(removed.selectionKey);
    if (remaining.length > 0) {
      void submitVisit(remaining);
    }
  }

  function startNewCheckIn() {
    submitLockRef.current = false;
    setSubmitting(false);
    setSuccess(null);
    setSubmitError(null);
    setAttendees([]);
    setConflicts([]);
    setResults(null);
    setQuery("");
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
    <div id="check-in-desk" className="mx-auto mt-4 max-w-xl scroll-mt-4 space-y-4 pb-28">
      <p className="text-sm font-semibold text-slate-600">
        Visit date <span className="font-black text-slate-950">{resolvedVisitDate}</span>
      </p>

      <CheckInSearchForm
        query={query}
        onQueryChange={handleQueryChange}
        loading={displaySearchLoading}
        disabled={submitting}
        inputRef={searchInputRef}
      />

      <CheckInGroupPanel
        attendees={attendees}
        visitDateYmd={resolvedVisitDate}
        onRemove={removeAttendee}
        onEditName={(attendee) => setEditNameTarget(attendee)}
        onAdultModeChange={setAdultMode}
        onPaymentMethodChange={setPaymentMethod}
        onPriceChange={setPrice}
      />

      <CheckInConflictPanel
        conflicts={conflicts}
        pendingAttendees={attendees}
        visitDateYmd={resolvedVisitDate}
        onKeepExistingAndContinue={keepExistingAndContinue}
        onRemovePending={(participantId) => {
          const attendee = attendees.find((item) => item.participantId === participantId);
          if (attendee) removeAttendee(attendee.selectionKey);
        }}
        onEditName={(conflict) => setEditNameTarget(conflict)}
      />

      {attendees.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-3 font-semibold text-slate-700">
              <dt>Expected cash</dt>
              <dd>{formatCents(confirmableTotals.cashTotalCents)}</dd>
            </div>
            <div className="flex justify-between gap-3 font-semibold text-slate-700">
              <dt>Expected card</dt>
              <dd>{formatCents(confirmableTotals.cardTotalCents)}</dd>
            </div>
            <div className="flex justify-between gap-3 text-base font-black text-slate-950">
              <dt>Expected combined</dt>
              <dd>{formatCents(confirmableTotals.combinedTotalCents)}</dd>
            </div>
          </dl>
          {confirmableTotals.hasUncertainPrices ? (
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
          attendees={attendees}
          visitDateYmd={resolvedVisitDate}
          birthdayParties={birthdayParties}
          onLocationToggle={toggleLocation}
          onAdultModeChange={setAdultMode}
          onPaymentMethodChange={setPaymentMethod}
          onPriceChange={setPrice}
          onPaymentConfirmedChange={setPaymentConfirmed}
          onBirthdayPartyChange={setBirthdayParty}
          onEditName={(result) => setEditNameTarget(result)}
          statusRef={searchStatusRef}
        />
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-xl gap-3">
          <button
            type="button"
            disabled={
              attendees.length === 0 ||
              submitting ||
              (conflicts.length > 0 && confirmableAttendees.length === 0)
            }
            onClick={() => {
              void submitVisit(conflicts.length > 0 ? confirmableAttendees : attendees);
            }}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Checking in…"
              : confirmableAttendees.length > 0
                ? `Confirm check-in (${conflicts.length > 0 ? confirmableAttendees.length : attendees.length})`
                : "Confirm check-in"}
          </button>
        </div>
      </div>
      <EditWaiverNameDialog
        target={editNameTarget}
        onClose={() => setEditNameTarget(null)}
        onSaved={applyNameCorrection}
      />
    </div>
  );
}
