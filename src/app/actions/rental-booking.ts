"use server";

import {
  insertPendingBooking,
  type CreateBookingInput,
  type CreateBookingResult,
} from "@/lib/supabase/booking-data";

export type SubmitRentalBookingPayload = CreateBookingInput;

export async function submitRentalBookingRequest(
  payload: SubmitRentalBookingPayload,
): Promise<CreateBookingResult> {
  return insertPendingBooking(payload);
}
