import { FACILITY_TIME_ZONE } from "./zoned-time";

export const FACILITY_BOOKING_HORIZON_END_YMD = "2027-12-31";

export type FacilityBookingMonthDirection = "previous" | "next";

export function startOfFacilityBookingMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function facilityBookingHorizonEnd(): Date {
  return new Date(2027, 11, 31);
}

export function facilityTodayYmd(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FACILITY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isCanonicalFacilityBookingYmd(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1) {
    return false;
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

export function isFacilityBookingYmdWithinHorizon(
  value: unknown,
  now = new Date(),
): value is string {
  if (!isCanonicalFacilityBookingYmd(value)) {
    return false;
  }

  return (
    value >= facilityTodayYmd(now) &&
    value <= FACILITY_BOOKING_HORIZON_END_YMD
  );
}

export function isDateWithinFacilityBookingHorizon(
  date: Date,
  today = new Date(),
): boolean {
  const candidate = startOfLocalDay(date).getTime();
  const earliest = startOfLocalDay(today).getTime();
  const latest = facilityBookingHorizonEnd().getTime();

  return candidate >= earliest && candidate <= latest;
}

export function canNavigateFacilityBookingMonth(
  displayedMonth: Date,
  direction: FacilityBookingMonthDirection,
  today = new Date(),
): boolean {
  const currentMonth = startOfFacilityBookingMonth(today);
  const lastMonth = startOfFacilityBookingMonth(facilityBookingHorizonEnd());
  const offset = direction === "previous" ? -1 : 1;
  const destination = new Date(
    displayedMonth.getFullYear(),
    displayedMonth.getMonth() + offset,
    1,
  );

  return destination >= currentMonth && destination <= lastMonth;
}
