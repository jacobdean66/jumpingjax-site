import { loadPublicFacilityAvailabilityRows } from "@/lib/facility-parties/availability-query";
import { isCanonicalFacilityBookingYmd } from "@/lib/facility-parties/booking-horizon";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const partyKind = searchParams.get("partyKind");
    const date = searchParams.get("date");

    if (partyKind && partyKind !== "public" && partyKind !== "private") {
      return Response.json([]);
    }
    if (!date || !isCanonicalFacilityBookingYmd(date)) {
      return Response.json([]);
    }

    const supabase = createServiceRoleClient();
    const loaded = await loadPublicFacilityAvailabilityRows(supabase, date);
    if (!loaded.ok) {
      console.error("Supabase error:", loaded.error);
      return Response.json([]);
    }

    const rows = partyKind
      ? loaded.rows.filter((booking) => booking.party_kind === partyKind)
      : loaded.rows;

    return Response.json(rows);
  } catch (err) {
    console.error("Route crash:", err);
    return Response.json([]);
  }
}
