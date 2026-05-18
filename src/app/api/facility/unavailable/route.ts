import { createServiceRoleClient } from "@/lib/supabase/admin";

function toYmd(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const partyKind = searchParams.get("partyKind");

    if (partyKind !== "public" && partyKind !== "private") {
      return Response.json([]);
    }

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("facility_bookings")
      .select("party_kind, start_time")
      .eq("party_kind", partyKind)
      .eq("status", "confirmed");

    if (error) {
      console.error("Supabase error:", error);
      return Response.json([]);
    }

    const unavailableDates = Array.from(
      new Set((data || []).map((booking) => toYmd(booking.start_time))),
    );

    return Response.json(unavailableDates);
  } catch (err) {
    console.error("Route crash:", err);
    return Response.json([]);
  }
}
