import { NextResponse } from "next/server";
import {
  createDriverMobileSession,
  endDriverMobileSession,
  loadActiveDriverMobileSession,
} from "@/lib/admin/driver-location";
import { createDriverSessionValue, DRIVER_SESSION_COOKIE } from "@/lib/admin/driver-auth";

export const dynamic = "force-dynamic";

function bearerToken(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

export async function POST(req: Request) {
  let body: {
    username?: unknown;
    password?: unknown;
    deviceId?: unknown;
    deviceLabel?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  const session = await createDriverMobileSession({
    username,
    password,
    deviceId: body.deviceId,
    deviceLabel: body.deviceLabel,
  });

  if (!session) {
    return NextResponse.json({ ok: false, error: "Invalid driver login" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    sessionId: session.id,
    sessionToken: session.token,
    driver: {
      id: session.driverId,
      name: session.driverName,
    },
  });
}

export async function DELETE(req: Request) {
  const ended = await endDriverMobileSession({
    token: bearerToken(req),
    reason: "driver-sign-out",
  });

  const response = NextResponse.json({ ok: true, ended });
  response.cookies.set({
    name: DRIVER_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionToken = url.searchParams.get("sessionToken");
  const session = await loadActiveDriverMobileSession(sessionToken);

  if (!session) {
    return NextResponse.redirect(new URL("/driver?error=Invalid%20tracker%20session", req.url), 303);
  }

  const webSessionValue = createDriverSessionValue({
    id: session.driver_id,
    name: session.driver_name,
    username: session.driver_name,
    role: "employee",
  });

  if (!webSessionValue) {
    return NextResponse.redirect(new URL("/driver?error=Unable%20to%20open%20driver%20app", req.url), 303);
  }

  const response = NextResponse.redirect(new URL("/driver", req.url), 303);
  response.cookies.set({
    name: DRIVER_SESSION_COOKIE,
    value: webSessionValue,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
