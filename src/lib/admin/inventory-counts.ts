import { createServiceRoleClient } from "@/lib/supabase/admin";
import { todayYmd } from "./operations";

export type InventoryRentalCounts = {
  slug: string;
  pastRentals: number;
  futureBookings: number;
};

const EXCLUDED_STATUSES = new Set([
  "cancelled",
  "canceled",
  "rejected",
  "deleted",
]);

/**
 * Past rentals: quantity-weighted line items on non-canceled bookings with
 * event_date < today (local calendar date via todayYmd()).
 * Future bookings: event_date >= today (includes today).
 * Canceled/rejected/deleted bookings are excluded from both counts.
 * Each booking_rental_items row counts as quantity 1 (unique per item/booking).
 */
export async function loadInventoryRentalCounts(): Promise<
  Map<string, InventoryRentalCounts>
> {
  const supabase = createServiceRoleClient();
  const today = todayYmd();

  const { data: itemRows, error: itemError } = await supabase
    .from("booking_rental_items")
    .select("booking_id, rental_item");

  if (itemError) throw new Error(itemError.message);

  const bookingIds = [
    ...new Set(
      (itemRows ?? [])
        .map((row) => row.booking_id)
        .filter((id) => id !== null && id !== undefined),
    ),
  ];

  const bookingMeta = new Map<string, { eventDate: string; status: string }>();

  if (bookingIds.length > 0) {
    const { data: bookings, error: bookingError } = await supabase
      .from("bookings")
      .select("id, event_date, status")
      .in("id", bookingIds);

    if (bookingError) throw new Error(bookingError.message);

    for (const booking of bookings ?? []) {
      bookingMeta.set(String(booking.id), {
        eventDate: String(booking.event_date).slice(0, 10),
        status: String(booking.status ?? "")
          .trim()
          .toLowerCase(),
      });
    }
  }

  const counts = new Map<string, InventoryRentalCounts>();

  for (const row of itemRows ?? []) {
    const rentalItem =
      typeof row.rental_item === "string" ? row.rental_item.trim() : "";
    if (!rentalItem) continue;

    const meta = bookingMeta.get(String(row.booking_id));
    if (!meta) continue;
    if (EXCLUDED_STATUSES.has(meta.status)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.eventDate)) continue;

    const current = counts.get(rentalItem) ?? {
      slug: rentalItem,
      pastRentals: 0,
      futureBookings: 0,
    };

    if (meta.eventDate < today) current.pastRentals += 1;
    else current.futureBookings += 1;

    counts.set(rentalItem, current);
  }

  return counts;
}

export function emptyInventoryCounts(slug: string): InventoryRentalCounts {
  return { slug, pastRentals: 0, futureBookings: 0 };
}

export function inventoryCountDateBoundary(today = todayYmd()): {
  pastBefore: string;
  futureOnOrAfter: string;
} {
  return { pastBefore: today, futureOnOrAfter: today };
}
