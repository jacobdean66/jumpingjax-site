import { enumerateRange, parseYMD, toYMD } from "@/lib/mockBooking";

export type BookingSpanRow = {
  event_date: string;
  span_days: number;
};

/** Inclusive calendar window [start, end] as Date at local midnight. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function ymdToStart(ymd: string): Date {
  return startOfDay(parseYMD(ymd));
}

/** End date (inclusive) of a booking that starts on event_date with span_days. */
export function bookingInclusiveEnd(eventDateYmd: string, spanDays: number): Date {
  const start = ymdToStart(eventDateYmd);
  const end = new Date(start);
  end.setDate(start.getDate() + spanDays - 1);
  return startOfDay(end);
}

/**
 * Whether booking [event_date, span_days] overlaps inclusive window [winStart, winEnd].
 */
export function bookingOverlapsWindow(
  eventDateYmd: string,
  spanDays: number,
  winStart: Date,
  winEnd: Date,
): boolean {
  const b0 = ymdToStart(eventDateYmd);
  const b1 = bookingInclusiveEnd(eventDateYmd, spanDays);
  const w0 = startOfDay(winStart);
  const w1 = startOfDay(winEnd);
  return b0 <= w1 && b1 >= w0;
}

/**
 * Expand DB rows into a sorted unique list of YYYY-MM-DD strings inside the window.
 */
export function unavailableYmdsFromBookings(
  rows: BookingSpanRow[],
  winStart: Date,
  winEnd: Date,
): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    if (!bookingOverlapsWindow(row.event_date, row.span_days, winStart, winEnd)) {
      continue;
    }
    for (const ymd of enumerateRange(row.event_date, row.span_days)) {
      const d = ymdToStart(ymd);
      if (d >= startOfDay(winStart) && d <= startOfDay(winEnd)) {
        set.add(ymd);
      }
    }
  }
  return [...set].sort();
}

export function defaultAvailabilityWindow(monthsAhead: number): {
  winStart: Date;
  winEnd: Date;
} {
  const winStart = startOfDay(new Date());
  const winEnd = new Date(winStart);
  winEnd.setMonth(winEnd.getMonth() + monthsAhead);
  winEnd.setDate(winEnd.getDate() - 1);
  return { winStart, winEnd: startOfDay(winEnd) };
}

export function windowEndYmd(monthsAhead: number): string {
  const { winEnd } = defaultAvailabilityWindow(monthsAhead);
  return toYMD(winEnd);
}
