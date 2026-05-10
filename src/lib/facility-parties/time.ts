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
