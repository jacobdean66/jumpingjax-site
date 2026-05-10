import {
  FACILITY_PARTY_BUFFER_MINUTES,
  PRIVATE_FRIDAY_START_MINUTES,
  PRIVATE_SATURDAY_START_MINUTES,
  PUBLIC_SATURDAY_SLOTS,
  SUNDAY_EARLIEST_START_MINUTES,
  SUNDAY_LATEST_END_MINUTES,
  SUNDAY_SLOT_STEP_MINUTES,
} from "./constants";
import {
  formatMinutesLabel,
  isFriday,
  isSaturday,
  isSunday,
} from "./time";
import type {
  FacilityPartyBookingBlock,
  FacilityRoomId,
  FacilitySlotDisposition,
  FacilityTimeSlotOption,
  PrivateDurationMinutes,
} from "./types";

function isActiveBlock(b: FacilityPartyBookingBlock): boolean {
  return b.status !== "cancelled";
}

function privateIntervalsCollide(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
  bufferMinutes: number,
): boolean {
  return !(aEnd + bufferMinutes <= bStart || bEnd + bufferMinutes <= aStart);
}

function collidesWithAnyPrivate(
  date: string,
  start: number,
  end: number,
  bookings: FacilityPartyBookingBlock[],
): boolean {
  return bookings.some(
    (b) =>
      isActiveBlock(b) &&
      b.kind === "private" &&
      b.date === date &&
      privateIntervalsCollide(start, end, b.startMinutes, b.endMinutes, FACILITY_PARTY_BUFFER_MINUTES),
  );
}

/** Saturday daytime public slots for one room */
export function listAvailablePublicSaturdaySlots(
  date: string,
  roomId: FacilityRoomId,
  bookings: FacilityPartyBookingBlock[],
): FacilityTimeSlotOption[] {
  if (!isSaturday(date)) {
    return [];
  }

  const taken = new Set(
    bookings
      .filter(
        (b) =>
          isActiveBlock(b) &&
          b.kind === "public" &&
          b.date === date &&
          b.roomId === roomId,
      )
      .map((b) => `${b.startMinutes}-${b.endMinutes}`),
  );

  return PUBLIC_SATURDAY_SLOTS.filter(
    (slot) => !taken.has(`${slot.startMinutes}-${slot.endMinutes}`),
  ).map((slot) => ({
    startMinutes: slot.startMinutes,
    endMinutes: slot.endMinutes,
    label: `${formatMinutesLabel(slot.startMinutes)}–${formatMinutesLabel(slot.endMinutes)}`,
  }));
}

/** All Saturday public template slots with booked/unavailable flagged for the UI */
export function listPublicSaturdaySlotDispositions(
  date: string,
  roomId: FacilityRoomId,
  bookings: FacilityPartyBookingBlock[],
): FacilitySlotDisposition[] {
  if (!isSaturday(date)) {
    return [];
  }

  const openKeys = new Set(
    listAvailablePublicSaturdaySlots(date, roomId, bookings).map(
      (s) => `${s.startMinutes}-${s.endMinutes}`,
    ),
  );

  return PUBLIC_SATURDAY_SLOTS.map((slot) => {
    const key = `${slot.startMinutes}-${slot.endMinutes}`;
    return {
      startMinutes: slot.startMinutes,
      endMinutes: slot.endMinutes,
      label: `${formatMinutesLabel(slot.startMinutes)}–${formatMinutesLabel(slot.endMinutes)}`,
      available: openKeys.has(key),
    };
  });
}

function listFridayPrivateDispositions(
  date: string,
  durationMinutes: PrivateDurationMinutes,
  bookings: FacilityPartyBookingBlock[],
): FacilitySlotDisposition[] {
  return PRIVATE_FRIDAY_START_MINUTES.map((start) => {
    const end = start + durationMinutes;
    const outOfBounds = end > SUNDAY_LATEST_END_MINUTES;
    const available =
      !outOfBounds && !collidesWithAnyPrivate(date, start, end, bookings);
    return {
      startMinutes: start,
      endMinutes: end,
      label: `${formatMinutesLabel(start)}–${formatMinutesLabel(end)}`,
      available,
    };
  });
}

function listSaturdayPrivateDispositions(
  date: string,
  durationMinutes: PrivateDurationMinutes,
  bookings: FacilityPartyBookingBlock[],
): FacilitySlotDisposition[] {
  return PRIVATE_SATURDAY_START_MINUTES.map((start) => {
    const end = start + durationMinutes;
    const outOfBounds = end > SUNDAY_LATEST_END_MINUTES;
    const available =
      !outOfBounds && !collidesWithAnyPrivate(date, start, end, bookings);
    return {
      startMinutes: start,
      endMinutes: end,
      label: `${formatMinutesLabel(start)}–${formatMinutesLabel(end)}`,
      available,
    };
  });
}

function listSundayPrivateDispositions(
  date: string,
  durationMinutes: PrivateDurationMinutes,
  bookings: FacilityPartyBookingBlock[],
): FacilitySlotDisposition[] {
  const out: FacilitySlotDisposition[] = [];
  for (
    let start = SUNDAY_EARLIEST_START_MINUTES;
    start + durationMinutes <= SUNDAY_LATEST_END_MINUTES;
    start += SUNDAY_SLOT_STEP_MINUTES
  ) {
    const end = start + durationMinutes;
    const available = !collidesWithAnyPrivate(date, start, end, bookings);
    out.push({
      startMinutes: start,
      endMinutes: end,
      label: `${formatMinutesLabel(start)}–${formatMinutesLabel(end)}`,
      available,
    });
  }
  return out;
}

/** Private / buyout slots — includes booked rows so the UI can show disabled states */
export function listPrivateSlotDispositions(
  date: string,
  durationMinutes: PrivateDurationMinutes,
  bookings: FacilityPartyBookingBlock[],
): FacilitySlotDisposition[] {
  if (isFriday(date)) {
    return listFridayPrivateDispositions(date, durationMinutes, bookings);
  }
  if (isSaturday(date)) {
    return listSaturdayPrivateDispositions(date, durationMinutes, bookings);
  }
  if (isSunday(date)) {
    return listSundayPrivateDispositions(date, durationMinutes, bookings);
  }
  return [];
}

function listFridayPrivateSlots(
  date: string,
  durationMinutes: PrivateDurationMinutes,
  bookings: FacilityPartyBookingBlock[],
): FacilityTimeSlotOption[] {
  const options: FacilityTimeSlotOption[] = [];
  for (const start of PRIVATE_FRIDAY_START_MINUTES) {
    const end = start + durationMinutes;
    if (end > SUNDAY_LATEST_END_MINUTES) {
      continue;
    }
    if (!collidesWithAnyPrivate(date, start, end, bookings)) {
      options.push({
        startMinutes: start,
        endMinutes: end,
        label: `${formatMinutesLabel(start)}–${formatMinutesLabel(end)}`,
      });
    }
  }
  return options;
}

function listSaturdayPrivateSlots(
  date: string,
  durationMinutes: PrivateDurationMinutes,
  bookings: FacilityPartyBookingBlock[],
): FacilityTimeSlotOption[] {
  const options: FacilityTimeSlotOption[] = [];
  for (const start of PRIVATE_SATURDAY_START_MINUTES) {
    const end = start + durationMinutes;
    if (end > SUNDAY_LATEST_END_MINUTES) {
      continue;
    }
    if (!collidesWithAnyPrivate(date, start, end, bookings)) {
      options.push({
        startMinutes: start,
        endMinutes: end,
        label: `${formatMinutesLabel(start)}–${formatMinutesLabel(end)}`,
      });
    }
  }
  return options;
}

function listSundayPrivateSlots(
  date: string,
  durationMinutes: PrivateDurationMinutes,
  bookings: FacilityPartyBookingBlock[],
): FacilityTimeSlotOption[] {
  const options: FacilityTimeSlotOption[] = [];
  for (
    let start = SUNDAY_EARLIEST_START_MINUTES;
    start + durationMinutes <= SUNDAY_LATEST_END_MINUTES;
    start += SUNDAY_SLOT_STEP_MINUTES
  ) {
    const end = start + durationMinutes;
    if (!collidesWithAnyPrivate(date, start, end, bookings)) {
      options.push({
        startMinutes: start,
        endMinutes: end,
        label: `${formatMinutesLabel(start)}–${formatMinutesLabel(end)}`,
      });
    }
  }
  return options;
}

/** Whole-facility private evening (Fri/Sat) or dynamic Sunday */
export function listAvailablePrivateSlots(
  date: string,
  durationMinutes: PrivateDurationMinutes,
  bookings: FacilityPartyBookingBlock[],
): FacilityTimeSlotOption[] {
  if (isFriday(date)) {
    return listFridayPrivateSlots(date, durationMinutes, bookings);
  }
  if (isSaturday(date)) {
    return listSaturdayPrivateSlots(date, durationMinutes, bookings);
  }
  if (isSunday(date)) {
    return listSundayPrivateSlots(date, durationMinutes, bookings);
  }
  return [];
}
