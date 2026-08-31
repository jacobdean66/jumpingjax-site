import { FOAM_PARTY_RENTAL_ITEM } from "@/lib/rentals/rental-pricing-text";
import { facilityDateAndMinutes } from "@/lib/facility-parties/zoned-time";

import type { CalendarBlock } from "./composite-booking";

export type ActiveRentalAvailabilityRow = {
  event_date: string;
  span_days: number | null;
  rental_item: string;
  booking_rental_items?: Array<{ rental_item: string }> | null;
};

export type ActiveFacilityAvailabilityRow = {
  start_time: string;
  end_time: string;
};

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

function rentalBlocks(rows: ActiveRentalAvailabilityRow[]) {
  return rows.flatMap((row) => {
    const itemRefs = new Set([
      row.rental_item,
      ...(row.booking_rental_items ?? []).map(({ rental_item }) => rental_item),
    ].filter(Boolean));
    const resources = [...itemRefs].flatMap((itemRef) => (
      itemRef === FOAM_PARTY_RENTAL_ITEM
        ? [`rental:${itemRef}`, "crew:foam"]
        : [`rental:${itemRef}`]
    ));
    const spanDays = Math.min(Math.max(row.span_days ?? 1, 1), 14);
    return Array.from({ length: spanDays }, (_, offset) => addDays(row.event_date, offset))
      .flatMap((date) => resources.map((resourceRef) => ({
        resourceRef,
        date,
        startMinutes: 0,
        endMinutes: 1440,
      })));
  });
}

function facilityBlocks(rows: ActiveFacilityAvailabilityRow[]) {
  return rows.flatMap((row) => {
    const start = facilityDateAndMinutes(row.start_time);
    const end = facilityDateAndMinutes(row.end_time);
    if (!start || !end) return [];
    if (start.date === end.date) {
      return [{
        resourceRef: "facility:main",
        date: start.date,
        startMinutes: Math.max(0, start.minutes - 30),
        endMinutes: Math.min(1440, end.minutes + 30),
      }];
    }
    return [
      {
        resourceRef: "facility:main",
        date: start.date,
        startMinutes: Math.max(0, start.minutes - 30),
        endMinutes: 1440,
      },
      {
        resourceRef: "facility:main",
        date: end.date,
        startMinutes: 0,
        endMinutes: Math.min(1440, end.minutes + 30),
      },
    ];
  });
}

export function buildLiveCompositeAvailabilityBlocks(input: {
  rentals: ActiveRentalAvailabilityRow[];
  facilities: ActiveFacilityAvailabilityRow[];
}): CalendarBlock[] {
  const blocks = [...rentalBlocks(input.rentals), ...facilityBlocks(input.facilities)];
  return [...new Map(blocks.map((block) => [
    `${block.resourceRef}:${block.date}:${block.startMinutes}:${block.endMinutes}`,
    block,
  ])).values()];
}

