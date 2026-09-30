import { NextResponse } from "next/server";
import { loadDriverMobileLocationSnapshots } from "@/lib/admin/driver-location";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: "Owner access required" },
      { status: 401 },
    );
  }

  const locations = await loadDriverMobileLocationSnapshots();
  return NextResponse.json({ ok: true, locations });
}
