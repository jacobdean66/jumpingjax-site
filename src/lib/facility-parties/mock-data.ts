import type { FacilityPartyBookingBlock } from "./types";

/**
 * Seed data for local availability demos. Replace with API/DB later.
 * Intentionally sparse — add rows here to watch slots disappear in the UI.
 */
export const MOCK_FACILITY_PARTY_BOOKINGS: FacilityPartyBookingBlock[] = [
  {
    id: "mock-public-1",
    kind: "public",
    date: "2026-05-16",
    roomId: "room-10",
    startMinutes: 10 * 60,
    endMinutes: 11 * 60 + 30,
    status: "confirmed",
  },
  {
    id: "mock-private-1",
    kind: "private",
    date: "2026-05-15",
    roomId: "room-20",
    startMinutes: 18 * 60,
    endMinutes: 18 * 60 + 90,
    status: "pending",
  },
];
