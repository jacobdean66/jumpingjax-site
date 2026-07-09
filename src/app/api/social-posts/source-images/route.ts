import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/session";
import {
  socialPostGetAuthErrorResponse,
  socialPostGetErrorResponse,
} from "@/lib/social-posts/social-post-get-api-response";
import { SOCIAL_SOURCE_IMAGES } from "@/lib/social-posts/social-source-images";

export async function GET(req: NextRequest) {
  const route = "/api/social-posts/source-images";

  try {
    const auth = await verifyAdminAccess(req.nextUrl.searchParams.get("token"));

    if (!auth.ok) {
      return socialPostGetAuthErrorResponse(route);
    }

    return NextResponse.json({ ok: true, images: SOCIAL_SOURCE_IMAGES });
  } catch (error) {
    return socialPostGetErrorResponse(error, route, 500, "source_images_failed");
  }
}
