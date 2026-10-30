import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/session";
import { officeAttachment } from "@/lib/email/office-inbox";

export async function GET(_request: Request, context: { params: Promise<{ id: string; attachmentId: string }> }) {
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
  const auth = await verifyAdminAccess();
  if (!auth.ok) return NextResponse.json({ message: "Admin authentication required." }, { status: 401, headers });
  const { id, attachmentId } = await context.params;
  try {
    const url = await officeAttachment(id, attachmentId);
    if (!url) return NextResponse.json({ message: "Attachment not found." }, { status: 404, headers });
    return new Response(null, { status: 303, headers: { ...headers, Location: url } });
  } catch {
    return NextResponse.json({ message: "Attachment could not be loaded. Please try again." }, { status: 503, headers });
  }
}
