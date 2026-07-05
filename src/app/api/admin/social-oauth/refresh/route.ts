import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { refreshMetaOAuthTokenForPublicationTarget } from "@/lib/social-posts/oauth/social-oauth-token-refresh-service";
import { validateManualTokenRefreshRequest } from "@/lib/social-posts/oauth/social-oauth-token-refresh-request";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const token = String(formData.get("token") ?? "");
  const publicationTargetId = String(formData.get("publication_target_id") ?? "");

  const auth = await verifyAdminOwnerAccess(token);
  if (!auth.ok) {
    return NextResponse.json({ error: "Owner authorization required." }, { status: 401 });
  }

  const validation = validateManualTokenRefreshRequest({ publicationTargetId });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  const refresh = await refreshMetaOAuthTokenForPublicationTarget({
    publicationTargetId: validation.publicationTargetId,
    adminActorId: auth.identity.id,
  });

  const redirectUrl = new URL("/admin/social-posts/publication-execution", req.url);
  if (token) redirectUrl.searchParams.set("token", token);
  redirectUrl.searchParams.set("publicationTargetId", validation.publicationTargetId);

  if (!refresh.ok) {
    redirectUrl.searchParams.set("oauth_refresh", "refresh_failed");
    redirectUrl.searchParams.set("oauth_refresh_error", refresh.code);
    redirectUrl.searchParams.set("oauth_refresh_message", refresh.message);
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  redirectUrl.searchParams.set("oauth_refresh", "refreshed");
  redirectUrl.searchParams.set("oauth_refresh_mode", refresh.refreshMode);
  return NextResponse.redirect(redirectUrl, { status: 303 });
}
