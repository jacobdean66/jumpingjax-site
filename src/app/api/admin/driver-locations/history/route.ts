import { NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { loadDriverTripHistory } from "@/lib/admin/driver-trip-history-data";
import { todayYmd } from "@/lib/admin/delivery-planner-dates";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Owner access required." }, { status: 401 });
  const params = new URL(req.url).searchParams;
  try {
    const history = await loadDriverTripHistory({ date: params.get("date") ?? todayYmd(), driverId: params.get("driver") || undefined });
    return NextResponse.json({ ok: true, ...history }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Route history could not be loaded." }, { status: 400 });
  }
}
