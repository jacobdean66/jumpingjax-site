import {
  loadScheduleEvents,
  toYmd,
  type CalendarEvent,
} from "@/lib/admin/schedule";
import { loadAdminDeliveries } from "@/lib/admin/deliveries";
import { todayYmd } from "@/lib/admin/operations";
import {
  rentalAppearsInActiveSchedule,
  rentalIsHistorical,
} from "@/lib/bookings/rental-lifecycle";

export type TodayFocusItem = {
  id: string;
  kind: "brief" | "booking" | "delivery" | "pickup" | "facility";
  label: string;
  detail: string;
  href: string;
};

const MORNING_BRIEF_BY_DATE: Record<string, TodayFocusItem[]> = {
  "2026-08-27": [
    {
      id: "morning-brief-facility-2c775988-3d7b-4465-b19c-2d3eb621966c",
      kind: "brief",
      label: "Confirm Stephanie Long's party request",
      detail: "$256.80 public-play party · Sep 19, 4:00–5:30 PM · High urgency",
      href: "/admin/facility#booking-2c775988-3d7b-4465-b19c-2d3eb621966c",
    },
    {
      id: "morning-brief-giveaway-colton",
      kind: "brief",
      label: "Review clustered giveaway nominations",
      detail: "Five nominations for Colton arrived within five minutes · Check duplicates and eligibility",
      href: "/admin/giveaway",
    },
  ],
  "2026-08-28": [
    {
      id: "morning-brief-facility-2c775988-3d7b-4465-b19c-2d3eb621966c",
      kind: "brief",
      label: "Confirm Stephanie Long's party request",
      detail: "$256.80 public-play party · Sep 19, 4:00–5:30 PM · High urgency",
      href: "/admin/facility#booking-2c775988-3d7b-4465-b19c-2d3eb621966c",
    },
    {
      id: "morning-brief-giveaway-colton",
      kind: "brief",
      label: "Review clustered giveaway nominations",
      detail: "Five nominations for Colton arrived within five minutes · Check duplicates and eligibility",
      href: "/admin/giveaway",
    },
  ],
};

export function morningBriefFocusItems(date: string): TodayFocusItem[] {
  return MORNING_BRIEF_BY_DATE[date] ?? [];
}

function focusHrefForEvent(event: CalendarEvent): string {
  return event.detailHref;
}

export async function loadTodayFocusItems(): Promise<TodayFocusItem[]> {
  const today = todayYmd();
  const items: TodayFocusItem[] = [...morningBriefFocusItems(today)];

  try {
    const events = await loadScheduleEvents({ from: today, to: today });
    for (const event of events) {
      const rentalEvent =
        event.type === "rental" || event.type === "foam-party";
      if (
        (rentalEvent && !rentalAppearsInActiveSchedule(event.status)) ||
        (!rentalEvent && rentalIsHistorical(event.status))
      ) {
        continue;
      }
      items.push({
        id: event.id,
        kind: event.type === "rental" || event.type === "foam-party" ? "booking" : "facility",
        label: event.customer,
        detail: `${event.title} · ${event.displayTime}`,
        href: focusHrefForEvent(event),
      });
    }
  } catch (error) {
    console.error("[today-focus] schedule load failed", error);
  }

  try {
    const deliveries = await loadAdminDeliveries(today);
    for (const booking of deliveries.bookings) {
      const already = items.some(
        (item) => item.id === `rental-${booking.id}` || item.href.includes(`booking-${booking.id}`),
      );
      if (already) continue;
      items.push({
        id: `delivery-${booking.id}`,
        kind: "delivery",
        label: booking.customerName,
        detail: `Delivery · ${booking.items.map((item) => item.rental_name).join(", ") || "Rental"}`,
        href: `/admin/rentals?from=${encodeURIComponent(today)}&to=${encodeURIComponent(today)}#booking-${encodeURIComponent(booking.id)}`,
      });
    }
  } catch (error) {
    console.error("[today-focus] deliveries load failed", error);
  }

  return items;
}

export function focusDayLabel(date = new Date()): string {
  return toYmd(date);
}
