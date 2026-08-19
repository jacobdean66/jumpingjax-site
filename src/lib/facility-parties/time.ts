/**
 * Local-date helpers — avoid UTC surprises from `Date.parse('YYYY-MM-DD')`.
 */

export function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map((part) => Number(part));
  if (!y || !m || !d) {
    throw new Error(`Invalid date string: ${isoDate}`);
  }
  return new Date(y, m - 1, d);
}

export function getLocalDayOfWeek(isoDate: string): number {
  return parseLocalDate(isoDate).getDay();
}

/** 0 Sun … 6 Sat */
export function isFriday(isoDate: string): boolean {
  return getLocalDayOfWeek(isoDate) === 5;
}

export function isSaturday(isoDate: string): boolean {
  return getLocalDayOfWeek(isoDate) === 6;
}

export function isSunday(isoDate: string): boolean {
  return getLocalDayOfWeek(isoDate) === 0;
}

export function formatMinutesLabel(totalMinutes: number): string {
  const h24 = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const hour12 = ((h24 + 11) % 12) + 1;
  const ampm = h24 < 12 ? "AM" : "PM";
  return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function minutesToClockTime(totalMinutes: number): string {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function clockTimeToMinutes(value: string): number | null {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.trim())) return null;
  const [hour, minute] = value.trim().split(":").map(Number);
  return hour * 60 + minute;
}

export function formatFacilityReadableTime(
  startMinutes: number,
  endMinutes: number,
): string {
  return `${formatMinutesLabel(startMinutes)} - ${formatMinutesLabel(endMinutes)}`;
}
