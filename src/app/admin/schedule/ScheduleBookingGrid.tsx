"use client";

import type { CalendarEvent } from "@/lib/admin/schedule";
import type { ScheduleDensity } from "@/lib/admin/schedule-display";

import { ScheduleBookingTile } from "./ScheduleBookingTile";

const GRID_CLASS: Record<ScheduleDensity, string> = {
  day: "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
  week: "grid grid-cols-2 gap-1.5",
  month: "grid grid-cols-2 gap-1",
};

export function ScheduleBookingGrid({
  events,
  density,
  onSelect,
}: {
  events: CalendarEvent[];
  density: ScheduleDensity;
  onSelect: (event: CalendarEvent) => void;
}) {
  if (events.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-500">
        No bookings
      </p>
    );
  }

  return (
    <div className={GRID_CLASS[density]}>
      {events.map((event) => (
        <ScheduleBookingTile
          key={event.id}
          event={event}
          density={density}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
