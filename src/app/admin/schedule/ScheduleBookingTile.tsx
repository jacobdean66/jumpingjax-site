"use client";

import type { CalendarEvent } from "@/lib/admin/schedule";
import {
  bookingTileProductLines,
  scheduleStatusDotTone,
  scheduleTypeLabel,
  scheduleTypeTone,
  shouldShowTypeIndicator,
  type ScheduleDensity,
} from "@/lib/admin/schedule-display";

const SIZE_CLASS: Record<ScheduleDensity, string> = {
  day: "min-h-[5.5rem] p-2.5 text-xs",
  week: "min-h-[4.75rem] p-2 text-[11px]",
  month: "min-h-[3.25rem] p-1.5 text-[10px]",
};

export function ScheduleBookingTile({
  event,
  density,
  onSelect,
}: {
  event: CalendarEvent;
  density: ScheduleDensity;
  onSelect: (event: CalendarEvent) => void;
}) {
  const { lines, overflowCount } = bookingTileProductLines(event);
  const showType = shouldShowTypeIndicator(event);

  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      className={`flex aspect-square w-full flex-col items-stretch justify-between overflow-hidden rounded-lg border text-left shadow-sm transition hover:brightness-[0.97] focus:outline-none focus:ring-2 focus:ring-sky-400 ${scheduleTypeTone(event.type)} ${SIZE_CLASS[density]}`}
      aria-label={`${lines.join(", ")}${overflowCount > 0 ? `, +${overflowCount} more` : ""}, ${scheduleTypeLabel(event.type)}, ${event.status}`}
    >
      <div className="flex items-start justify-between gap-1">
        {showType ? (
          <span className="rounded bg-white/80 px-1 py-0.5 text-[9px] font-black uppercase leading-none tracking-wide text-slate-900">
            {density === "month"
              ? scheduleTypeLabel(event.type).slice(0, 1)
              : scheduleTypeLabel(event.type)}
          </span>
        ) : (
          <span className="sr-only">{scheduleTypeLabel(event.type)}</span>
        )}
        <span
          className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${scheduleStatusDotTone(event.status)}`}
          title={event.status}
          aria-hidden="true"
        />
      </div>
      <div className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-hidden">
        {lines.map((line) => (
          <p
            key={line}
            className="break-words font-black leading-tight text-slate-950"
          >
            {line}
          </p>
        ))}
        {overflowCount > 0 ? (
          <p className="font-bold leading-tight text-slate-700">
            +{overflowCount} more
          </p>
        ) : null}
      </div>
    </button>
  );
}
