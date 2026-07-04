import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { bindDiscoveredMetaAssetToPublicationTarget } from "@/lib/social-posts/oauth/social-meta-asset-binding-service";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const token = String(formData.get("token") ?? "");
  const publicationTargetId = String(formData.get("publication_target_id") ?? "");
  const discoveredAssetId = String(formData.get("discovered_asset_id") ?? "");

  const auth = await verifyAdminOwnerAccess(token);
  if (!auth.ok) {
    return NextResponse.json({ error: "Owner authorization required." }, { status: 401 });
  }

  if (!publicationTargetId.trim() || !discoveredAssetId.trim()) {
    return NextResponse.json(
      { error: "publication_target_id and discovered_asset_id are required." },
      { status: 400 },
    );
  }

  const binding = await bindDiscoveredMetaAssetToPublicationTarget({
    publicationTargetId: publicationTargetId.trim(),
    discoveredAssetId: discoveredAssetId.trim(),
    adminActorId: auth.identity.id,
  });

  const redirectUrl = new URL("/admin/social-posts/publication-execution", req.url);
  if (token) redirectUrl.searchParams.set("token", token);
  redirectUrl.searchParams.set("publicationTargetId", publicationTargetId.trim());

  if (!binding.ok) {
    redirectUrl.searchParams.set("meta_assets", "bind_failed");
    redirectUrl.searchParams.set("meta_assets_error", binding.code);
    redirectUrl.searchParams.set("meta_assets_message", binding.message);
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  redirectUrl.searchParams.set("meta_assets", "bound");
  redirectUrl.searchParams.set("meta_assets_binding_id", binding.bindingId);
  return NextResponse.redirect(redirectUrl, { status: 303 });
}
