import {
  bookingInclusiveEnd,
  startOfDay,
} from "@/lib/bookings/unavailableDates";
import { parseYMD } from "@/lib/mockBooking";
import { createServiceRoleClient, isSupabaseServiceConfigured } from "./admin";

const ACTIVE_RENTAL_STATUSES = ["pending", "approved", "blocked"] as const;

function rentalDateRangesOverlap(
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

export type CreateBookingInput = {
  rental_item: string | null;
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
    const supabase = createServiceRoleClient();
    if (!input.rental_item) {
      return {
        ok: false,
        code: "invalid_input",
        message: "rental_item is required",
      };
    }

    const spanDays = input.spanDays >= 1 ? input.spanDays : 1;

    const { data: existingRows, error: conflictQueryError } = await supabase
      .from("bookings")
      .select("event_date, span_days")
      .eq("rental_item", input.rental_item)
      .in("status", [...ACTIVE_RENTAL_STATUSES]);

    if (conflictQueryError) {
      console.error("[bookings] conflict check failed", conflictQueryError);
      return {
        ok: false,
        code: "write_failed",
        message: conflictQueryError.message,
      };
    }

    for (const row of existingRows ?? []) {
      const existingStartYmd =
        typeof row.event_date === "string"
          ? row.event_date.slice(0, 10)
          : String(row.event_date);
      const existingSpanDays =
        typeof row.span_days === "number" && row.span_days >= 1
          ? row.span_days
          : 1;

      if (
        rentalDateRangesOverlap(
          existingStartYmd,
          existingSpanDays,
          input.eventDateYmd,
          spanDays,
        )
      ) {
        return {
          ok: false,
          code: "conflict",
          message: "This rental is unavailable for the selected dates.",
        };
      }
    }

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
      event_address?: string;
      subtotal?: number;
      total?: number;
    } = {
      rental_item: input.rental_item,
      rental_name: input.rentalName,
      customer_name: input.customerName,
      customer_email: input.email.trim(),
      customer_phone: input.phone.trim(),
      event_date: input.eventDateYmd,
      duration: input.durationLabel,
      span_days: spanDays,
      event_address: input.eventAddress.trim(),
      subtotal: input.subtotal,
      total: input.total,
      status: "pending" as const,
    };

    const { data, error } = await supabase
      .from("bookings")
      .insert([bookingData])
      .select()
      .single();

    console.log("[bookings] supabase insert response", { data, error });

    if (error) {
      console.error("SUPABASE INSERT ERROR FULL:", error);
      return {
        ok: false,
        code: "write_failed",
        message: error.message,
      };
    }

    const id = data?.id;
    if (!id) {
      console.error("[bookings] supabase insert returned no booking id", {
        data,
        error,
      });
      return {
        ok: false,
        code: "write_failed",
        message: `Supabase returned success but no id (data: ${JSON.stringify(data)})`,
      };
    }
    return { ok: true, id };
  } catch (e) {
    console.error("[bookings] insertPendingBooking threw", e);
    return {
      ok: false,
      code: "write_failed",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
