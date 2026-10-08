import { facilityAdminDay } from "./facility-admin-date";

/** Calendar arithmetic stays independent of server/browser timezone and DST. */
export function shiftCalendarDate(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function validCalendarDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function rentalWeekend(date?: string, now = new Date()) {
  const today = validCalendarDate(date) ? date : facilityAdminDay(now);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const from = shiftCalendarDate(today, weekday === 0 ? -2 : weekday === 6 ? -1 : (5 - weekday + 7) % 7);
  const to = shiftCalendarDate(from, 2);
  return { from, to, dates: [from, shiftCalendarDate(from, 1), to] };
}

export const WEEKEND_RENTAL_FILTERS = {
  rental: true, "foam-party": true, "public-party": false, "private-party": false,
};
