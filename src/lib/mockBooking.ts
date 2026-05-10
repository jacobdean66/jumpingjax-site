/**
 * Mock availability and pricing for the booking UI (no backend).
 * Dates are local calendar days in ISO `YYYY-MM-DD` form.
 */

export type DurationOption = {
  id: string;
  label: string;
  hint: string;
  /** Consecutive calendar days the unit is reserved on-site */
  spanDays: number;
  /** Multiplier applied to the rental's starting price */
  priceMultiplier: number;
};

/** Flat mock fee shown as delivery / service — not a real quote. */
export const MOCK_SERVICE_FEE = 45;

export const MOCK_DURATION_OPTIONS: DurationOption[] = [
  {
    id: "half",
    label: "Half day",
    hint: "Up to 4 hours — great for weekday parties",
    spanDays: 1,
    priceMultiplier: 0.72,
  },
  {
    id: "full",
    label: "Full day",
    hint: "Standard 8-hour window",
    spanDays: 1,
    priceMultiplier: 1,
  },
  {
    id: "weekend",
    label: "2-day weekend",
    hint: "Fri evening pickup or Sat–Sun hold",
    spanDays: 2,
    priceMultiplier: 1.82,
  },
  {
    id: "extended",
    label: "3-day event",
    hint: "Festivals & multi-day venues",
    spanDays: 3,
    priceMultiplier: 2.58,
  },
];

/** Static mock blackout dates (summer 2026 examples + scattered days). */
const MOCK_BLOCKED_LIST: string[] = [
  "2026-05-17",
  "2026-05-18",
  "2026-05-24",
  "2026-05-25",
  "2026-05-31",
  "2026-06-01",
  "2026-06-07",
  "2026-06-14",
  "2026-06-15",
  "2026-06-21",
  "2026-06-28",
  "2026-07-04",
  "2026-07-05",
];

export const MOCK_BLOCKED_DATE_SET: ReadonlySet<string> = new Set(
  MOCK_BLOCKED_LIST,
);

export function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function startOfToday(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate(), 0, 0, 0, 0);
}

export function enumerateRange(startYmd: string, spanDays: number): string[] {
  const start = parseYMD(startYmd);
  const out: string[] = [];
  for (let i = 0; i < spanDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(toYMD(d));
  }
  return out;
}

export function rangeHasBlocked(
  startYmd: string,
  spanDays: number,
  blocked: ReadonlySet<string>,
): boolean {
  return enumerateRange(startYmd, spanDays).some((d) => blocked.has(d));
}

export function estimateRentalSubtotal(
  startingPrice: number,
  multiplier: number,
): number {
  return Math.round(startingPrice * multiplier);
}

export function estimateGrandTotal(
  startingPrice: number,
  multiplier: number,
  serviceFee: number = MOCK_SERVICE_FEE,
): number {
  return estimateRentalSubtotal(startingPrice, multiplier) + serviceFee;
}

export function formatDisplayDate(ymd: string): string {
  const d = parseYMD(ymd);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
