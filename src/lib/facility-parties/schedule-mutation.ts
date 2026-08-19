import { facilityBookingIsEditable } from "@/lib/admin/booking-edit";
import { isFacilityBookingYmdWithinHorizon } from "./booking-horizon";
import {
  evaluateCustomerFacingFacilitySlot,
  facilityBookingBlocksAvailability,
  toFacilityPartyBookingBlocks,
  type FacilityAvailabilityRow,
  type FacilitySlotQuery,
} from "./availability-source";
import {
  formatFacilityReadableTime,
} from "./time";
import type {
  FacilityPartyKind,
  FacilityRoomId,
} from "./types";
import {
  facilityDateAndMinutes,
  facilityLocalDateTimeToUtc,
} from "./zoned-time";

export type FacilityScheduleSnapshot = {
  id: string;
  status: string;
  kind: FacilityPartyKind;
  roomId: FacilityRoomId;
  date: string;
  startMinutes: number;
  endMinutes: number;
};

export type FacilityReleasedSlot = FacilitySlotQuery & {
  bookingId: string;
};

export function facilityBookingIsUpcoming(
  startTimeIso: string,
  now = new Date(),
): boolean {
  const start = Date.parse(startTimeIso);
  if (!Number.isFinite(start)) return false;
  return start > now.getTime();
}

export function facilityBookingCanMutate(input: {
  status: string | null | undefined;
  startTimeIso: string;
  now?: Date;
}): boolean {
  return (
    facilityBookingIsEditable(input.status) &&
    facilityBookingIsUpcoming(input.startTimeIso, input.now)
  );
}

export function wallClockFromFacilityTimes(
  startTimeIso: string,
  endTimeIso: string,
): {
  date: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
} | null {
  const start = facilityDateAndMinutes(startTimeIso);
  const end = facilityDateAndMinutes(endTimeIso);
  if (!start || !end) return null;

  const utcDurationMinutes = Math.round(
    (Date.parse(endTimeIso) - Date.parse(startTimeIso)) / 60000,
  );
  const sameDayDuration = end.minutes - start.minutes;
  const durationMinutes =
    start.date === end.date && sameDayDuration > 0
      ? sameDayDuration
      : utcDurationMinutes;

  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    return null;
  }

  return {
    date: start.date,
    startMinutes: start.minutes,
    endMinutes: start.minutes + durationMinutes,
    durationMinutes,
  };
}

export type FacilityReschedulePlan =
  | { ok: true; slotChanged: false }
  | {
      ok: true;
      slotChanged: true;
      startTimeIso: string;
      endTimeIso: string;
      readableDate: string;
      readableTime: string;
      durationMinutes: number;
      query: FacilitySlotQuery;
    }
  | {
      ok: false;
      code:
        | "not_editable"
        | "past_date"
        | "invalid_slot"
        | "dst_invalid"
        | "conflict";
      message: string;
    };

export function planFacilityReschedule(input: {
  current: FacilityScheduleSnapshot;
  requestedDate: string;
  requestedStartMinutes: number;
  rows: readonly FacilityAvailabilityRow[];
  now?: Date;
}): FacilityReschedulePlan {
  if (!facilityBookingIsEditable(input.current.status)) {
    return {
      ok: false,
      code: "not_editable",
      message: "Only pending or confirmed facility parties can be edited.",
    };
  }

  const durationMinutes =
    input.current.endMinutes - input.current.startMinutes;
  if (durationMinutes <= 0) {
    return {
      ok: false,
      code: "invalid_slot",
      message: "This party does not have a valid booking window.",
    };
  }

  if (
    input.requestedDate === input.current.date &&
    input.requestedStartMinutes === input.current.startMinutes
  ) {
    return { ok: true, slotChanged: false };
  }

  if (!isFacilityBookingYmdWithinHorizon(input.requestedDate, input.now)) {
    return {
      ok: false,
      code: "past_date",
      message:
        "The new party date must be today or later, and no later than December 31, 2027.",
    };
  }

  const requestedEndMinutes = input.requestedStartMinutes + durationMinutes;
  const startDate = facilityLocalDateTimeToUtc(
    input.requestedDate,
    input.requestedStartMinutes,
  );
  const endDate = facilityLocalDateTimeToUtc(
    input.requestedDate,
    requestedEndMinutes,
  );
  if (!startDate || !endDate || startDate >= endDate) {
    return {
      ok: false,
      code: "dst_invalid",
      message:
        "That date and time is not a valid America/New_York booking window.",
    };
  }

  const query: FacilitySlotQuery = {
    date: input.requestedDate,
    kind: input.current.kind,
    roomId: input.current.roomId,
    startMinutes: input.requestedStartMinutes,
    endMinutes: requestedEndMinutes,
  };
  const blocks = toFacilityPartyBookingBlocks(input.rows);
  const evaluation = evaluateCustomerFacingFacilitySlot({
    query,
    blocks,
    excludeBookingId: input.current.id,
  });

  if (!evaluation.validTemplate) {
    return {
      ok: false,
      code: "invalid_slot",
      message:
        input.current.kind === "public"
          ? "That time is not a valid public party slot for the selected date."
          : "That time is not a valid private party slot for the selected date.",
    };
  }

  if (!evaluation.available) {
    return {
      ok: false,
      code: "conflict",
      message: "That date and time is already held by another active booking.",
    };
  }

  return {
    ok: true,
    slotChanged: true,
    startTimeIso: startDate.toISOString(),
    endTimeIso: endDate.toISOString(),
    readableDate: input.requestedDate,
    readableTime: formatFacilityReadableTime(
      input.requestedStartMinutes,
      requestedEndMinutes,
    ),
    durationMinutes,
    query,
  };
}

export type FacilitySlotVerification =
  | { ok: true; available: true }
  | {
      ok: true;
      available: false;
      occupiedByOtherIds: string[];
    }
  | {
      ok: false;
      code: "still_held_by_booking" | "verification_failed";
      message: string;
    };

function occupyingOtherIds(
  query: FacilitySlotQuery,
  rows: readonly FacilityAvailabilityRow[],
  excludeBookingId: string,
): string[] {
  const blocks = toFacilityPartyBookingBlocks(rows).filter(
    (block) => block.id !== excludeBookingId,
  );
  return blocks
    .filter((block) => {
      const evaluation = evaluateCustomerFacingFacilitySlot({
        query,
        blocks: [block],
      });
      return evaluation.validTemplate && !evaluation.available;
    })
    .map((block) => block.id);
}

function bookingStillAtExactSlot(
  query: FacilitySlotQuery,
  block: ReturnType<typeof toFacilityPartyBookingBlocks>[number],
): boolean {
  return (
    facilityBookingBlocksAvailability(block.status) &&
    block.date === query.date &&
    block.startMinutes === query.startMinutes &&
    block.endMinutes === query.endMinutes
  );
}

export function verifyReleasedFacilitySlot(input: {
  released: FacilityReleasedSlot;
  rows: readonly FacilityAvailabilityRow[];
}): FacilitySlotVerification {
  const blocks = toFacilityPartyBookingBlocks(input.rows);
  const selfBlock = blocks.find(
    (block) => block.id === input.released.bookingId,
  );
  if (selfBlock && bookingStillAtExactSlot(input.released, selfBlock)) {
    return {
      ok: false,
      code: "still_held_by_booking",
      message:
        "The booking still blocks that date and time after the update. No success was recorded.",
    };
  }

  const evaluation = evaluateCustomerFacingFacilitySlot({
    query: input.released,
    blocks,
  });

  if (evaluation.available) {
    return { ok: true, available: true };
  }

  const occupiedByOtherIds = occupyingOtherIds(
    input.released,
    input.rows,
    input.released.bookingId,
  );
  if (occupiedByOtherIds.length > 0) {
    return { ok: true, available: false, occupiedByOtherIds };
  }

  if (
    selfBlock &&
    !evaluateCustomerFacingFacilitySlot({
      query: input.released,
      blocks: [selfBlock],
    }).available
  ) {
    return { ok: true, available: false, occupiedByOtherIds: [] };
  }

  return {
    ok: false,
    code: "verification_failed",
    message:
      "The released date and time could not be verified as available. No success was recorded.",
  };
}

export function verifyReservedFacilitySlot(input: {
  reserved: FacilityReleasedSlot;
  rows: readonly FacilityAvailabilityRow[];
}): FacilitySlotVerification {
  const selfBlock = toFacilityPartyBookingBlocks(input.rows).find(
    (block) => block.id === input.reserved.bookingId,
  );
  if (!selfBlock) {
    return {
      ok: false,
      code: "verification_failed",
      message:
        "The new date and time is not reserved by this booking. No success was recorded.",
    };
  }

  const evaluation = evaluateCustomerFacingFacilitySlot({
    query: input.reserved,
    blocks: toFacilityPartyBookingBlocks(input.rows),
  });
  if (evaluation.available) {
    return {
      ok: false,
      code: "verification_failed",
      message:
        "The new date and time is still showing as available to customers. No success was recorded.",
    };
  }

  const occupiedByOtherIds = occupyingOtherIds(
    input.reserved,
    input.rows,
    input.reserved.bookingId,
  );
  const selfOccupies = !evaluateCustomerFacingFacilitySlot({
    query: input.reserved,
    blocks: [selfBlock],
  }).available;

  if (!selfOccupies) {
    return {
      ok: false,
      code: "verification_failed",
      message:
        "The edited booking is not occupying the new date and time. No success was recorded.",
    };
  }

  return occupiedByOtherIds.length > 0
    ? { ok: true, available: false, occupiedByOtherIds }
    : { ok: true, available: false, occupiedByOtherIds: [] };
}

export function verifyFacilityReschedule(input: {
  bookingId: string;
  previous: FacilitySlotQuery;
  next: FacilitySlotQuery;
  previousDateRows: readonly FacilityAvailabilityRow[];
  nextDateRows: readonly FacilityAvailabilityRow[];
}): { ok: true; previousAvailable: boolean } | { ok: false; message: string } {
  const released = verifyReleasedFacilitySlot({
    released: { ...input.previous, bookingId: input.bookingId },
    rows: input.previousDateRows,
  });
  if (!released.ok) {
    return { ok: false, message: released.message };
  }

  const reserved = verifyReservedFacilitySlot({
    reserved: { ...input.next, bookingId: input.bookingId },
    rows: input.nextDateRows,
  });
  if (!reserved.ok) {
    return { ok: false, message: reserved.message };
  }
  if (reserved.available) {
    return {
      ok: false,
      message:
        "The new date and time is still showing as available to customers. No success was recorded.",
    };
  }

  return { ok: true, previousAvailable: released.available };
}

export function verifyFacilityCancellation(input: {
  bookingId: string;
  released: FacilitySlotQuery;
  rows: readonly FacilityAvailabilityRow[];
}): { ok: true } | { ok: false; message: string } {
  const released = verifyReleasedFacilitySlot({
    released: { ...input.released, bookingId: input.bookingId },
    rows: input.rows,
  });
  if (!released.ok) {
    return { ok: false, message: released.message };
  }
  return { ok: true };
}

export function isMissingFacilityScheduleRpcError(error: {
  message?: string | null;
  code?: string | null;
} | null): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("reschedule_facility_booking_atomic") ||
    message.includes("cancel_facility_booking_atomic") ||
    error.code === "PGRST202"
  );
}
