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
];
