import { NextResponse } from "next/server";

import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionValue,
  verifyAdminDeliveryToken,
} from "@/lib/admin/delivery-auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const auth = verifyAdminDeliveryToken(url.searchParams.get("token"));
  if (!auth.ok) {
    return NextResponse.redirect(new URL("/admin", req.url), 303);
  }

  const sessionValue = createAdminSessionValue(auth.identity);
  if (!sessionValue) {
    return NextResponse.json({ error: "Admin session is unavailable" }, { status: 503 });
  }

  const requestedReturn = url.searchParams.get("return_to") ?? "/admin";
  const returnTo =
    requestedReturn.startsWith("/admin") && !requestedReturn.startsWith("//")
      ? requestedReturn
      : "/admin";
  const response = NextResponse.redirect(new URL(returnTo, req.url), 303);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
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
