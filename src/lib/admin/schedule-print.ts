import type { CalendarDay, CalendarEvent } from "./schedule";
import { formatProductLabel } from "./schedule-products";

const CANCELLED_RENTAL_STATUSES = new Set(["cancelled", "canceled"]);

function parseYmd(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function joinNaturalLanguage(values: readonly string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

export function formatSelectedDatesHeading(selectedDates: readonly string[]): string {
  const parsed = [...new Set(selectedDates)]
    .map(parseYmd)
    .filter((date): date is NonNullable<typeof date> => date !== null)
    .sort((a, b) =>
      `${a.year}-${String(a.month).padStart(2, "0")}-${String(a.day).padStart(2, "0")}`.localeCompare(
        `${b.year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`,
      ),
    );
  if (parsed.length === 0) return "";

  const years = new Set(parsed.map((date) => date.year));
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    ...(years.size > 1 ? { year: "numeric" as const } : {}),
    timeZone: "UTC",
  });
  const labels = parsed.map((date) =>
    formatter.format(new Date(Date.UTC(date.year, date.month - 1, date.day))),
  );
  const joined = joinNaturalLanguage(labels);
  return years.size === 1 ? `${joined}, ${parsed[0]?.year}` : joined;
}

export function formatStoredRentalTotal(
  value: number | string | null | undefined,
): string {
  if (value === null || value === undefined) return "Price unavailable";
  if (
    typeof value === "string" &&
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())
  ) {
    return "Price unavailable";
  }
  const parsed = typeof value === "number" ? value : Number(value.trim());
  if (!Number.isFinite(parsed)) return "Price unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed);
}

function isRentalEvent(event: CalendarEvent): boolean {
  return event.type === "rental" || event.type === "foam-party";
}

export function eventsForSchedulePrint(
  events: readonly CalendarEvent[],
  selectedDates: readonly string[],
): CalendarEvent[] {
  const selected = new Set(selectedDates);
  return events.filter((event) => {
    if (selected.size > 0 && !selected.has(event.date)) return false;
    return !(
      isRentalEvent(event) &&
      CANCELLED_RENTAL_STATUSES.has(event.status.trim().toLowerCase())
    );
  });
}

export function schedulePrintRowText(event: CalendarEvent): string {
  const parts = [
    event.type === "rental"
      ? "RENTAL"
      : event.type === "foam-party"
        ? "FOAM PARTY"
        : event.type === "public-party"
          ? "PUBLIC PARTY"
          : "PRIVATE PARTY",
    event.customer,
  ];
  if (event.phone) parts.push(event.phone);
  parts.push(
    event.products.length > 0
      ? event.products.map(formatProductLabel).join(", ")
      : event.title,
    event.displayTime && event.displayTime !== "Time not set"
      ? event.displayTime
      : "Time not set",
  );
  if (event.room) parts.push(event.room);
  if (event.location) parts.push(event.location);
  if (isRentalEvent(event)) {
    const total = formatStoredRentalTotal(event.rentalTotal);
    parts.push(total === "Price unavailable" ? total : `Total: ${total}`);
  }
  return parts.join(" - ");
}

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

export function printOrientationForView(
  view: "day" | "week" | "month",
): "landscape" | "portrait" {
  // Day, week, and month all prefer landscape so single-day prints keep columns.
  void view;
  return "landscape";
}
