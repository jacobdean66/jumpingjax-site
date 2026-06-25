import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/session";
import { SOCIAL_SOURCE_IMAGES } from "@/lib/social-posts/social-source-images";

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAccess(req.nextUrl.searchParams.get("token"));

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: "Invalid admin login" },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true, images: SOCIAL_SOURCE_IMAGES });
}
