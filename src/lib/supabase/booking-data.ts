import type { PostgrestError } from "@supabase/supabase-js";
import { createServiceRoleClient, isSupabaseServiceConfigured } from "./admin";

function formatPostgrestError(error: PostgrestError): string {
  return [
    error.message,
    error.details && `details: ${error.details}`,
    error.hint && `hint: ${error.hint}`,
    error.code && `code: ${error.code}`,
  ]
    .filter(Boolean)
    .join(" — ");
}

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
  | { ok: false; code: "conflict" | "write_failed"; message?: string };

/**
 * Persists a pending booking if dates do not overlap an active hold on the same rental.
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

    console.log("[bookings] supabase rpc create_rental_booking response", {
      data,
      error,
    });

    if (error) {
      console.error("[bookings] supabase rpc error object", error);
      const details = (error as { details?: string }).details ?? "";
      const hint = (error as { hint?: string }).hint ?? "";
      const blob = `${error.message} ${details} ${hint}`.toLowerCase();
      if (
        blob.includes("date_conflict") ||
        error.code === "23514" ||
        error.code === "P0001"
      ) {
        return {
          ok: false,
          code: "conflict",
          message: formatPostgrestError(error),
        };
      }
      return {
        ok: false,
        code: "write_failed",
        message: formatPostgrestError(error),
      };
    }

    const id = data as string | null;
    if (!id) {
      console.error(
        "[bookings] supabase rpc returned no booking id",
        { data, error },
      );
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
