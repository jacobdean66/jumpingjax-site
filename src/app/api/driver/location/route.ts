import { NextResponse } from "next/server";
import { verifyDriverAccess } from "@/lib/admin/driver-auth";
import { saveDriverLocationSnapshot } from "@/lib/admin/driver-location";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LocationBody =
  | {
      truck?: unknown;
      workDate?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      accuracyMeters?: unknown;
      speedMetersPerSecond?: unknown;
      headingDegrees?: unknown;
      capturedAt?: unknown;
    }
  | null;

export async function POST(req: Request) {
  const limited = rateLimit(req, {
    scope: "driver-location-write",
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  const auth = await verifyDriverAccess();
  if (!auth.ok) {
    return NextResponse.json({ error: "Invalid driver login" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as LocationBody;
  const saved = await saveDriverLocationSnapshot({
    driverId: auth.identity.id,
    driverName: auth.identity.name,
    truck: typeof body?.truck === "string" ? body.truck : null,
    workDate: typeof body?.workDate === "string" ? body.workDate : null,
    latitude: body?.latitude,
    longitude: body?.longitude,
    accuracyMeters: body?.accuracyMeters,
    speedMetersPerSecond: body?.speedMetersPerSecond,
    headingDegrees: body?.headingDegrees,
    capturedAt: body?.capturedAt,
    userAgent: req.headers.get("user-agent"),
  });

  if (!saved.ok) {
    return NextResponse.json({ error: saved.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, location: saved.value });
}
