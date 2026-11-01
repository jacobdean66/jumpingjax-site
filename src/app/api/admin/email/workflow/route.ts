import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/session";
import { canAccessMailbox, parseWorkflowChange } from "@/lib/email/dashboard-core";
import { loadEmailDetail } from "@/lib/email/dashboard-service";
import { saveEmailWorkflow } from "@/lib/email/dashboard-store";

export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
export async function PATCH(request: NextRequest) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return NextResponse.json({ error: "Staff sign-in required." }, { status: 401, headers });
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Same-origin request required." }, { status: 403, headers });
  let change;
  try {
    const body = await request.text();
    if (body.length > 4096) return NextResponse.json({ error: "Email update is too large." }, { status: 413, headers });
    change = parseWorkflowChange(JSON.parse(body));
  } catch { return NextResponse.json({ error: "Invalid email update." }, { status: 400, headers }); }
  if (!change) return NextResponse.json({ error: "Invalid email update." }, { status: 400, headers });
  if (!canAccessMailbox(auth.role, change.account)) return NextResponse.json({ error: "Owner access required for Karen’s Gmail." }, { status: 403, headers });
  try {
    // Validate provider membership again; guessed IDs cannot create annotations for another mailbox.
    if (!await loadEmailDetail(change.account, change.folder, change.id)) return NextResponse.json({ error: "Email not found in this account." }, { status: 404, headers });
    await saveEmailWorkflow(change, auth.identity.id);
    return NextResponse.json({ saved: true }, { headers });
  } catch { return NextResponse.json({ error: "This change was not saved. Please try again." }, { status: 503, headers }); }
}
