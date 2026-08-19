import { facilityAdminUtcBoundsForYmdRange } from "@/lib/admin/facility-admin-date";

import {
  listPrivateSlotDispositions,
  listPublicSaturdaySlotDispositions,
} from "./availability";
import type {
  FacilityPartyBookingBlock,
  FacilityPartyKind,
  FacilityRoomId,
  PrivateDurationMinutes,
} from "./types";
import { facilityDateAndMinutes } from "./zoned-time";

export const FACILITY_AVAILABILITY_BLOCKING_STATUSES = [
  "pending",
  "confirmed",
] as const;

export const FACILITY_AVAILABILITY_ROW_COLUMNS =
  "id, party_kind, room, start_time, end_time, status";

export type FacilityAvailabilityRow = {
  id: string;
  party_kind: string;
  room: string | null;
  start_time: string;
  end_time: string;
  status: string;
};

export type FacilitySlotQuery = {
  date: string;
  kind: FacilityPartyKind;
  roomId: FacilityRoomId;
  startMinutes: number;
  endMinutes: number;
};

function isFacilityPartyKind(value: string): value is FacilityPartyKind {
  return value === "public" || value === "private";
}

function isFacilityRoomId(value: string | null): value is FacilityRoomId {
  return value === "room-10" || value === "room-20";
}

export function facilityBookingBlocksAvailability(
  status: string | null | undefined,
): boolean {
  const normalized = status?.trim().toLowerCase();
  return (
    normalized === "pending" ||
    normalized === "confirmed"
  );
}

export function facilityPublicAvailabilityQuery(date: string): {
  table: "facility_bookings";
  columns: typeof FACILITY_AVAILABILITY_ROW_COLUMNS;
  statuses: typeof FACILITY_AVAILABILITY_BLOCKING_STATUSES;
  startInclusive: string;
  endExclusive: string;
} {
  const bounds = facilityAdminUtcBoundsForYmdRange({ from: date, to: date });
  return {
    table: "facility_bookings",
    columns: FACILITY_AVAILABILITY_ROW_COLUMNS,
    statuses: FACILITY_AVAILABILITY_BLOCKING_STATUSES,
    startInclusive: bounds.start,
    endExclusive: bounds.endExclusive,
  };
}

export function mapFacilityAvailabilityRowToBlock(
  booking: FacilityAvailabilityRow,
): FacilityPartyBookingBlock | null {
  if (
    !facilityBookingBlocksAvailability(booking.status) ||
    !isFacilityPartyKind(booking.party_kind)
  ) {
    return null;
  }

  const start = facilityDateAndMinutes(booking.start_time);
  const end = facilityDateAndMinutes(booking.end_time);
  if (!start || !end) {
    return null;
  }

  const status = booking.status.trim().toLowerCase();
  return {
    id: booking.id,
    kind: booking.party_kind,
    date: start.date,
    roomId: isFacilityRoomId(booking.room) ? booking.room : null,
    startMinutes: start.minutes,
    endMinutes: end.minutes,
    status: status === "pending" ? "pending" : "confirmed",
  };
}

export function toFacilityPartyBookingBlocks(
  rows: readonly FacilityAvailabilityRow[],
): FacilityPartyBookingBlock[] {
  return rows
    .map(mapFacilityAvailabilityRowToBlock)
    .filter((block): block is FacilityPartyBookingBlock => Boolean(block));
}

export function blocksExcludingId(
  blocks: readonly FacilityPartyBookingBlock[],
  excludeBookingId?: string,
): FacilityPartyBookingBlock[] {
  if (!excludeBookingId) return [...blocks];
  return blocks.filter((block) => block.id !== excludeBookingId);
}

function isPrivateDuration(
  value: number,
): value is PrivateDurationMinutes {
  return value === 90 || value === 120 || value === 180;
}

export function evaluateCustomerFacingFacilitySlot(input: {
  query: FacilitySlotQuery;
  blocks: readonly FacilityPartyBookingBlock[];
  excludeBookingId?: string;
}): { validTemplate: boolean; available: boolean } {
  const blocks = blocksExcludingId(input.blocks, input.excludeBookingId);
  const { query } = input;

  if (query.kind === "public") {
    const slots = listPublicSaturdaySlotDispositions(
      query.date,
      query.roomId,
      blocks,
    );
    const slot = slots.find(
      (candidate) =>
        candidate.startMinutes === query.startMinutes &&
        candidate.endMinutes === query.endMinutes,
    );
    return {
      validTemplate: Boolean(slot),
      available: slot?.available === true,
    };
  }

  const durationMinutes = query.endMinutes - query.startMinutes;
  if (!isPrivateDuration(durationMinutes)) {
    return { validTemplate: false, available: false };
  }

  const slots = listPrivateSlotDispositions(
    query.date,
    durationMinutes,
    blocks,
  );
  const slot = slots.find(
    (candidate) =>
      candidate.startMinutes === query.startMinutes &&
      candidate.endMinutes === query.endMinutes,
  );
  return {
    validTemplate: Boolean(slot),
    available: slot?.available === true,
  };
}
