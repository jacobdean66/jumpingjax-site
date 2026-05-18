import {
  FACILITY_HOURS,
  SLOT_INTERVAL_MINUTES,
} from "./constants";
import {
  formatMinutesLabel,
  getLocalDayOfWeek,
} from "./time";
import type {
  FacilityPartyBookingBlock,
  FacilityRoomId,
  FacilitySlotDisposition,
  FacilityTimeSlotOption,
  PrivateDurationMinutes,
  PublicSlotDefinition,
} from "./types";

function isActiveBlock(b: FacilityPartyBookingBlock): boolean {
  return b.status !== "cancelled";
}

function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function collidesWithAnyFacilityBooking(
  date: string,
  start: number,
  end: number,
  bookings: FacilityPartyBookingBlock[],
): boolean {
  return bookings.some(
    (b) =>
      isActiveBlock(b) &&
      b.date === date &&
      intervalsOverlap(start, end, b.startMinutes, b.endMinutes),
  );
}

function listPublicSlotsForDate(date: string): PublicSlotDefinition[] {
  const [year, month, dayNum] = date.split("-").map(Number);

  // Create LOCAL date (not UTC)
  const localDate = new Date(year, month - 1, dayNum);

  const day = localDate.getDay();

  console.log("DATE:", date, "DAY:", day);

  let openMinutes = null;
  let closeMinutes = null;

  if (day === 3 || day === 4) {
    // Wednesday & Thursday
    openMinutes = 12 * 60;
    closeMinutes = 17 * 60;
  } else if (day === 5) {
    // Friday (FIXED)
    openMinutes = 12 * 60;
    closeMinutes = 18 * 60;
  } else if (day === 6) {
    // Saturday
    openMinutes = 10 * 60;
    closeMinutes = 18 * 60;
  } else {
    return [];
  }

  const slots: PublicSlotDefinition[] = [];

  let start = openMinutes + 30;

  while (true) {
    const end = start + 90;

    // must fully fit before closing
    if (end > closeMinutes) break;

    slots.push({
      id: `public-${start}-${end}`,
      startMinutes: start,
      endMinutes: end,
    });

    // move forward by full cycle (90 + 30 break)
    start += 120;
  }

  console.log("RAW SLOTS:", slots);
  console.log("FINAL SLOTS:", slots);

  return slots;
}

/** Public daytime slots for one room */
export function listAvailablePublicSaturdaySlots(
  date: string,
  roomId: FacilityRoomId,
  bookings: FacilityPartyBookingBlock[],
): FacilityTimeSlotOption[] {
  const publicSlots = listPublicSlotsForDate(date);
  if (publicSlots.length === 0) {
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

  return publicSlots.filter(
    (slot) => !taken.has(`${slot.startMinutes}-${slot.endMinutes}`),
  ).map((slot) => ({
    startMinutes: slot.startMinutes,
    endMinutes: slot.endMinutes,
    label: `${formatMinutesLabel(slot.startMinutes)}–${formatMinutesLabel(slot.endMinutes)}`,
  }));
}

/** All public template slots with booked/unavailable flagged for the UI */
export function listPublicSaturdaySlotDispositions(
  date: string,
  roomId: FacilityRoomId,
  bookings: FacilityPartyBookingBlock[],
): FacilitySlotDisposition[] {
  const publicSlots = listPublicSlotsForDate(date);
  if (publicSlots.length === 0) {
    return [];
  }

  const openKeys = new Set(
    listAvailablePublicSaturdaySlots(date, roomId, bookings).map(
      (s) => `${s.startMinutes}-${s.endMinutes}`,
    ),
  );

  return publicSlots.map((slot) => {
    const key = `${slot.startMinutes}-${slot.endMinutes}`;
    return {
      startMinutes: slot.startMinutes,
      endMinutes: slot.endMinutes,
      label: `${formatMinutesLabel(slot.startMinutes)}–${formatMinutesLabel(slot.endMinutes)}`,
      available: openKeys.has(key),
    };
  });
}

/** Private / buyout slots — includes booked rows so the UI can show disabled states */
function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function getPrivateAvailabilityWindow(date: string) {
  const day = getLocalDayOfWeek(date);

  if (day === 0) {
    return {
      day,
      startWindow: timeToMinutes("10:30"),
      endWindow: timeToMinutes("24:00"),
    };
  }

  if (day === 1 || day === 2) {
    return {
      day,
      startWindow: timeToMinutes("00:00"),
      endWindow: timeToMinutes("23:59"),
    };
  }

  const hoursByDay = {
    3: FACILITY_HOURS.wednesday,
    4: FACILITY_HOURS.thursday,
    5: FACILITY_HOURS.friday,
    6: FACILITY_HOURS.saturday,
  } as const;
  const hours = hoursByDay[day as keyof typeof hoursByDay];

  if (!hours) {
    return null;
  }

  return {
    day,
    startWindow: timeToMinutes(hours.close),
    endWindow: timeToMinutes("24:00"),
  };
}

export function listPrivateSlotDispositions(
  date: string,
  duration: PrivateDurationMinutes,
  blocks: FacilityPartyBookingBlock[],
): FacilitySlotDisposition[] {
  const window = getPrivateAvailabilityWindow(date);

  if (!window) {
    return [];
  }

  const { day, startWindow, endWindow } = window;
  console.log("PRIVATE DAY:", day);
  console.log("PRIVATE WINDOW:", startWindow, endWindow);

  const slots: FacilitySlotDisposition[] = [];

  for (
    let start = startWindow;
    start + duration <= endWindow;
    start += SLOT_INTERVAL_MINUTES
  ) {
    const end = start + duration;
    const startTime = formatTime(start);
    const endTime = formatTime(end);

    console.log("TEST SLOT:", startTime, "→", endTime);

    slots.push({
      startMinutes: start,
      endMinutes: end,
      available: !collidesWithAnyFacilityBooking(date, start, end, blocks),
      label: `${startTime}–${endTime}`,
    });
  }

  return slots;
}

function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

/** Whole-facility private availability */
export function listAvailablePrivateSlots(
  date: string,
  durationMinutes: PrivateDurationMinutes,
  bookings: FacilityPartyBookingBlock[],
): FacilityTimeSlotOption[] {
  return listPrivateSlotDispositions(date, durationMinutes, bookings)
    .filter((slot) => slot.available)
    .map(({ startMinutes, endMinutes, label }) => ({
      startMinutes,
      endMinutes,
      label,
    }));
}
