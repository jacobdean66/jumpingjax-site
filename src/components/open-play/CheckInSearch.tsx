"use client";

import Link from "next/link";
import { useState } from "react";

import { ChildCheckInControls } from "@/components/open-play/ChildCheckInControls";
import { ageInCompletedYearsOnDate } from "@/lib/open-play/pricing";
import type {
  BirthdayPartyOption,
  PaymentMethodChoice,
  SelectedAttendeeDraft,
  StaffSearchResult,
} from "@/lib/open-play/check-in-client";
import type { StaffWaiverParticipant } from "@/lib/waivers/search";

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  loading: boolean;
  disabled?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
};

export function CheckInSearchForm({ query, onQueryChange, loading, disabled = false, inputRef }: Props) {
  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-slate-100/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:bg-white sm:px-4 sm:shadow-sm">
      <label htmlFor="check-in-search" className="block text-sm font-bold text-slate-700">
        Search by first, last, or full name
        <input ref={inputRef} id="check-in-search" autoFocus type="search" name="check-in-search" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search" value={query} disabled={disabled} onChange={(event) => onQueryChange(event.target.value)} placeholder="Type a name" className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-sky-500 disabled:opacity-60" />
      </label>
      <p className="mt-2 min-h-5 text-sm font-bold text-slate-600" aria-live="polite">
        {loading
          ? `Loading results for “${query.trim()}”…`
          : query.trim()
            ? "Results update with every letter."
            : "Start typing a first name, last name, or full name."}
      </p>
    </div>
  );
}

type ResultsProps = {
  results: StaffSearchResult[] | null;
  loading: boolean;
  error: string | null;
  attendees: SelectedAttendeeDraft[];
  visitDateYmd: string;
  birthdayParties: BirthdayPartyOption[];
  onLocationToggle: (participant: StaffWaiverParticipant) => void;
  onPaymentMethodChange: (selectionKey: string, method: PaymentMethodChoice) => void;
  onPriceChange: (selectionKey: string, amountCents: number) => void;
  onPaymentConfirmedChange: (selectionKey: string, confirmed: boolean) => void;
  onBirthdayPartyChange: (selectionKey: string, party: BirthdayPartyOption | null) => void;
  emptyMessage?: string;
  statusRef?: React.RefObject<HTMLDivElement | null>;
};

function displayDob(dobYmd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dobYmd);
  return match ? `${match[2]}/${match[3]}/${match[1]}` : "Birthday unavailable";
}

function childAge(dobYmd: string, visitDateYmd: string): string {
  try { return String(ageInCompletedYearsOnDate(dobYmd, visitDateYmd)); } catch { return "—"; }
}

export function CheckInSearchResults({
  results, loading, error, attendees, visitDateYmd, birthdayParties,
  onLocationToggle, onPaymentMethodChange, onPriceChange,
  onPaymentConfirmedChange, onBirthdayPartyChange,
  emptyMessage = "No matching waivers found.", statusRef,
}: ResultsProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const attendeeByIdentity = new Map(attendees.map((item) => [item.identityKey, item]));

  if (loading) return <div ref={statusRef} tabIndex={-1} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600 outline-none" role="status">Searching…</div>;
  if (error) return <div ref={statusRef} tabIndex={-1} className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800 outline-none" role="alert">{error}</div>;
  if (results === null) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm font-semibold text-slate-500">Search for a guest to view their waiver.</div>;
  if (results.length === 0) return <div ref={statusRef} tabIndex={-1} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600 outline-none" role="status">{emptyMessage}</div>;

  return (
    <div className="grid gap-3" role="list" aria-label="Search results">
      <div ref={statusRef} tabIndex={-1} className="sr-only" role="status" aria-live="polite">{results.length} result{results.length === 1 ? "" : "s"}</div>
      {results.map((result) => {
        const key = result.selectionKey || result.participantId;
        const expanded = expandedKey === key;
        const legacy = result.source === "legacy_smartwaiver";
        const blocked = result.expired || (legacy && result.checkInEligible === false);
        const children = result.waiverParticipants ?? [];
        return (
          <article key={key} role="listitem" className={blocked ? "rounded-2xl border border-rose-200 bg-rose-50 p-4" : "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-xl font-black leading-tight text-slate-950">
                  {blocked ? result.fullName : (
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setExpandedKey(expanded ? null : key)}
                      className="text-left underline decoration-sky-400 decoration-2 underline-offset-4"
                    >
                      {result.fullName}
                    </button>
                  )}
                </h3>
                {!blocked ? (
                  <p className="mt-2 text-sm font-black text-sky-700">
                    {expanded ? "Hide waiver information" : "View waiver information"}
                  </p>
                ) : null}
                <p className="mt-1 text-sm text-slate-600">Expires {result.expiresOnYmd}</p>
                {legacy ? <p className="mt-2 text-xs font-black uppercase tracking-wide text-amber-800">{result.sourceLabel || "Legacy Smartwaiver"}</p> : null}
              </div>
              <span className={blocked ? "shrink-0 rounded-full bg-rose-600 px-3 py-1 text-xs font-black uppercase text-white" : "shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase text-emerald-800"}>{result.expired ? "Expired" : blocked ? "No check-in" : "Valid"}</span>
            </div>
            {blocked ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-semibold text-rose-800">A current waiver with a birthday is required before check-in.</p>
                <Link href="/waiver" target="_blank" rel="noreferrer" className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-rose-300 bg-white px-5 text-sm font-black text-rose-900">Open waiver form</Link>
              </div>
            ) : (
              <>
                {expanded ? (
                  <section className="mt-4 border-t border-slate-200 pt-4" aria-label={`Children on ${result.fullName}'s waiver`}>
                    <p className="text-sm font-bold text-slate-600">All children on the newest valid waiver</p>
                    <div className="mt-3 grid gap-3">
                      {children.map((child) => {
                        const identity = `${child.firstName.trim().toLowerCase()}|${child.lastName.trim().toLowerCase()}|${child.dobYmd || child.birthYear}`;
                        const attendee = attendeeByIdentity.get(identity);
                        return (
                          <div key={child.selectionKey} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-lg font-black text-slate-950">{child.fullName}</p>
                            <p className="mt-1 text-sm font-semibold text-slate-600">Birthday {displayDob(child.dobYmd)} · Age {childAge(child.dobYmd, visitDateYmd)}</p>
                            <button type="button" aria-pressed={Boolean(attendee)} onClick={() => onLocationToggle(child)} className={attendee ? "mt-3 min-h-12 w-full rounded-full bg-emerald-600 px-5 text-sm font-black text-white" : "mt-3 min-h-12 w-full rounded-full border-2 border-emerald-500 bg-white px-5 text-sm font-black text-emerald-900"}>{attendee ? "On location today ✓" : "Mark child on location"}</button>
                            {attendee ? <ChildCheckInControls attendee={attendee} birthdayParties={birthdayParties} onPaymentMethodChange={onPaymentMethodChange} onPriceChange={onPriceChange} onPaymentConfirmedChange={onPaymentConfirmedChange} onBirthdayPartyChange={onBirthdayPartyChange} /> : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}
