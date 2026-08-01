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
  kind: "booking" | "delivery" | "pickup" | "facility";
  label: string;
  detail: string;
  href: string;
};

function focusHrefForEvent(event: CalendarEvent): string {
  return event.detailHref;
}

export async function loadTodayFocusItems(): Promise<TodayFocusItem[]> {
  const today = todayYmd();
  const items: TodayFocusItem[] = [];

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
