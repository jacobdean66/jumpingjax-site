import { NextResponse } from "next/server";
import { saveDriverLocationPoint } from "@/lib/admin/driver-location";

export const dynamic = "force-dynamic";

function bearerToken(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

export async function POST(req: Request) {
  let body: {
    latitude?: unknown;
    longitude?: unknown;
    accuracyMeters?: unknown;
    altitudeMeters?: unknown;
    headingDegrees?: unknown;
    speedMetersPerSecond?: unknown;
    batteryLevel?: unknown;
    capturedAt?: unknown;
    vehicle?: unknown;
    trailer?: unknown;
  };

  try {
    body = await req.json();
    if (!body || typeof body !== "object") throw new Error("Invalid body");
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const result = await saveDriverLocationPoint({
    token: bearerToken(req),
    location: {
      latitude: body.latitude,
      vehicle: body.vehicle,
      trailer: body.trailer,
      longitude: body.longitude,
      accuracyMeters: body.accuracyMeters,
      altitudeMeters: body.altitudeMeters,
      headingDegrees: body.headingDegrees,
      speedMetersPerSecond: body.speedMetersPerSecond,
      batteryLevel: body.batteryLevel,
      capturedAt: typeof body.capturedAt === "string" ? body.capturedAt : null,
    },
  });

  if (!result.ok) {
    const status = result.reason === "invalid_location" ? 400 : 401;
    return NextResponse.json({ ok: false, error: result.reason }, { status });
  }

  return NextResponse.json({
    ok: true,
    driverName: result.driverName,
    receivedAt: new Date().toISOString(),
  });
}
