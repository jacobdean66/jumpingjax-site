import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/session";
import { canAccessMailbox, isEmailAccount, isEmailFolder } from "@/lib/email/dashboard-core";
import { loadEmailPage } from "@/lib/email/dashboard-service";
import { isMailId } from "@/lib/email/office-inbox";
import { isGmailPageToken } from "@/lib/email/gmail-core";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: NextRequest) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return NextResponse.json({ error: "Staff sign-in required." }, { status: 401, headers });
  const account = request.nextUrl.searchParams.get("account"), folder = request.nextUrl.searchParams.get("folder");
  if (!isEmailAccount(account) || !isEmailFolder(folder)) return NextResponse.json({ error: "Choose a valid email account and folder." }, { status: 400, headers });
  if (!canAccessMailbox(auth.role, account)) return NextResponse.json({ error: "Owner access required for Karen’s Gmail." }, { status: 403, headers });
  const cursor = request.nextUrl.searchParams.get("cursor") || "";
  if (cursor && !(account === "office" ? isMailId(cursor) : isGmailPageToken(cursor))) return NextResponse.json({ error: "Invalid email page." }, { status: 400, headers });
  try { return NextResponse.json(await loadEmailPage(account, folder, cursor, AbortSignal.any([request.signal, AbortSignal.timeout(45_000)])), { headers }); }
  catch { return NextResponse.json({ error: "Emails could not be loaded. Refresh this account or reconnect it." }, { status: 502, headers }); }
}
