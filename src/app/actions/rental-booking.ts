"use server";

import {
  type CreateBookingInput,
  type CreateBookingResult,
} from "@/lib/supabase/booking-data";

export type SubmitRentalBookingPayload = CreateBookingInput;

export async function submitRentalBookingRequest(
  _payload: SubmitRentalBookingPayload,
): Promise<CreateBookingResult> {
  void _payload;
  return { ok: false, code: "invalid_input", message: "Use the rental booking form to review and sign your agreement before submitting." };
}
