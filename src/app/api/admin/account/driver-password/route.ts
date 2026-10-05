import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { saveDriverPassword } from "@/lib/admin/driver-accounts";

export async function POST(req: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: "Owner access required." }, { status: 401 });
  }
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) {
    return NextResponse.json({ ok: false, message: "Invalid request origin." }, { status: 403 });
  }
  if (!req.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return NextResponse.json({ ok: false, message: "JSON request required." }, { status: 415 });
  }

  let body: { driverName?: unknown; newPassword?: unknown; confirmPassword?: unknown };
  try {
    body = await req.json();
    if (!body || typeof body !== "object") throw new Error("Invalid body");
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const driverName = typeof body.driverName === "string" ? body.driverName : "";
  const password = typeof body.newPassword === "string" ? body.newPassword : "";
  if (password !== body.confirmPassword) {
    return NextResponse.json({ ok: false, message: "New password and confirmation do not match." }, { status: 400 });
  }

  try {
    const name = await saveDriverPassword({ driverName, password });
    revalidatePath("/admin/account/password");
    return NextResponse.json({ ok: true, message: `Driver password saved for ${name}.` });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : "Driver password could not be saved.",
    }, { status: 400 });
  }
}
