import type { PostgrestError } from "@supabase/supabase-js";
import { createServiceRoleClient, isSupabaseServiceConfigured } from "./admin";

function formatPostgrestError(error: PostgrestError): string {
  return [
    String(error),
    error.details && `details: ${error.details}`,
    error.hint && `hint: ${error.hint}`,
    error.code && `code: ${error.code}`,
  ]
    .filter(Boolean)
    .join(" — ");
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
      span_days: input.spanDays >= 1 ? input.spanDays : 1,
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
