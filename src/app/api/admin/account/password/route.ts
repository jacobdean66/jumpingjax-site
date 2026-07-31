import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/delivery-auth";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { changeAdminStaffPassword } from "@/lib/admin/staff-users";

export async function POST(req: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: "Owner access required." }, { status: 401 });
  }

  let body: {
    currentPassword?: unknown;
    newPassword?: unknown;
    confirmPassword?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const currentPassword =
    typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  const confirmPassword =
    typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { ok: false, message: "New password and confirmation do not match." },
      { status: 400 },
    );
  }

  try {
    await changeAdminStaffPassword({
      id: auth.identity.id,
      currentPassword,
      newPassword,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Password could not be changed.",
      },
      { status: 400 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    message: "Password changed. Sign in again with the new password.",
  });
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
