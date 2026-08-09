import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { discoverMetaAssetsForPublicationTarget } from "@/lib/social-posts/oauth/social-meta-asset-discovery-service";

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

  const discovery = await discoverMetaAssetsForPublicationTarget({
    publicationTargetId: publicationTargetId.trim(),
    adminActorId: auth.identity.id,
  });

  const redirectUrl = new URL("/admin/social-posts/publication-execution", req.url);
  if (token) redirectUrl.searchParams.set("token", token);
  redirectUrl.searchParams.set("publicationTargetId", publicationTargetId.trim());

  if (!discovery.ok) {
    redirectUrl.searchParams.set("meta_assets", "discover_failed");
    redirectUrl.searchParams.set("meta_assets_error", discovery.code);
    redirectUrl.searchParams.set("meta_assets_message", discovery.message);
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  redirectUrl.searchParams.set("meta_assets", "discovered");
  redirectUrl.searchParams.set("meta_assets_pages", String(discovery.pageCount));
  redirectUrl.searchParams.set("meta_assets_instagram", String(discovery.instagramCount));
  redirectUrl.searchParams.set(
    "meta_page_tokens_vaulted",
    String(discovery.pageAccessTokensVaulted),
  );
  return NextResponse.redirect(redirectUrl, { status: 303 });
}
