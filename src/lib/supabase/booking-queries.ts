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
  const params = new URLSearchParams({
    rental_item,
    monthsAhead: String(monthsAhead),
  });

  const search = params.toString();
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
          (process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "http://localhost:3000"));
  const url = `${origin}/api/unavailable-dates?${search}`;

  try {
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL!;

    const res = await fetch(
      `${baseUrl}/api/unavailable-dates?rental_item=${encodeURIComponent(rental_item)}`,
      { cache: "no-store" }
    );

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
