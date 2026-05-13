import { createServiceRoleClient, isSupabaseServiceConfigured } from "./admin";

export type CreateBookingInput = {
  rentalSlug: string;
  rentalName: string;
  customerName: string;
  email: string;
  phone: string;
  eventDateYmd: string;
  durationLabel: string;
  spanDays: number;
  eventAddress: string;
  subtotal: number;
  total: number;
};

export type CreateBookingResult =
  | { ok: true; id: string }
  | { ok: false; code: "not_configured" | "conflict" | "write_failed" };

/**
 * Persists a pending booking if dates do not overlap an active hold on the same rental.
 */
export async function insertPendingBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  if (!isSupabaseServiceConfigured()) {
    return { ok: false, code: "not_configured" };
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("create_rental_booking", {
      p_rental_slug: input.rentalSlug,
      p_rental_name: input.rentalName,
      p_customer_name: input.customerName,
      p_email: input.email.trim(),
      p_phone: input.phone.trim(),
      p_event_date: input.eventDateYmd,
      p_duration: input.durationLabel,
      p_span_days: input.spanDays,
      p_event_address: input.eventAddress.trim(),
      p_subtotal: input.subtotal,
      p_total: input.total,
    });

    if (error) {
      const details = (error as { details?: string }).details ?? "";
      const hint = (error as { hint?: string }).hint ?? "";
      const blob = `${error.message} ${details} ${hint}`.toLowerCase();
      if (
        blob.includes("date_conflict") ||
        error.code === "23514" ||
        error.code === "P0001"
      ) {
        return { ok: false, code: "conflict" };
      }
      console.error("[bookings] insert", error);
      return { ok: false, code: "write_failed" };
    }

    const id = data as string | null;
    if (!id) {
      return { ok: false, code: "write_failed" };
    }
    return { ok: true, id };
  } catch (e) {
    console.error("[bookings] insert", e);
    return { ok: false, code: "write_failed" };
  }
}
