import { parseYMD, toYMD } from "@/lib/mockBooking";
import { startOfDay } from "@/lib/bookings/unavailableDates";

/**
 * Inclusive latest customer-selectable booking date for rentals and facility parties.
 * Keep this as the single source of truth for the public booking horizon.
 */
export const BOOKING_HORIZON_END_YMD = "2027-12-31" as const;

export function getBookingHorizonEndDate(): Date {
  return startOfDay(parseYMD(BOOKING_HORIZON_END_YMD));
}

/** First day of the last month customers can open in booking calendars. */
export function bookingHorizonMaxMonthCursor(): Date {
  const end = getBookingHorizonEndDate();
  return new Date(end.getFullYear(), end.getMonth(), 1);
}

export function isYmdWithinBookingHorizon(ymd: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) && ymd <= BOOKING_HORIZON_END_YMD;
}

export function isDateWithinBookingHorizon(date: Date): boolean {
  return isYmdWithinBookingHorizon(toYMD(date));
}

/** Whether a calendar month is within [current month, horizon end month]. */
export function canNavigateBookingMonth(
  year: number,
  monthIndex: number,
  now: Date = new Date(),
): boolean {
  const cursor = new Date(year, monthIndex, 1);
  const minCursor = new Date(now.getFullYear(), now.getMonth(), 1);
  const maxCursor = bookingHorizonMaxMonthCursor();
  return cursor >= minCursor && cursor <= maxCursor;
}

/** Inclusive availability window from local today through the booking horizon end. */
export function bookingHorizonAvailabilityWindow(
  now: Date = new Date(),
): { winStart: Date; winEnd: Date } {
  return {
    winStart: startOfDay(now),
    winEnd: getBookingHorizonEndDate(),
  };
}

/**
 * months_ahead value that covers today through the horizon end for APIs that
 * still accept a rolling month count (clamped to the unavailable-dates max of 36).
 */
export function bookingHorizonMonthsAhead(now: Date = new Date()): number {
  const { winStart, winEnd } = bookingHorizonAvailabilityWindow(now);
  if (winEnd < winStart) return 1;
  const months =
    (winEnd.getFullYear() - winStart.getFullYear()) * 12 +
    (winEnd.getMonth() - winStart.getMonth()) +
    1;
  return Math.min(36, Math.max(1, months));
}
