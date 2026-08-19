import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionValue,
  verifyAdminLogin,
} from "@/lib/admin/delivery-auth";
import type { AdminStaffLoginAttempt } from "@/lib/admin/staff-users";
import { verifyAdminStaffLogin } from "@/lib/admin/staff-users";

export async function POST(req: Request) {
  let body: { username?: unknown; password?: unknown; token?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password =
    typeof body.password === "string"
      ? body.password
      : typeof body.token === "string"
        ? body.token
        : "";
  let staffAttempt: AdminStaffLoginAttempt = { configured: false, identity: null };

  if (username) {
    try {
      staffAttempt = await verifyAdminStaffLogin({ username, password });
    } catch (error) {
      console.warn("admin staff login lookup failed, falling back to static login", error);
    }
  }

  const legacyAuth = verifyAdminLogin(username || null, password || null);
  const auth = staffAttempt.identity ?? legacyAuth;

  if (!auth || ("ok" in auth && !auth.ok)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const authIdentity = "ok" in auth ? auth.identity : auth;
  const sessionValue = createAdminSessionValue(authIdentity);
  if (!sessionValue) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const response = NextResponse.json({
    ok: true,
    role: authIdentity.role,
    identity: authIdentity,
  });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
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
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
