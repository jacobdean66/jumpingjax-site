import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import {
  META_AD_ANALYTICS_OAUTH_TARGET_ID,
  META_OAUTH_PURPOSE_COOKIE,
  SOCIAL_OAUTH_INTENT_TTL_MS,
} from "@/lib/social-posts/oauth/social-oauth-config";
import { createMetaOAuthConnectIntent } from "@/lib/social-posts/oauth/social-oauth-service";

function failRedirect(req: NextRequest, code: string) {
  const redirectUrl = new URL("/admin/ad-analytics", req.url);
  redirectUrl.searchParams.set("oauth", "connect_failed");
  redirectUrl.searchParams.set("oauth_error", code);
  return NextResponse.redirect(redirectUrl, { status: 303 });
}

async function startAnalyticsConnect(req: NextRequest) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.reason === "missing_config"
            ? "Admin login is not configured."
            : "Owner authentication required.",
      },
      {
        status: auth.reason === "missing_config" ? 503 : 401,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  const connect = await createMetaOAuthConnectIntent({
    publicationTargetId: META_AD_ANALYTICS_OAUTH_TARGET_ID,
    adminActorId: auth.identity.id,
    purpose: "ad_analytics",
  });

  if (!connect.ok) {
    return failRedirect(req, connect.code);
  }

  const response = NextResponse.redirect(connect.authorizeUrl, { status: 302 });
  response.cookies.set({
    name: META_OAUTH_PURPOSE_COOKIE,
    value: "ad_analytics",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: Math.floor(SOCIAL_OAUTH_INTENT_TTL_MS / 1000),
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(req: NextRequest) {
  return startAnalyticsConnect(req);
}

export async function POST(req: NextRequest) {
  return startAnalyticsConnect(req);
}
