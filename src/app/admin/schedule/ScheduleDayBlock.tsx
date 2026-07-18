"use client";

import Link from "next/link";

import type { CalendarDay, CalendarEvent } from "@/lib/admin/schedule";
import {
  dayViewHref,
  monthBookingPreview,
  type ScheduleDensity,
} from "@/lib/admin/schedule-display";

import { ScheduleBookingGrid } from "./ScheduleBookingGrid";

const DAY_SHELL: Record<ScheduleDensity, string> = {
  day: "flex min-h-[28rem] flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm",
  week: "flex h-[28rem] flex-col rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm",
  month:
    "flex h-[11.5rem] flex-col rounded-lg border border-slate-200 bg-slate-50 p-2 shadow-sm",
};

export function ScheduleDayBlock({
  day,
  events,
  density,
  isOutsideMonth = false,
  isToday = false,
  onSelectBooking,
}: {
  day: CalendarDay;
  events: CalendarEvent[];
  density: ScheduleDensity;
  isOutsideMonth?: boolean;
  isToday?: boolean;
  onSelectBooking: (event: CalendarEvent) => void;
}) {
  const count = events.length;
  const isMonth = density === "month";
  const preview = isMonth ? monthBookingPreview(events) : null;
  const gridEvents = preview?.visible ?? events;
  const overflowCount = preview?.overflowCount ?? 0;

  return (
    <section
      className={`${DAY_SHELL[density]} ${
        isOutsideMonth ? "opacity-55" : ""
      } ${isToday ? "schedule-day-today" : ""}`}
      data-today={isToday ? "true" : undefined}
    >
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div className="min-w-0">
          {isMonth ? (
            <Link
              href={dayViewHref(day.ymd)}
              className="block rounded-md focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                {day.dayName}
              </p>
              <h3 className="text-sm font-black leading-none text-slate-950">
                {Number(day.ymd.slice(8, 10))}
              </h3>
            </Link>
          ) : (
            <>
              <p className="text-xs font-black text-slate-500">{day.dayName}</p>
              <h3
                className={`mt-1 font-black leading-none ${
                  density === "day" ? "text-2xl" : "text-lg"
                }`}
              >
                {day.label}
              </h3>
            </>
          )}
          <p className="mt-1 text-[10px] font-bold text-slate-500">
            {count} booking{count === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div
        className={`mt-2 min-h-0 flex-1 ${
          density === "day"
            ? "overflow-y-auto pr-1"
            : density === "week"
              ? "overflow-y-auto pr-0.5"
              : "overflow-hidden"
        }`}
      >
        <ScheduleBookingGrid
          events={gridEvents}
          density={density}
          onSelect={onSelectBooking}
        />
        {isMonth && overflowCount > 0 ? (
          <Link
            href={dayViewHref(day.ymd)}
            className="mt-1 inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-1.5 py-1 text-[10px] font-black text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            +{overflowCount} more
          </Link>
        ) : null}
      </div>
    </section>
  );
}
