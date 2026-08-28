import type { CalendarDay, CalendarEvent } from "./schedule";

export const SCHEDULE_PRINT_PAGE_SIZE = "6in 4in";

/**
 * Resolve which calendar days should appear in a print/email payload.
 * When selectedDates is empty, all visible days with (or without) events are used
 * based on includeEmpty. Non-consecutive selections are sorted chronologically.
 */
export function resolvePrintDays(input: {
  days: readonly CalendarDay[];
  selectedDates: readonly string[];
  eventsByDate: Record<string, CalendarEvent[]>;
  includeEmpty?: boolean;
}): CalendarDay[] {
  const includeEmpty = input.includeEmpty === true;
  const selected = new Set(
    input.selectedDates.map((value) => value.trim()).filter(Boolean),
  );
  const source =
    selected.size === 0
      ? [...input.days]
      : input.days.filter((day) => selected.has(day.ymd));

  const sorted = [...source].sort((a, b) => a.ymd.localeCompare(b.ymd));
  if (includeEmpty) return sorted;
  return sorted.filter((day) => (input.eventsByDate[day.ymd] ?? []).length > 0);
}

export function sortEventsForPrint(
  events: readonly CalendarEvent[],
): CalendarEvent[] {
  return [...events].sort((a, b) =>
    `${a.date} ${a.sortTime} ${a.id}`.localeCompare(
      `${b.date} ${b.sortTime} ${b.id}`,
    ),
  );
}

