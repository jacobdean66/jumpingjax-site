"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  addDays,
  dateToYmd,
  datesForPreset,
  formatCompactDate,
  formatLongDate,
  formatStripDayLabel,
  monthMatrix,
  normalizeSelectedDates,
  removeDateFromDraft,
  removeLoadedPlannerDate,
  sortUniqueYmd,
  toggleDateInDraft,
  todayYmd,
  weekStripContaining,
  type DatePresetId,
} from "@/lib/admin/delivery-planner-dates";

const PRESETS: Array<{ id: DatePresetId; label: string }> = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "this-weekend", label: "This weekend" },
  { id: "next-weekend", label: "Next weekend" },
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

export type DeliveryDateSelectorVariant = "bar" | "mobile";

export function DeliveryDateSelector({
  activeDate,
  loadedDates,
  onNavigate,
  variant = "bar",
}: {
  activeDate: string;
  loadedDates: string[];
  onNavigate: (next: { activeDate: string; loadedDates: string[] }) => void;
  variant?: DeliveryDateSelectorVariant;
}) {
  const dialogTitleId = useId();
  const dialogId = `${dialogTitleId}-dialog`;
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const active = normalizeSelectedDates([activeDate])[0]!;
  const loaded = useMemo(
    () => normalizeSelectedDates(loadedDates.length > 0 ? loadedDates : [active]),
    [loadedDates, active],
  );
  const multiSession = loaded.length > 1;
  const strip = useMemo(() => weekStripContaining(active), [active]);
  const today = todayYmd();

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [multiMode, setMultiMode] = useState(false);
  const [draftDates, setDraftDates] = useState<string[]>(loaded);
  const [cursor, setCursor] = useState(() => {
    const [year, month] = active.split("-").map(Number);
    return new Date(year ?? 2026, (month ?? 1) - 1, 1);
  });

  useLayoutEffect(() => {
    const root = stripRef.current;
    if (!root) return;
    const selected = root.querySelector<HTMLElement>('[data-strip-active="true"]');
    selected?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [active, variant]);

  function navigateSingle(ymd: string) {
    if (!ymd) return;
    onNavigate({ activeDate: ymd, loadedDates: [ymd] });
  }

  function activateLoaded(ymd: string) {
    if (!loaded.includes(ymd)) return;
    onNavigate({ activeDate: ymd, loadedDates: loaded });
  }

  function openCalendar(options?: { multi?: boolean }) {
    const nextMulti = Boolean(options?.multi);
    setMultiMode(nextMulti);
    setDraftDates(nextMulti ? loaded : [active]);
    const [year, month] = active.split("-").map(Number);
    setCursor(new Date(year ?? 2026, (month ?? 1) - 1, 1));
    setCalendarOpen(true);
  }

  function cancelCalendar() {
    setCalendarOpen(false);
    setMultiMode(false);
    queueMicrotask(() => openButtonRef.current?.focus());
  }

  function commitMulti() {
    const normalized = sortUniqueYmd(draftDates);
    if (normalized.length === 0) {
      navigateSingle(active);
      cancelCalendar();
      return;
    }
    const nextActive = normalized.includes(active) ? active : normalized[0]!;
    onNavigate({ activeDate: nextActive, loadedDates: normalized });
    setCalendarOpen(false);
    setMultiMode(false);
    queueMicrotask(() => openButtonRef.current?.focus());
  }

  function onCalendarDayClick(ymd: string) {
    if (!multiMode) {
      navigateSingle(ymd);
      setCalendarOpen(false);
      setMultiMode(false);
      queueMicrotask(() => openButtonRef.current?.focus());
      return;
    }
    setDraftDates((current) => toggleDateInDraft(current, ymd));
  }

  function removeChip(ymd: string) {
    const next = removeLoadedPlannerDate(loaded, active, ymd);
    if (!next) {
      navigateSingle(today);
      return;
    }
    onNavigate(next);
  }

  useEffect(() => {
    if (!calendarOpen) return;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    // Modal scroll lock — body style is intentionally temporary.
    // eslint-disable-next-line react-hooks/immutability -- document body scroll lock
    document.body.style.overflow = "hidden";
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelCalendar();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [calendarOpen]);

  useLayoutEffect(() => {
    if (!calendarOpen || !dialogRef.current) return;
    const selected = dialogRef.current.querySelector<HTMLElement>(
      '[aria-pressed="true"]',
    );
    selected?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [calendarOpen, cursor, multiMode, draftDates, active]);

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

  const stripButtons = (
    <div
      ref={stripRef}
      className="rp-date-strip flex min-w-0 items-stretch gap-1 overflow-x-auto overscroll-x-contain pb-0.5"
      role="list"
      aria-label="Week dates"
    >
      {strip.map((ymd) => {
        const isActive = ymd === active;
        const isLoaded = loaded.includes(ymd);
        return (
          <button
            key={ymd}
            type="button"
            role="listitem"
            data-strip-active={isActive ? "true" : "false"}
            onClick={() => {
              if (multiSession && isLoaded) {
                activateLoaded(ymd);
                return;
              }
              navigateSingle(ymd);
            }}
            className={`rp-date-strip-day flex min-h-11 min-w-[3.25rem] shrink-0 flex-col items-center justify-center rounded-lg px-2 py-1.5 text-center ${
              isActive
                ? "rp-date-strip-day-active"
                : isLoaded
                  ? "rp-date-strip-day-loaded"
                  : "rp-date-strip-day-idle"
            }`}
            aria-current={isActive ? "date" : undefined}
            aria-label={`${formatLongDate(ymd)}${isActive ? ", active" : ""}`}
          >
            <span className="text-[10px] font-black uppercase tracking-[0.06em]">
              {formatStripDayLabel(ymd).split(" ")[0]}
            </span>
            <span className="text-sm font-black leading-none">
              {formatStripDayLabel(ymd).split(" ")[1]}
            </span>
            {isActive ? (
              <span className="rp-date-strip-marker mt-1" aria-hidden="true" />
            ) : (
              <span className="mt-1 h-1 w-1" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  );

  const calendarDialog = calendarOpen ? (
    <div
      className={`rp-date-sheet-backdrop fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4 ${
        variant === "mobile" ? "" : ""
      }`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) cancelCalendar();
      }}
    >
      <div
        id={dialogId}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        onKeyDown={onDialogKeyDown}
        className="rp-date-sheet flex max-h-[min(92dvh,40rem)] w-full max-w-lg flex-col self-end overflow-hidden rounded-t-2xl border-2 sm:self-center sm:rounded-2xl"
      >
        <header className="rp-panel-head flex shrink-0 items-start justify-between gap-3 border-b-2 p-4">
          <div className="min-w-0">
            <h2 id={dialogTitleId} className="rp-panel-title text-lg font-black">
              {multiMode ? "Plan multiple dates" : "Jump to date"}
            </h2>
            <p className="rp-panel-meta mt-1 text-xs font-bold">
              {multiMode
                ? "Tap dates to select or deselect, then view the selection."
                : "One tap jumps to that day immediately."}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={cancelCalendar}
            className="rp-btn min-h-11 min-w-11 rounded-lg px-3 text-sm font-black"
            aria-label="Close calendar"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {multiMode ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setDraftDates(datesForPreset(preset.id))}
                  className="rp-btn rounded-full px-3 py-2 text-xs font-black"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                setCursor(
                  (current) =>
                    new Date(current.getFullYear(), current.getMonth() - 1, 1),
                )
              }
              className="rp-btn flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg font-black"
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
                    new Date(current.getFullYear(), current.getMonth() + 1, 1),
                )
              }
              className="rp-btn flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg font-black"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div
            className="grid grid-cols-7 content-start gap-1"
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
                const isSelected = multiMode
                  ? draftSet.has(ymd)
                  : ymd === active;
                const isToday = ymd === today;
                return (
                  <button
                    key={ymd}
                    type="button"
                    onClick={() => onCalendarDayClick(ymd)}
                    className={`flex h-10 w-full shrink-0 items-center justify-center rounded-lg text-sm font-black transition ${
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

          {multiMode && draftDates.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {draftDates.map((date) => (
                <button
                  key={date}
                  type="button"
                  onClick={() =>
                    setDraftDates((current) => removeDateFromDraft(current, date))
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
          {multiMode ? (
            <>
              <button
                type="button"
                onClick={() => setDraftDates([])}
                className="rp-btn min-h-11 flex-1 rounded-xl px-3 text-sm font-black"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={cancelCalendar}
                className="rp-btn min-h-11 flex-1 rounded-xl px-3 text-sm font-black"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={commitMulti}
                className="rp-btn-primary min-h-11 flex-[1.4] rounded-xl px-3 text-sm font-black"
              >
                View Selected Dates
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={cancelCalendar}
              className="rp-btn min-h-11 w-full rounded-xl px-3 text-sm font-black"
            >
              Cancel
            </button>
          )}
        </footer>
      </div>
    </div>
  ) : null;

  if (variant === "mobile") {
    return (
      <>
        <section className="rp-date-nav rp-date-nav-mobile shrink-0 print:hidden lg:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigateSingle(addDays(active, -1))}
              className="rp-btn flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg font-black"
              aria-label="Previous day"
            >
              ‹
            </button>
            <div className="min-w-0 flex-1">{stripButtons}</div>
            <button
              type="button"
              onClick={() => navigateSingle(addDays(active, 1))}
              className="rp-btn flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg font-black"
              aria-label="Next day"
            >
              ›
            </button>
            <button
              ref={openButtonRef}
              type="button"
              onClick={() => openCalendar()}
              className="rp-btn flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-black"
              aria-haspopup="dialog"
              aria-expanded={calendarOpen}
              aria-controls={calendarOpen ? dialogId : undefined}
              aria-label="Open calendar"
            >
              Cal
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigateSingle(today)}
              className="rp-btn-primary min-h-10 rounded-lg px-3 text-xs font-black"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => openCalendar({ multi: true })}
              className="rp-btn min-h-10 rounded-lg px-3 text-xs font-black"
            >
              Plan multiple dates
            </button>
          </div>
          {multiSession ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {loaded.map((ymd) => (
                <button
                  key={ymd}
                  type="button"
                  onClick={() => activateLoaded(ymd)}
                  className={`rp-date-chip inline-flex min-h-10 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-black ${
                    ymd === active ? "rp-date-chip-active" : ""
                  }`}
                >
                  {formatCompactDate(ymd)}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeChip(ymd);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        removeChip(ymd);
                      }
                    }}
                    aria-label={`Remove ${formatLongDate(ymd)}`}
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </section>
        {calendarDialog}
      </>
    );
  }

  return (
    <>
      <section className="rp-date-nav rp-date-nav-bar mb-2 hidden shrink-0 print:hidden lg:block">
        <div className="rp-panel flex flex-col gap-2 rounded-2xl border-2 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigateSingle(addDays(active, -1))}
              className="rp-btn flex h-11 min-w-11 items-center justify-center rounded-lg text-lg font-black"
              aria-label="Previous day"
            >
              ‹
            </button>
            <button
              ref={openButtonRef}
              type="button"
              onClick={() => openCalendar()}
              className="rp-date-active-button min-h-11 min-w-[14rem] flex-1 rounded-xl px-4 py-2 text-left"
              aria-haspopup="dialog"
              aria-expanded={calendarOpen}
              aria-controls={calendarOpen ? dialogId : undefined}
            >
              <span className="rp-eyebrow block text-[10px] font-black uppercase tracking-[0.14em]">
                Active date
              </span>
              <span className="rp-panel-title mt-0.5 block text-sm font-black">
                {formatLongDate(active)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => navigateSingle(addDays(active, 1))}
              className="rp-btn flex h-11 min-w-11 items-center justify-center rounded-lg text-lg font-black"
              aria-label="Next day"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => navigateSingle(today)}
              className="rp-btn-primary min-h-11 rounded-lg px-3 text-xs font-black"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => openCalendar({ multi: true })}
              className="rp-btn min-h-11 rounded-lg px-3 text-xs font-black"
            >
              Plan multiple dates
            </button>
          </div>
          {stripButtons}
          {multiSession ? (
            <div className="flex flex-wrap gap-1.5 border-t-2 border-slate-600/40 pt-2">
              {loaded.map((ymd) => (
                <button
                  key={ymd}
                  type="button"
                  onClick={() => activateLoaded(ymd)}
                  className={`rp-date-chip inline-flex min-h-10 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-black ${
                    ymd === active ? "rp-date-chip-active" : ""
                  }`}
                >
                  {formatCompactDate(ymd)}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeChip(ymd);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        removeChip(ymd);
                      }
                    }}
                    aria-label={`Remove ${formatLongDate(ymd)}`}
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>
      {calendarDialog}
    </>
  );
}
