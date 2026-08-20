import { NextResponse } from "next/server";
import {
  createDriverSessionValue,
  DRIVER_SESSION_COOKIE,
  verifyDriverLogin,
} from "@/lib/admin/driver-auth";

export async function POST(req: Request) {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const auth = await verifyDriverLogin({
    username: typeof body.username === "string" ? body.username : "",
    password: typeof body.password === "string" ? body.password : "",
  });

  if (!auth.ok) {
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
  const response = NextResponse.json({ ok: true });
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
