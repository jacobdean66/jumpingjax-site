import type {
  FacilityRoom,
  FacilityRoomId,
  PrivateDurationMinutes,
  PublicSlotDefinition,
} from "./types";

export const FACILITY_PARTY_BUFFER_MINUTES = 30;

/** Private / buyout requests always use the larger party space (20-kid room). */
export const PRIVATE_PARTY_ROOM_ID: FacilityRoomId = "room-20";

export const FACILITY_ROOMS: FacilityRoom[] = [
  { id: "room-10", label: "10-kid room", maxKids: 10 },
  { id: "room-20", label: "20-kid room", maxKids: 20 },
];

/** Saturday public: fixed 90-minute blocks */
export const PUBLIC_SATURDAY_SLOTS: PublicSlotDefinition[] = [
  { id: "sat-1000-1130", startMinutes: 10 * 60, endMinutes: 11 * 60 + 30 },
  { id: "sat-1200-1330", startMinutes: 12 * 60, endMinutes: 13 * 60 + 30 },
  { id: "sat-1400-1530", startMinutes: 14 * 60, endMinutes: 15 * 60 + 30 },
  { id: "sat-1600-1730", startMinutes: 16 * 60, endMinutes: 17 * 60 + 30 },
];

/** Friday private evening start times (minutes from midnight) */
export const PRIVATE_FRIDAY_START_MINUTES = [18 * 60, 18 * 60 + 30] as const;

/** Saturday private: single start */
export const PRIVATE_SATURDAY_START_MINUTES = [18 * 60 + 30] as const;

/** Sunday private: dynamic scheduling bounds */
export const SUNDAY_EARLIEST_START_MINUTES = 10 * 60;
export const SUNDAY_LATEST_END_MINUTES = 21 * 60;

/** Step when generating Sunday start options */
export const SUNDAY_SLOT_STEP_MINUTES = 30;

export const PRIVATE_DURATION_OPTIONS: {
  minutes: PrivateDurationMinutes;
  label: string;
}[] = [
  { minutes: 90, label: "1.5 hours" },
  { minutes: 120, label: "2 hours" },
  { minutes: 180, label: "3 hours" },
];

// OPEN HOURS
export const FACILITY_HOURS = {
  monday: null, // closed (private only)
  tuesday: null, // closed (private only)
  wednesday: { open: "12:00", close: "17:00" },
  thursday: { open: "12:00", close: "17:00" },
  friday: { open: "12:00", close: "18:00" },
  saturday: { open: "10:00", close: "18:00" },
  sunday: null, // public closed, private handled separately
};

// SLOT RULES
export const PUBLIC_SLOT_MINUTES = 90;
export const PRIVATE_SLOT_OPTIONS = [90, 120, 180];
export const SLOT_INTERVAL_MINUTES = 30;

// PRIVATE TIME RULES
export const PRIVATE_AFTER_CLOSE_BUFFER = 30;
export const PRIVATE_BEFORE_OPEN_BUFFER = 30;
export const SUNDAY_PRIVATE_START = "10:30";
export const PRIVATE_LATE_END = "24:00"; // midnight cap
export const PRIVATE_START_AFTER_CLOSE_MINUTES = 30;

// ROOMS
export const PUBLIC_ROOMS = [
  { id: "room-10", capacity: 10 },
  { id: "room-20", capacity: 20 },
];

export const PRIVATE_ROOM = {
  id: "room-20",
  capacity: 20,
};
