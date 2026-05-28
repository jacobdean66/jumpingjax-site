"use client";

import { useMemo, useState, type ReactNode } from "react";
import { MOCK_BLOCKED_DATE_SET, startOfToday, toYMD } from "@/lib/mockBooking";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

type Props = {
  value: string | null;
  onChange: (ymd: string | null) => void;
  blocked?: ReadonlySet<string>;
  onBlockedDateClick?: (ymd: string) => void;
  blockedPopoverYmd?: string | null;
  renderBlockedPopover?: (ymd: string) => ReactNode;
  /** Optional: restrict how far out users can browse */
  maxMonthsAhead?: number;
};

function monthMatrix(year: number, monthIndex: number): (number | null)[][] {
  const first = new Date(year, monthIndex, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

export function BookingDateCalendar({
  value,
  onChange,
  blocked = MOCK_BLOCKED_DATE_SET,
  onBlockedDateClick,
  blockedPopoverYmd,
  renderBlockedPopover,
  maxMonthsAhead = 6,
}: Props) {
  const today = useMemo(() => startOfToday(), []);
  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const matrix = useMemo(
    () => monthMatrix(year, monthIndex),
    [year, monthIndex],
  );

  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const maxCursor = useMemo(() => {
    const t = new Date(today);
    t.setMonth(t.getMonth() + maxMonthsAhead);
    return new Date(t.getFullYear(), t.getMonth(), 1);
  }, [today, maxMonthsAhead]);

  const minCursor = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
    [today],
  );

  const canPrev =
    cursor.getFullYear() > minCursor.getFullYear() ||
    (cursor.getFullYear() === minCursor.getFullYear() &&
      cursor.getMonth() > minCursor.getMonth());

  const canNext =
    cursor.getFullYear() < maxCursor.getFullYear() ||
    (cursor.getFullYear() === maxCursor.getFullYear() &&
      cursor.getMonth() < maxCursor.getMonth());

  const shiftMonth = (delta: number) => {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          disabled={!canPrev}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-lg font-bold text-white transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-35"
          aria-label="Previous month"
        >
          ‹
        </button>
        <p className="min-w-0 truncate text-center text-sm font-black uppercase tracking-wide text-cyan-200">
          {monthLabel}
        </p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          disabled={!canNext}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-lg font-bold text-white transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-35"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div
        className="mt-4 grid grid-cols-7 gap-1 text-center text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 sm:text-xs"
        role="row"
      >
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="mt-1 space-y-1">
        {matrix.map((row, ri) => (
          <div key={ri} className="grid grid-cols-7 gap-1">
            {row.map((day, ci) => {
              if (day === null) {
                return <div key={`e-${ri}-${ci}`} className="aspect-square" />;
              }
              const d = new Date(year, monthIndex, day, 12, 0, 0, 0);
              const ymd = toYMD(d);
              const isPast = d < today;
              const isBlocked = blocked.has(ymd);
              const disabled = isPast;
              const selected = value === ymd;

              const showBlockedPopover =
                isBlocked &&
                blockedPopoverYmd === ymd &&
                Boolean(renderBlockedPopover);

              return (
                <div key={ymd} className="relative">
                  <button
                    type="button"
                    disabled={disabled}
                    aria-disabled={isBlocked || undefined}
                    onClick={() => {
                      if (disabled) return;
                      if (isBlocked) {
                        onBlockedDateClick?.(ymd);
                        return;
                      }
                      onChange(ymd);
                    }}
                    className={[
                      "relative flex aspect-square min-h-[2.75rem] items-center justify-center rounded-xl text-sm font-semibold transition",
                      selected
                        ? "z-[1] bg-cyan-400 text-black shadow-lg shadow-cyan-950/40"
                        : isBlocked
                          ? "bg-white/5 text-white hover:bg-white/12 active:scale-[0.97]"
                          : isPast
                            ? "cursor-not-allowed text-slate-600 opacity-45"
                            : "bg-white/5 text-white hover:bg-white/12 active:scale-[0.97]",
                    ].join(" ")}
                    aria-label={`${ymd}${
                      isBlocked ? ", unavailable" : selected ? ", selected" : ""
                    }`}
                    aria-pressed={selected}
                  >
                    {day}
                    {isBlocked && (
                      <span
                        className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full border border-amber-200/50 bg-amber-300 text-[0.65rem] font-black leading-none text-black shadow-sm shadow-black/20"
                        aria-hidden="true"
                      >
                        !
                      </span>
                    )}
                  </button>
                {showBlockedPopover && (
                  <div
                    className="absolute bottom-full left-1/2 z-30 mb-2 w-[min(16rem,82vw)] -translate-x-1/2 rounded-xl border border-amber-300/45 bg-[#140f04] px-3 py-2 text-left text-xs leading-relaxed text-amber-50 shadow-2xl shadow-black/50"
                    role="alert"
                  >
                    {renderBlockedPopover?.(ymd)}
                    <span
                      className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-amber-300/45 bg-[#140f04]"
                      aria-hidden="true"
                    />
                  </div>
                )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-slate-400">
        Dates marked with ! have unavailable cart items. Tap one to see which
        rental is unavailable. Past days are grayed out and cannot be selected.
      </p>
    </div>
  );
}
