import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import {
  META_OAUTH_PURPOSE_COOKIE,
  SOCIAL_OAUTH_INTENT_TTL_MS,
} from "@/lib/social-posts/oauth/social-oauth-config";
import { createMetaOAuthConnectIntent } from "@/lib/social-posts/oauth/social-oauth-service";

function withPurposeCookie(response: NextResponse) {
  response.cookies.set({
    name: META_OAUTH_PURPOSE_COOKIE,
    value: "publication",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: Math.floor(SOCIAL_OAUTH_INTENT_TTL_MS / 1000),
  });
  return response;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const publicationTargetId = req.nextUrl.searchParams.get("publication_target_id");

  const auth = await verifyAdminOwnerAccess(token);
  if (!auth.ok) {
    return NextResponse.json({ error: "Owner authorization required." }, { status: 401 });
  }

  if (!publicationTargetId?.trim()) {
    return NextResponse.json(
      { error: "publication_target_id is required." },
      { status: 400 },
    );
  }

  const connect = await createMetaOAuthConnectIntent({
    publicationTargetId: publicationTargetId.trim(),
    adminActorId: auth.identity.id,
    purpose: "publication",
  });

  if (!connect.ok) {
    const redirectUrl = new URL("/admin/social-posts/publication-execution", req.url);
    if (token) redirectUrl.searchParams.set("token", token);
    redirectUrl.searchParams.set("oauth", "connect_failed");
    redirectUrl.searchParams.set("oauth_error", connect.code);
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  return withPurposeCookie(NextResponse.redirect(connect.authorizeUrl, { status: 302 }));
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const token = String(formData.get("token") ?? "");
  const publicationTargetId = String(formData.get("publication_target_id") ?? "");

  const auth = await verifyAdminOwnerAccess(token);
  if (!auth.ok) {
    return NextResponse.json({ error: "Owner authorization required." }, { status: 401 });
  }

  if (!publicationTargetId.trim()) {
    return NextResponse.json(
      { error: "publication_target_id is required." },
      { status: 400 },
    );
  }

  const connect = await createMetaOAuthConnectIntent({
    publicationTargetId: publicationTargetId.trim(),
    adminActorId: auth.identity.id,
    purpose: "publication",
  });

  if (!connect.ok) {
    const redirectUrl = new URL("/admin/social-posts/publication-execution", req.url);
    if (token) redirectUrl.searchParams.set("token", token);
    redirectUrl.searchParams.set("oauth", "connect_failed");
    redirectUrl.searchParams.set("oauth_error", connect.code);
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  return withPurposeCookie(NextResponse.redirect(connect.authorizeUrl, { status: 302 }));
}
