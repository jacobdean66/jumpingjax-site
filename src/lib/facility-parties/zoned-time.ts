export const FACILITY_TIME_ZONE = "America/New_York";

function partsInFacilityZone(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FACILITY_TIME_ZONE,
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

function offsetAt(value: Date): number {
  const p = partsInFacilityZone(value);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - value.getTime();
}

export function facilityLocalDateTimeToUtc(date: string, minutes: number): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match || !Number.isInteger(minutes) || minutes < 0 || minutes > 24 * 60) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const wallClockGuess = Date.UTC(year, month - 1, day, hour, minute);
  let value = new Date(wallClockGuess);
  value = new Date(wallClockGuess - offsetAt(value));
  value = new Date(wallClockGuess - offsetAt(value));

  const actual = partsInFacilityZone(value);
  const expectedDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    actual.year !== expectedDate.getUTCFullYear() ||
    actual.month !== expectedDate.getUTCMonth() + 1 ||
    actual.day !== expectedDate.getUTCDate() ||
    actual.hour !== expectedDate.getUTCHours() ||
    actual.minute !== expectedDate.getUTCMinutes()
  ) {
    return null;
  }
  return value;
}

export function facilityDateAndMinutes(value: string): {
  date: string;
  minutes: number;
} | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const p = partsInFacilityZone(parsed);
  return {
    date: `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`,
    minutes: p.hour * 60 + p.minute,
  };
}
