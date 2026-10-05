import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createDriverSessionValue,
  DRIVER_SESSION_COOKIE,
  verifyDriverLogin,
  verifyDriverAccess,
} from "@/lib/admin/driver-auth";
import { verifyAdminLogin } from "@/lib/admin/delivery-auth";
import { verifyAdminStaffLogin } from "@/lib/admin/staff-users";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { DRIVER_MOBILE_SESSION_COOKIE } from "@/lib/admin/driver-trip-context";

export async function POST(req: Request) {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  const driverAuth = await verifyDriverLogin({ username, password });
  const staffAttempt = driverAuth.ok
    ? { configured: false, identity: null }
    : await verifyAdminStaffLogin({ username, password });
  const adminFallback =
    driverAuth.ok || staffAttempt.configured
      ? null
      : verifyAdminLogin(username || null, password || null);
  const ownerAuth =
    staffAttempt.identity?.role === "owner"
      ? { ok: true as const, role: staffAttempt.identity.role, identity: staffAttempt.identity }
      : adminFallback?.ok && adminFallback.role === "owner"
        ? adminFallback
        : null;
  const auth = driverAuth.ok ? driverAuth : ownerAuth;

  if (!auth) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const sessionValue = createDriverSessionValue(auth.identity);
  if (!sessionValue) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const response = NextResponse.json({
    ok: true,
    role: auth.role,
    identity: auth.identity,
  });
  response.cookies.set({
    name: DRIVER_SESSION_COOKIE,
    value: sessionValue,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}

export async function DELETE() {
  const auth = await verifyDriverAccess();
  const sessionId = (await cookies()).get(DRIVER_MOBILE_SESSION_COOKIE)?.value;
  if (auth.ok && sessionId) {
    const { error } = await createServiceRoleClient().from("driver_location_sessions")
      .update({ signed_out_at: new Date().toISOString(), sign_out_reason: "driver-web-sign-out" })
      .eq("id", sessionId).eq("driver_id", auth.identity.id).is("signed_out_at", null);
    if (error) return NextResponse.json({ ok: false, error: "Sign-out could not be completed. Try again." }, { status: 500 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DRIVER_MOBILE_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
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
