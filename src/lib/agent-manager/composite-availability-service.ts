import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";

import {
  buildLiveCompositeAvailabilityBlocks,
  type ActiveFacilityAvailabilityRow,
  type ActiveRentalAvailabilityRow,
} from "./composite-availability";

const MAX_ACTIVE_ROWS_PER_SOURCE = 500;

export async function loadLiveCompositeAvailabilityBlocks() {
  const db = createServiceRoleClient();
  const [rentals, facilities] = await Promise.all([
    db.from("bookings")
      .select("event_date,span_days,rental_item,booking_rental_items(rental_item)")
      .in("status", ["pending", "approved", "blocked"])
      .order("event_date")
      .limit(MAX_ACTIVE_ROWS_PER_SOURCE),
    db.from("facility_bookings")
      .select("start_time,end_time")
      .in("status", ["pending", "confirmed"])
      .order("start_time")
      .limit(MAX_ACTIVE_ROWS_PER_SOURCE),
  ]);
  if (rentals.error || facilities.error) {
    throw new Error("Composite booking availability could not be verified");
  }
  return buildLiveCompositeAvailabilityBlocks({
    rentals: rentals.data as ActiveRentalAvailabilityRow[],
    facilities: facilities.data as ActiveFacilityAvailabilityRow[],
  });
}

