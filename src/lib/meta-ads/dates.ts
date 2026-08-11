import { META_ADS_MAX_RANGE_DAYS } from "./config";
import { sanitizedError, type MetaAdsSanitizedError } from "./errors";

export const META_ADS_DATE_PRESETS = [
  "today",
  "last_7d",
  "last_14d",
  "last_30d",
  "maximum",
  "custom",
] as const;

export type MetaAdsDatePreset = (typeof META_ADS_DATE_PRESETS)[number];

export type MetaAdsResolvedDateRange = Readonly<{
  preset: MetaAdsDatePreset;
  since: string;
  until: string;
  /** Equal-length period immediately before `since` (exclusive of current range). */
  comparisonSince: string;
  comparisonUntil: string;
  label: string;
  dayCount: number;
}>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format a calendar date in America/Indiana/Indianapolis (Jumping Jax local). */
export function formatIndianaDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Indiana/Indianapolis",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value: string): Date | null {
  if (!DATE_RE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function formatUtcDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function inclusiveDayCount(since: string, until: string): number {
  const a = parseIsoDate(since);
  const b = parseIsoDate(until);
  if (!a || !b) return 0;
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

export function isMetaAdsDatePreset(value: string): value is MetaAdsDatePreset {
  return (META_ADS_DATE_PRESETS as readonly string[]).includes(value);
}

export function resolveMetaAdsDateRange(input: {
  preset?: string | null;
  since?: string | null;
  until?: string | null;
  now?: Date;
}): Readonly<
  | { ok: true; range: MetaAdsResolvedDateRange }
  | { ok: false; error: MetaAdsSanitizedError }
> {
  const now = input.now ?? new Date();
  const today = formatIndianaDate(now);
  const todayDate = parseIsoDate(today);
  if (!todayDate) {
    return {
      ok: false,
      error: sanitizedError(
        "invalid_date_range",
        "Could not resolve today's date.",
        "unavailable",
      ),
    };
  }

  const rawPreset = (input.preset ?? "last_7d").trim() || "last_7d";
  if (!isMetaAdsDatePreset(rawPreset)) {
    return {
      ok: false,
      error: sanitizedError(
        "invalid_date_range",
        "Unsupported date preset.",
        "unavailable",
      ),
    };
  }

  let since: string;
  let until: string;
  let label: string;

  if (rawPreset === "custom") {
    const s = (input.since ?? "").trim();
    const u = (input.until ?? "").trim();
    if (!parseIsoDate(s) || !parseIsoDate(u)) {
      return {
        ok: false,
        error: sanitizedError(
          "invalid_date_range",
          "Custom ranges require valid since and until dates (YYYY-MM-DD).",
          "unavailable",
        ),
      };
    }
    if (s > u) {
      return {
        ok: false,
        error: sanitizedError(
          "invalid_date_range",
          "The start date must be on or before the end date.",
          "unavailable",
        ),
      };
    }
    if (u > today) {
      return {
        ok: false,
        error: sanitizedError(
          "invalid_date_range",
          "The end date cannot be in the future (Indiana local date).",
          "unavailable",
        ),
      };
    }
    since = s;
    until = u;
    label = `${since} → ${until}`;
  } else if (rawPreset === "today") {
    since = today;
    until = today;
    label = "Today";
  } else if (rawPreset === "maximum") {
    // Meta "maximum" is up to ~37 months; we request via date_preset=maximum.
    // Keep a label window for UI; comparison uses a fixed prior 30-day band.
    since = formatUtcDate(addUtcDays(todayDate, -36 * 30));
    until = today;
    label = "Lifetime (Meta maximum)";
  } else {
    const lookback =
      rawPreset === "last_7d" ? 6 : rawPreset === "last_14d" ? 13 : 29;
    since = formatUtcDate(addUtcDays(todayDate, -lookback));
    until = today;
    label =
      rawPreset === "last_7d"
        ? "Last 7 days"
        : rawPreset === "last_14d"
          ? "Last 14 days"
          : "Last 30 days";
  }

  const dayCount = inclusiveDayCount(since, until);
  if (dayCount < 1) {
    return {
      ok: false,
      error: sanitizedError(
        "invalid_date_range",
        "Date ranges must include at least one day.",
        "unavailable",
      ),
    };
  }
  if (rawPreset !== "maximum" && dayCount > META_ADS_MAX_RANGE_DAYS) {
    return {
      ok: false,
      error: sanitizedError(
        "invalid_date_range",
        `Date ranges must be between 1 and ${META_ADS_MAX_RANGE_DAYS} days.`,
        "unavailable",
      ),
    };
  }

  const comparisonDayCount =
    rawPreset === "maximum" ? 30 : dayCount;
  const sinceDate = parseIsoDate(since)!;
  const comparisonUntil = formatUtcDate(addUtcDays(sinceDate, -1));
  const comparisonSince = formatUtcDate(
    addUtcDays(parseIsoDate(comparisonUntil)!, -(comparisonDayCount - 1)),
  );

  return {
    ok: true,
    range: {
      preset: rawPreset,
      since,
      until,
      comparisonSince,
      comparisonUntil,
      label,
      dayCount,
    },
  };
}

/** Meta Insights date_preset when not using custom time_range. */
export function toMetaDatePresetParam(
  preset: MetaAdsDatePreset,
): string | null {
  if (preset === "custom") return null;
  if (preset === "today") return "today";
  if (preset === "last_7d") return "last_7d";
  if (preset === "last_14d") return "last_14d";
  if (preset === "last_30d") return "last_30d";
  if (preset === "maximum") return "maximum";
  return null;
}
