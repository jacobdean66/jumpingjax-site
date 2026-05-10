/**
 * Core types for the facility party booking system (foundational layer).
 */

/** Kid-capacity rooms for Saturday public parties */
export type FacilityRoomId = "room-10" | "room-20";

export type FacilityPartyKind = "public" | "private";

/** Request lifecycle — online submissions start as pending until staff confirms */
export type FacilityBookingStatus = "pending" | "confirmed" | "cancelled";

export interface FacilityRoom {
  id: FacilityRoomId;
  label: string;
  maxKids: number;
}

/** Fixed Saturday public window (90 minutes + implicit 30m buffer until next slot) */
export interface PublicSlotDefinition {
  id: string;
  startMinutes: number;
  endMinutes: number;
}

/** Allowed private durations (Sunday dynamic + Fri/Sat evening) */
export type PrivateDurationMinutes = 90 | 120;

/** Shape of an existing booking used for availability checks (mock/local for now) */
export interface FacilityPartyBookingBlock {
  id: string;
  kind: FacilityPartyKind;
  /** Local calendar date YYYY-MM-DD */
  date: string;
  /** Public: booked room. Private: larger party space (stored as 20-kid room id). */
  roomId: FacilityRoomId | null;
  startMinutes: number;
  endMinutes: number;
  status: FacilityBookingStatus;
}

/** Customer-submitted request (no payment; not persisted yet beyond demo state) */
export interface FacilityPartyBookingRequest {
  kind: FacilityPartyKind;
  date: string;
  roomId: FacilityRoomId | null;
  durationMinutes: number;
  startMinutes: number;
  endMinutes: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string;
  status: Extract<FacilityBookingStatus, "pending">;
}

export interface FacilityTimeSlotOption {
  startMinutes: number;
  endMinutes: number;
  label: string;
}

/** Slot row for UI grids (includes taken / out-of-range states) */
export interface FacilitySlotDisposition {
  startMinutes: number;
  endMinutes: number;
  label: string;
  available: boolean;
}
