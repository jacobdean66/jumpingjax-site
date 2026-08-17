import { NextRequest, NextResponse } from "next/server";
import { normalizeInventorySlug } from "@/lib/admin/inventory";
import { isWebSafeInventoryImageUpload } from "@/lib/admin/inventory-image-constants";
import { createInventoryImageSignedUpload } from "@/lib/admin/inventory-image-upload";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";

export async function POST(req: NextRequest) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) {
    return NextResponse.json({ error: "Invalid admin token" }, { status: 401 });
  }

  let body: {
    fileName?: string;
    slug?: string;
    title?: string;
    contentType?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fileName = String(body.fileName ?? "").trim();
  if (!fileName) {
    return NextResponse.json({ error: "fileName is required" }, { status: 400 });
  }

  const contentType = String(body.contentType ?? "").trim().toLowerCase();
  if (contentType && !contentType.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image uploads are allowed." },
      { status: 400 },
    );
  }
  if (
    !isWebSafeInventoryImageUpload({
      fileName,
      contentType,
    })
  ) {
    return NextResponse.json(
      {
        error:
          "Use a JPG, PNG, WEBP, or GIF photo. iPhone HEIC photos will not show on the website — choose \"Most Compatible\" or export as JPG first.",
      },
      { status: 400 },
    );
  }

  try {
    const slug = normalizeInventorySlug(
      String(body.slug ?? ""),
      String(body.title ?? fileName),
    );
    const upload = await createInventoryImageSignedUpload({ slug, fileName });
    return NextResponse.json({
      bucket: upload.bucket,
      path: upload.path,
      token: upload.token,
      signedUrl: upload.signedUrl,
      publicUrl: upload.publicUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not prepare image upload";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
