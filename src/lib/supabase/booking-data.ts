import {
  bookingInclusiveEnd,
  startOfDay,
} from "@/lib/bookings/unavailableDates";
import { parseYMD } from "@/lib/mockBooking";
import { createServiceRoleClient, isSupabaseServiceConfigured } from "./admin";

export function rentalDateRangesOverlap(
  existingStartYmd: string,
  existingSpanDays: number,
  newStartYmd: string,
  newSpanDays: number,
): boolean {
  const existingStart = startOfDay(parseYMD(existingStartYmd));
  const existingEnd = bookingInclusiveEnd(existingStartYmd, existingSpanDays);
  const newStart = startOfDay(parseYMD(newStartYmd));
  const newEnd = bookingInclusiveEnd(newStartYmd, newSpanDays);
  return existingStart <= newEnd && existingEnd >= newStart;
}

function formatRentalUnavailableMessage(unavailableNames: string[]): string {
  if (unavailableNames.length === 0) {
    return "This rental is unavailable for the selected dates.";
  }
  if (unavailableNames.length === 1) {
    return `${unavailableNames[0]} is unavailable for the selected dates.`;
  }
  return `These rentals are unavailable for the selected dates: ${unavailableNames.join(", ")}.`;
}

export type CreateBookingInput = {
  idempotencyKey: string;
  rental_items: { rental_item: string; rental_name?: string }[];
  customerName: string;
  email: string;
  phone: string;
  eventDateYmd: string;
  durationLabel: string;
  foamDurationLabel?: string | null;
  spanDays: number;
  eventAddress: string;
  delivery_time?: string;
  event_start_time?: string;
  requested_delivery_window?: string;
  distance_miles?: number | null;
  delivery_fee: number;
  mileage_fee: number;
  setup_location: string;
  setup_surface: string;
  setup_access: string;
  setup_notes: string;
  payment_method: string;
  subtotal: number;
  total: number;
};

export type CreateBookingResult =
  | { ok: true; id: string }
  | { ok: false; code: "conflict" | "write_failed" | "invalid_input"; message?: string };

/**
 * Persists a pending booking row in Supabase.
 */
export async function insertPendingBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  if (!isSupabaseServiceConfigured()) {
    const diag = {
      hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    };
    const message = !diag.hasServiceRoleKey
      ? "Server env missing SUPABASE_SERVICE_ROLE_KEY (add it in Vercel → Settings → Environment Variables). RLS anon policies do not replace the service role for this server action."
      : !diag.hasUrl
        ? "Server env missing NEXT_PUBLIC_SUPABASE_URL."
        : "Supabase URL or service role key is not configured on the server.";
    console.error(
      "[bookings] insertPendingBooking: Supabase service client not configured",
      diag,
    );
    return { ok: false, code: "write_failed", message };
  }

  try {
    if (!input.rental_items || input.rental_items.length === 0) {
      return { ok: false, code: "invalid_input" };
    }
    if (!input.idempotencyKey.trim()) {
      return { ok: false, code: "invalid_input", message: "Missing idempotency key" };
    }

    const supabase = createServiceRoleClient();

    const primaryRentalItem = input.rental_items[0]!;
    const rental_item = primaryRentalItem.rental_item;
    const rentalName = primaryRentalItem.rental_name ?? primaryRentalItem.rental_item;

    const spanDays = input.spanDays >= 1 ? input.spanDays : 1;

    const bookingData: {
      rental_item: string;
      customer_name: string;
      customer_email: string;
      customer_phone: string;
      event_date: string;
      span_days: number;
      status: string;
      rental_name?: string;
      duration?: string;
      foam_duration?: string | null;
      event_address?: string;
      delivery_time?: string;
      event_start_time?: string;
      requested_delivery_window?: string;
      distance_miles?: number | null;
      delivery_fee?: number;
      mileage_fee?: number;
      setup_location?: string;
      setup_surface?: string;
      setup_access?: string;
      setup_notes?: string;
      payment_method?: string;
      subtotal?: number;
      total?: number;
    } = {
      rental_item: rental_item,
      rental_name: rentalName,
      customer_name: input.customerName,
      customer_email: input.email.trim(),
      customer_phone: input.phone.trim(),
      event_date: input.eventDateYmd,
      duration: input.durationLabel,
      foam_duration: input.foamDurationLabel?.trim() || null,
      span_days: spanDays,
      event_address: input.eventAddress.trim(),
      delivery_time: input.delivery_time,
      event_start_time: input.event_start_time,
      requested_delivery_window: input.requested_delivery_window?.trim(),
      distance_miles: input.distance_miles,
      delivery_fee: input.delivery_fee,
      mileage_fee: input.mileage_fee,
      setup_location: input.setup_location.trim(),
      setup_surface: input.setup_surface.trim(),
      setup_access: input.setup_access.trim(),
      setup_notes: input.setup_notes.trim(),
      payment_method: input.payment_method.trim(),
      subtotal: input.subtotal,
      total: input.total,
      status: "pending" as const,
    };

    const rentalItemRows = input.rental_items.map((item) => ({
      rental_item: item.rental_item,
      rental_name: item.rental_name ?? item.rental_item,
    }));
    // Use the versioned RPC so an old SQL snippet cannot silently replace the
    // production booking implementation again.
    const { data, error } = await supabase.rpc("create_rental_booking_atomic_v2", {
      p_booking: bookingData,
      p_items: rentalItemRows,
      p_idempotency_key: input.idempotencyKey.trim(),
    });

    if (error) {
      if (error.message?.includes("booking_conflict")) {
        return {
          ok: false,
          code: "conflict",
          message: formatRentalUnavailableMessage(
            input.rental_items.map((item) => item.rental_name?.trim() || item.rental_item),
          ),
        };
      }
      console.error("[bookings] atomic booking RPC failed", {
        code: error.code,
        details: error.details,
      });
      return {
        ok: false,
        code: "write_failed",
        message: "Unable to save the rental request",
      };
    }

    const id = data;
    if (!id) {
      console.error("[bookings] supabase insert returned no booking id", {
        data,
        error,
      });
      return {
        ok: false,
        code: "write_failed",
        message: "Booking persistence returned no reference",
      };
    }
    return { ok: true, id: String(id) };
  } catch (e) {
    console.error("[bookings] insertPendingBooking threw", e);
    return {
      ok: false,
      code: "write_failed",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
