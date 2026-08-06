"use client";

import type { StaffSearchResult } from "@/lib/open-play/check-in-client";

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  disabled?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
};

export function CheckInSearchForm({
  query,
  onQueryChange,
  onSubmit,
  loading,
  disabled = false,
  inputRef,
}: Props) {
  return (
    <form
      className="sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-slate-100/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:bg-white sm:px-4 sm:shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="check-in-search" className="block text-sm font-bold text-slate-700">
        Search by first, last, or full name
        <input
          ref={inputRef}
          id="check-in-search"
          type="search"
          name="check-in-search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          value={query}
          disabled={disabled || loading}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Type a name"
          className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-sky-500 disabled:opacity-60"
        />
      </label>
      <button
        type="submit"
        disabled={disabled || loading || query.trim().length < 2}
        className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Searching…" : "Search"}
      </button>
    </form>
  );
}

type ResultsProps = {
  results: StaffSearchResult[] | null;
  loading: boolean;
  error: string | null;
  selectedIds: Set<string>;
  onSelect: (result: StaffSearchResult) => void;
  emptyMessage?: string;
  statusRef?: React.RefObject<HTMLDivElement | null>;
};

export function CheckInSearchResults({
  results,
  loading,
  error,
  selectedIds,
  onSelect,
  emptyMessage = "No matching waivers found.",
  statusRef,
}: ResultsProps) {
  if (loading) {
    return (
      <div
        ref={statusRef}
        tabIndex={-1}
        className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600 outline-none"
        role="status"
        aria-live="polite"
      >
        Searching…
      </div>
    );
  }

  if (error) {
    return (
      <div
        ref={statusRef}
        tabIndex={-1}
        className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800 outline-none"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (results === null) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm font-semibold text-slate-500">
        Search for a guest to begin check-in.
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div
        ref={statusRef}
        tabIndex={-1}
        className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600 outline-none"
        role="status"
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid gap-3" role="list" aria-label="Search results">
      <div ref={statusRef} tabIndex={-1} className="sr-only" role="status" aria-live="polite">
        {results.length} result{results.length === 1 ? "" : "s"}
      </div>
      {results.map((result) => {
        const selected = selectedIds.has(result.participantId);
        const expired = result.expired;
        return (
          <article
            key={result.participantId}
            role="listitem"
            className={
              expired
                ? "rounded-2xl border border-rose-200 bg-rose-50 p-4"
                : selected
                  ? "rounded-2xl border-2 border-sky-500 bg-sky-50 p-4"
                  : "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-xl font-black leading-tight text-slate-950">
                  {result.fullName}
                </h3>
                <p className="mt-2 text-sm font-semibold text-slate-600">
                  Born {result.birthYear}
                  {result.signerLastInitial
                    ? ` · Signer ${result.signerLastInitial}.`
                    : ""}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Expires {result.expiresOnYmd}
                </p>
              </div>
              <span
                className={
                  expired
                    ? "shrink-0 rounded-full bg-rose-600 px-3 py-1 text-xs font-black uppercase tracking-wide text-white"
                    : "shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-800"
                }
              >
                {expired ? "Expired" : "Valid"}
              </span>
            </div>

            {expired ? (
              <p className="mt-4 text-sm font-semibold text-rose-800">
                A new waiver is required before check-in. Direct the guest to the
                public waiver form.
              </p>
            ) : (
              <button
                type="button"
                disabled={selected}
                onClick={() => onSelect(result)}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-sky-500 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-sky-200"
              >
                {selected ? "Already in today’s group" : "Add to today’s group"}
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}
