import { NextRequest, NextResponse } from "next/server";
import {
  META_OAUTH_PURPOSE_COOKIE,
  isSocialMetaOAuthPurpose,
} from "@/lib/social-posts/oauth/social-oauth-config";
import { handleMetaOAuthCallback } from "@/lib/social-posts/oauth/social-oauth-service";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const purposeCookie = req.cookies.get(META_OAUTH_PURPOSE_COOKIE)?.value;
  const purposeHint = isSocialMetaOAuthPurpose(purposeCookie)
    ? purposeCookie
    : null;

  const result = await handleMetaOAuthCallback({
    oauthState: search.get("state"),
    authorizationCode: search.get("code"),
    error: search.get("error"),
    errorReason: search.get("error_reason") ?? search.get("error_description"),
    purposeHint,
  });

  const redirectUrl = new URL(result.redirectPath, req.url);
  // Never forward OAuth codes/state/tokens into the destination.
  if (!result.ok) {
    redirectUrl.searchParams.set("oauth_message", result.message);
  }

  const response = NextResponse.redirect(redirectUrl, { status: 303 });
  response.cookies.set({
    name: META_OAUTH_PURPOSE_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
