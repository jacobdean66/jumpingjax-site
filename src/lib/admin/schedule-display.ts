import { formatProductLabel } from "./schedule-products";
import type { CalendarEvent, ScheduleEventType } from "./schedule";

export type ScheduleDensity = "day" | "week" | "month";

export const MONTH_VISIBLE_BOOKING_LIMIT = 3;

export function scheduleTypeLabel(type: ScheduleEventType): string {
  if (type === "rental") return "Rental";
  if (type === "foam-party") return "Foam Party";
  if (type === "public-party") return "Public Party";
  return "Private Party";
}

export function scheduleTypeTone(type: ScheduleEventType): string {
  if (type === "rental") return "border-sky-200 bg-sky-50 text-sky-950";
  if (type === "foam-party") return "border-cyan-200 bg-cyan-50 text-cyan-950";
  if (type === "public-party") return "border-pink-200 bg-pink-50 text-pink-950";
  return "border-violet-200 bg-violet-50 text-violet-950";
}

export function scheduleStatusDotTone(status: string): string {
  if (status === "pending") return "bg-amber-500";
  if (status === "approved" || status === "confirmed") return "bg-emerald-500";
  if (status === "cancelled" || status === "canceled") return "bg-orange-500";
  if (status === "rejected") return "bg-rose-500";
  return "bg-slate-400";
}

/**
 * Product lines shown inside a compact booking tile.
 * One booking stays one tile; multi-product rentals show up to two names.
 */
export function bookingTileProductLines(event: CalendarEvent): {
  lines: string[];
  overflowCount: number;
} {
  if (event.products.length > 0) {
    const labels = event.products.map(formatProductLabel);
    if (labels.length <= 2) {
      return { lines: labels, overflowCount: 0 };
    }
    return {
      lines: labels.slice(0, 2),
      overflowCount: labels.length - 2,
    };
  }

  return {
    lines: [event.title || scheduleTypeLabel(event.type)],
    overflowCount: 0,
  };
}

/**
 * Whether a compact type chip is useful on the tile.
 * Pure single-product rentals already show the product name; other types need a cue.
 */
export function shouldShowTypeIndicator(event: CalendarEvent): boolean {
  if (event.type !== "rental") return true;
  return event.products.length === 0;
}

export function monthBookingPreview(events: readonly CalendarEvent[]): {
  visible: CalendarEvent[];
  overflowCount: number;
} {
  if (events.length <= MONTH_VISIBLE_BOOKING_LIMIT) {
    return { visible: [...events], overflowCount: 0 };
  }
  return {
    visible: events.slice(0, MONTH_VISIBLE_BOOKING_LIMIT),
    overflowCount: events.length - MONTH_VISIBLE_BOOKING_LIMIT,
  };
}

export function dayViewHref(ymd: string): string {
  const params = new URLSearchParams({ view: "day", date: ymd });
  return `/admin/schedule?${params.toString()}`;
}
