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
