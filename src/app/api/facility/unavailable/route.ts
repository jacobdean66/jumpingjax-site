import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const partyKind = searchParams.get("partyKind");
    const date = searchParams.get("date");

    if (partyKind && partyKind !== "public" && partyKind !== "private") {
      return Response.json([]);
    }
    if (!date) {
      return Response.json([]);
    }

    const supabase = createServiceRoleClient();
    let query = supabase
      .from("facility_bookings")
      .select("id, party_kind, room, start_time, end_time, status")
      .eq("status", "confirmed")
      .gte("start_time", date + "T00:00:00")
      .lt("start_time", date + "T23:59:59");

    if (partyKind) {
      query = query.eq("party_kind", partyKind);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return Response.json([]);
    }

    return Response.json(data || []);
  } catch (err) {
    console.error("Route crash:", err);
    return Response.json([]);
  }
}
