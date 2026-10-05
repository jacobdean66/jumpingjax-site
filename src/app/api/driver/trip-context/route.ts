import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyDriverAccess } from "@/lib/admin/driver-auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { DRIVER_MOBILE_SESSION_COOKIE, isDriverTrailer, isDriverVehicle } from "@/lib/admin/driver-trip-context";

export async function POST(req: Request) {
  const auth = await verifyDriverAccess();
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Driver sign-in required." }, { status: 401 });
  if (req.headers.get("origin") && req.headers.get("origin") !== new URL(req.url).origin) {
    return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  }
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ ok: false, error: "JSON request required." }, { status: 415 });
  }
  const body = await req.json().catch(() => null);
  if (!isDriverVehicle(body?.vehicle) || !isDriverTrailer(body?.trailer)) {
    return NextResponse.json({ ok: false, error: "Choose a truck and trailer." }, { status: 400 });
  }
  const sessionId = (await cookies()).get(DRIVER_MOBILE_SESSION_COOKIE)?.value;
  if (sessionId) {
    const { data, error } = await createServiceRoleClient().from("driver_location_sessions")
      .update({ vehicle: body.vehicle, trailer: body.trailer })
      .eq("id", sessionId).eq("driver_id", auth.identity.id).is("signed_out_at", null)
      .select("id").maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: "Truck and trailer could not be saved." }, { status: 500 });
    if (!data) return NextResponse.json({ ok: false, error: "Reopen the phone app to reconnect tracking." }, { status: 409 });
  }
  return NextResponse.json({ ok: true, nativeTracking: !!sessionId });
}
