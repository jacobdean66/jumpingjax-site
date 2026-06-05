export type RentalUnavailableResult = {
  ymds: string[];
  error: "read_failed" | "not_configured" | null;
};

/**
 * Load unavailable YYYY-MM-DD strings for a rental via same-origin API
 * (server uses service-role Supabase; avoids browser CORS to Supabase).
 */
export async function queryRentalUnavailableYmds(
  rental_item: string,
  monthsAhead: number = 6,
): Promise<RentalUnavailableResult> {
  try {
    const res = await fetch(
      `/api/unavailable-dates?rental_item=${encodeURIComponent(
        rental_item,
      )}&months_ahead=${monthsAhead}`,
      { cache: "no-store" }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch unavailable dates');
    }

    return { ymds: data.ymds || [], error: null };
  } catch (e) {
    console.error("[bookings] load unavailable", e);
    return { ymds: [], error: "read_failed" };
  }
}
