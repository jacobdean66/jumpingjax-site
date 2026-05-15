export type RentalUnavailableResult = {
  ymds: string[];
  error: "read_failed" | "not_configured" | null;
};

/**
 * Load unavailable YYYY-MM-DD strings for a rental via same-origin API
 * (server uses service-role Supabase; avoids browser CORS to Supabase).
 */
export async function queryRentalUnavailableYmds(
  rentalSlug: string,
  monthsAhead: number = 6,
): Promise<RentalUnavailableResult> {
  const params = new URLSearchParams({
    rentalSlug,
    monthsAhead: String(monthsAhead),
  });

  try {
    const res = await fetch(`/api/unavailable-dates?${params.toString()}`);

    if (res.status === 503) {
      return { ymds: [], error: "not_configured" };
    }

    const data: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      console.error("[bookings] load unavailable", res.status, data);
      return { ymds: [], error: "read_failed" };
    }

    if (
      data &&
      typeof data === "object" &&
      "ymds" in data &&
      Array.isArray((data as { ymds: unknown }).ymds) &&
      (data as { ymds: unknown[] }).ymds.every((x) => typeof x === "string")
    ) {
      return { ymds: (data as { ymds: string[] }).ymds, error: null };
    }

    console.error("[bookings] load unavailable unexpected body", data);
    return { ymds: [], error: "read_failed" };
  } catch (e) {
    console.error("[bookings] load unavailable", e);
    return { ymds: [], error: "read_failed" };
  }
}
