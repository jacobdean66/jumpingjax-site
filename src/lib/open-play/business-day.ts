/**
 * Business-day helpers for Open Play reporting.
 * Timezone is fixed as America/New_York.
 * A business day is [local midnight, next local midnight).
 */

import { OPEN_PLAY_TIME_ZONE } from "./pricing";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function partsInZone(value: Date, timeZone: string = OPEN_PLAY_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function offsetAt(value: Date, timeZone: string = OPEN_PLAY_TIME_ZONE): number {
  const p = partsInZone(value, timeZone);
  return (
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) -
    value.getTime()
  );
}

/**
 * Convert a local America/New_York wall datetime to a UTC Date.
 * Rejects times that fall in the spring DST gap.
 */
export function nyLocalDateTimeToUtc(
  ymd: string,
  hour: number,
  minute = 0,
  second = 0,
): Date | null {
  if (!YMD_RE.test(ymd)) return null;
  if (
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59 ||
    !Number.isInteger(second) ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }
  const [year, month, day] = ymd.split("-").map(Number);
  const wallClockGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  let value = new Date(wallClockGuess);
  value = new Date(wallClockGuess - offsetAt(value));
  value = new Date(wallClockGuess - offsetAt(value));

  const actual = partsInZone(value);
  if (
    actual.year !== year ||
    actual.month !== month ||
    actual.day !== day ||
    actual.hour !== hour ||
    actual.minute !== minute ||
    actual.second !== second
  ) {
    return null;
  }
  return value;
}

export function businessDayYmdFromInstant(
  instant: Date | string | number,
): string {
  const value = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(value.getTime())) {
    throw new Error("Invalid timestamp for business day");
  }
  const p = partsInZone(value);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export type BusinessDayWindow = {
  businessDayYmd: string;
  startInclusive: Date;
  endExclusive: Date;
};

/**
 * Returns [local midnight, next local midnight) for the given YYYY-MM-DD
 * in America/New_York.
 */
export function businessDayWindow(ymd: string): BusinessDayWindow {
  if (!YMD_RE.test(ymd)) {
    throw new Error("business day must be YYYY-MM-DD");
  }
  const startInclusive = nyLocalDateTimeToUtc(ymd, 0, 0, 0);
  if (!startInclusive) {
    throw new Error(`Unable to resolve local midnight for ${ymd}`);
  }

  const [y, m, d] = ymd.split("-").map(Number);
  const nextUtc = new Date(Date.UTC(y, m - 1, d + 1));
  const nextYmd = `${nextUtc.getUTCFullYear()}-${String(nextUtc.getUTCMonth() + 1).padStart(2, "0")}-${String(nextUtc.getUTCDate()).padStart(2, "0")}`;
  const endExclusive = nyLocalDateTimeToUtc(nextYmd, 0, 0, 0);
  if (!endExclusive) {
    throw new Error(`Unable to resolve next local midnight after ${ymd}`);
  }

  return {
    businessDayYmd: ymd,
    startInclusive,
    endExclusive,
  };
}

export function isInstantInBusinessDay(
  instant: Date | string | number,
  ymd: string,
): boolean {
  const value = instant instanceof Date ? instant : new Date(instant);
  const window = businessDayWindow(ymd);
  return value >= window.startInclusive && value < window.endExclusive;
}
