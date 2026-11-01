import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/session";
import { canAccessMailbox, isEmailAccount, isEmailFolder, isEmailId } from "@/lib/email/dashboard-core";
import { loadEmailDetail } from "@/lib/email/dashboard-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: NextRequest) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return NextResponse.json({ error: "Staff sign-in required." }, { status: 401, headers });
  const account = request.nextUrl.searchParams.get("account"), folder = request.nextUrl.searchParams.get("folder"), id = request.nextUrl.searchParams.get("id");
  if (!isEmailAccount(account) || !isEmailFolder(folder) || !isEmailId(account, id)) return NextResponse.json({ error: "Invalid email." }, { status: 400, headers });
  if (!canAccessMailbox(auth.role, account)) return NextResponse.json({ error: "Owner access required for Karen’s Gmail." }, { status: 403, headers });
  try {
    const message = await loadEmailDetail(account, folder, id);
    return message ? NextResponse.json({ message }, { headers }) : NextResponse.json({ error: "Email not found in this account." }, { status: 404, headers });
  } catch { return NextResponse.json({ error: "This email could not be loaded. Please try again." }, { status: 502, headers }); }
}
