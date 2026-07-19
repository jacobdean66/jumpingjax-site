"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addDateRangeToSelection,
  dateToYmd,
  datesForPreset,
  datesToSearchParams,
  formatCompactDate,
  formatLongDate,
  monthMatrix,
  normalizeSelectedDates,
  parseDatesFromSearchParams,
  removeDateFromDraft,
  removeDateFromSelection,
  sortUniqueYmd,
  toggleDateInDraft,
  toggleDateInSelection,
  todayYmd,
  type DatePresetId,
} from "@/lib/admin/delivery-planner-dates";

const PRESETS: Array<{ id: DatePresetId; label: string }> = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "this-weekend", label: "This weekend" },
  { id: "next-weekend", label: "Next weekend" },
  { id: "clear", label: "Clear dates" },
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function summaryLabel(selected: string[]): string {
  if (selected.length === 0) return "Select route dates";
  if (selected.length === 1) return formatLongDate(selected[0]!);
  return `${selected.length} dates selected`;
}

function readPreservedFilters(
  searchParams: URLSearchParams | { get: (key: string) => string | null },
): Record<string, string | null> {
  return {
    work: searchParams.get("work"),
    truck: searchParams.get("truck"),
    load: searchParams.get("load"),
    status: searchParams.get("status"),
  };
}

export function DeliveryDateSelector({
  initialDates,
  selectedDates,
  onApplyDates,
}: {
  initialDates: string[];
  /** Controlled planning dates when embedded in RoutePlannerWorkspace. */
  selectedDates?: string[];
  /** When provided, apply via callback (no full navigation / scroll jump). */
  onApplyDates?: (dates: string[]) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dialogTitleId = useId();
  const dialogId = `${dialogTitleId}-dialog`;
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const selected = useMemo(() => {
    if (selectedDates) return sortUniqueYmd(selectedDates);
    const fromUrl = parseDatesFromSearchParams({
      date: searchParams.get("date"),
      dates: searchParams.get("dates"),
    });
    return fromUrl.length > 0 ? fromUrl : normalizeSelectedDates(initialDates);
  }, [searchParams, initialDates, selectedDates]);

  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [addDate, setAddDate] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [draftDates, setDraftDates] = useState<string[]>(selected);
  const [cursor, setCursor] = useState(() => {
    const anchor = selected[0] ?? todayYmd();
    const [year, month] = anchor.split("-").map(Number);
    return new Date(year ?? 2026, (month ?? 1) - 1, 1);
  });

  function applyDates(nextDates: string[]) {
    const normalized =
      nextDates.length === 0 ? [] : normalizeSelectedDates(nextDates);
    if (onApplyDates) {
      onApplyDates(normalized);
      return;
    }
    if (normalized.length === 0) {
      const params = new URLSearchParams();
      const extras = readPreservedFilters(searchParams);
      for (const [key, value] of Object.entries(extras)) {
        if (value != null && value !== "" && value !== "all") {
          params.set(key, value);
        }
      }
      const query = params.toString();
      router.replace(
        query ? `/admin/deliveries?${query}` : "/admin/deliveries",
        { scroll: false },
      );
      return;
    }
    const params = datesToSearchParams(
      normalized,
      readPreservedFilters(searchParams),
    );
    router.replace(`/admin/deliveries?${params.toString()}`, { scroll: false });
  }

  function openMobilePicker() {
    setDraftDates(selected);
    const anchor = selected[0] ?? todayYmd();
    const [year, month] = anchor.split("-").map(Number);
    setCursor(new Date(year ?? 2026, (month ?? 1) - 1, 1));
    setMobileOpen(true);
  }

  function closeMobilePicker() {
    setMobileOpen(false);
    // Closing discards unsaved draft; committed selection remains intact.
    queueMicrotask(() => openButtonRef.current?.focus());
  }

  function commitMobilePicker() {
    applyDates(draftDates);
    setMobileOpen(false);
    queueMicrotask(() => openButtonRef.current?.focus());
  }

  useEffect(() => {
    if (!mobileOpen) return;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        queueMicrotask(() => openButtonRef.current?.focus());
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const matrix = useMemo(
    () => monthMatrix(year, monthIndex),
    [year, monthIndex],
  );
  const monthLabel = cursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const today = todayYmd();
  const draftSet = useMemo(() => new Set(draftDates), [draftDates]);

  function onDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      {/* Mobile-first route date control */}
      <section className="rp-date-mobile shrink-0 print:hidden lg:hidden">
        <button
          ref={openButtonRef}
          type="button"
          onClick={openMobilePicker}
          className="rp-date-mobile-trigger flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border-2 px-3 py-3 text-left"
          aria-haspopup="dialog"
          aria-expanded={mobileOpen}
          aria-controls={mobileOpen ? dialogId : undefined}
        >
          <span className="min-w-0">
            <span className="rp-eyebrow block text-[10px] font-black uppercase tracking-[0.14em]">
              Route dates
            </span>
            <span className="rp-panel-title mt-0.5 block truncate text-sm font-black">
              {summaryLabel(selected)}
            </span>
          </span>
          <span className="rp-btn shrink-0 rounded-lg px-3 py-2 text-xs font-black">
            Select
          </span>
        </button>
      </section>

      {mobileOpen ? (
        <div
          className="rp-date-sheet-backdrop fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4 lg:hidden"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeMobilePicker();
          }}
        >
          <div
            ref={dialogRef}
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            onKeyDown={onDialogKeyDown}
            className="rp-date-sheet flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border-2 sm:rounded-2xl"
          >
            <header className="rp-panel-head flex shrink-0 items-start justify-between gap-3 border-b-2 p-4">
              <div className="min-w-0">
                <h2
                  id={dialogTitleId}
                  className="rp-panel-title text-lg font-black"
                >
                  Select route dates
                </h2>
                <p className="rp-panel-meta mt-1 text-xs font-bold">
                  Tap dates to select or deselect. Nonconsecutive dates are allowed.
                </p>
                <p
                  className="rp-eyebrow mt-2 text-xs font-black uppercase tracking-[0.12em]"
                  aria-live="polite"
                >
                  {draftDates.length === 0
                    ? "No dates selected"
                    : draftDates.length === 1
                      ? "1 date selected"
                      : `${draftDates.length} dates selected`}
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeMobilePicker}
                className="rp-btn min-h-11 min-w-11 rounded-lg px-3 text-sm font-black"
                aria-label="Close date selector"
              >
                Close
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCursor(
                      (current) =>
                        new Date(
                          current.getFullYear(),
                          current.getMonth() - 1,
                          1,
                        ),
                    )
                  }
                  className="rp-btn flex h-11 w-11 items-center justify-center rounded-lg text-lg font-black"
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <p className="rp-panel-title min-w-0 truncate text-center text-sm font-black">
                  {monthLabel}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setCursor(
                      (current) =>
                        new Date(
                          current.getFullYear(),
                          current.getMonth() + 1,
                          1,
                        ),
                    )
                  }
                  className="rp-btn flex h-11 w-11 items-center justify-center rounded-lg text-lg font-black"
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>

              <div
                className="grid grid-cols-7 gap-1"
                role="grid"
                aria-label={`${monthLabel} calendar`}
              >
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="rp-panel-meta py-1 text-center text-[10px] font-black uppercase"
                    role="columnheader"
                  >
                    {day}
                  </div>
                ))}
                {matrix.flatMap((row, rowIndex) =>
                  row.map((day, colIndex) => {
                    if (day == null) {
                      return (
                        <div
                          key={`empty-${rowIndex}-${colIndex}`}
                          className="h-11"
                          aria-hidden="true"
                        />
                      );
                    }
                    const ymd = dateToYmd(new Date(year, monthIndex, day));
                    const isSelected = draftSet.has(ymd);
                    const isToday = ymd === today;
                    return (
                      <button
                        key={ymd}
                        type="button"
                        onClick={() =>
                          setDraftDates((current) =>
                            toggleDateInDraft(current, ymd),
                          )
                        }
                        className={`flex h-11 w-full items-center justify-center rounded-lg text-sm font-black transition ${
                          isSelected
                            ? "rp-date-day-selected"
                            : isToday
                              ? "rp-date-day-today"
                              : "rp-date-day"
                        }`}
                        aria-pressed={isSelected}
                        aria-label={`${formatLongDate(ymd)}${
                          isSelected ? ", selected" : ""
                        }`}
                      >
                        {day}
                      </button>
                    );
                  }),
                )}
              </div>

              {draftDates.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {draftDates.map((date) => (
                    <button
                      key={date}
                      type="button"
                      onClick={() =>
                        setDraftDates((current) =>
                          removeDateFromDraft(current, date),
                        )
                      }
                      className="rp-date-chip inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-2 text-xs font-black"
                      aria-label={`Remove ${formatLongDate(date)}`}
                    >
                      {formatCompactDate(date)}
                      <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <footer className="rp-panel-head flex shrink-0 flex-wrap gap-2 border-t-2 p-4">
              <button
                type="button"
                onClick={() => setDraftDates([])}
                className="rp-btn min-h-11 flex-1 rounded-xl px-3 text-sm font-black"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={commitMobilePicker}
                className="rp-btn-primary min-h-11 flex-[1.4] rounded-xl px-3 text-sm font-black"
              >
                Apply dates
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {/* Desktop workflow — preserved and extended for multi-date */}
      <section className="rp-panel hidden rounded-2xl border-2 p-4 shadow-sm print:hidden lg:block">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="rp-eyebrow text-xs font-black uppercase tracking-[0.14em]">
              Planning window
            </p>
            <h2 className="rp-panel-title mt-1 text-xl font-black">
              {summaryLabel(selected)}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyDates(datesForPreset(preset.id))}
                className="rp-btn rounded-full px-3 py-2 text-xs font-black"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {selected.map((date) => (
            <button
              key={date}
              type="button"
              onClick={() =>
                applyDates(removeDateFromSelection(selected, date))
              }
              className="rp-date-chip rounded-full px-3 py-2 text-xs font-black"
              title="Remove date"
            >
              {formatLongDate(date)} ×
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="rp-task-meta grid gap-1 text-sm font-bold">
            Add date
            <div className="flex gap-2">
              <input
                type="date"
                value={addDate}
                onChange={(event) => setAddDate(event.target.value)}
                className="rp-input w-full rounded-xl px-3 py-2"
              />
              <button
                type="button"
                onClick={() => {
                  if (!addDate) return;
                  applyDates(toggleDateInSelection(selected, addDate));
                  setAddDate("");
                }}
                className="rp-btn-primary rounded-xl px-4 py-2 text-sm font-black"
              >
                Add
              </button>
            </div>
          </label>
          <label className="rp-task-meta grid gap-1 text-sm font-bold md:col-span-2">
            Add date range
            <div className="flex flex-wrap gap-2">
              <input
                type="date"
                value={rangeStart}
                onChange={(event) => setRangeStart(event.target.value)}
                className="rp-input rounded-xl px-3 py-2"
              />
              <input
                type="date"
                value={rangeEnd}
                onChange={(event) => setRangeEnd(event.target.value)}
                className="rp-input rounded-xl px-3 py-2"
              />
              <button
                type="button"
                onClick={() => {
                  if (!rangeStart || !rangeEnd) return;
                  applyDates(
                    addDateRangeToSelection(selected, rangeStart, rangeEnd),
                  );
                }}
                className="rp-btn rounded-xl px-4 py-2 text-sm font-black"
              >
                Add range
              </button>
            </div>
          </label>
        </div>
      </section>
    </>
  );
}
