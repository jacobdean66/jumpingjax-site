import { NextRequest, NextResponse } from "next/server";
import { handleMetaOAuthCallback } from "@/lib/social-posts/oauth/social-oauth-service";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const result = await handleMetaOAuthCallback({
    oauthState: search.get("state"),
    authorizationCode: search.get("code"),
    error: search.get("error"),
    errorReason: search.get("error_reason") ?? search.get("error_description"),
  });

  const redirectUrl = new URL(result.redirectPath, req.url);
  const token = search.get("token");
  if (token) redirectUrl.searchParams.set("token", token);
  if (!result.ok) {
    redirectUrl.searchParams.set("oauth_message", result.message);
  }

  return NextResponse.redirect(redirectUrl, { status: 303 });
}
