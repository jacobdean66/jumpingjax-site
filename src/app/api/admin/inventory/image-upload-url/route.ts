import { NextRequest, NextResponse } from "next/server";
import { normalizeInventorySlug } from "@/lib/admin/inventory";
import { validateInventoryMediaUpload } from "@/lib/admin/inventory-media";
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
    fileSize?: number;
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
  let mediaType: "image" | "video";
  try {
    ({ mediaType } = validateInventoryMediaUpload({
      fileName,
      contentType,
      fileSize: Number(body.fileSize),
    }));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unsupported file." },
      { status: 400 },
    );
  }

  try {
    const slug = normalizeInventorySlug(
      String(body.slug ?? ""),
      String(body.title ?? fileName),
    );
    const upload = await createInventoryImageSignedUpload({
      slug,
      fileName,
      mediaType,
    });
    return NextResponse.json({
      bucket: upload.bucket,
      path: upload.path,
      token: upload.token,
      signedUrl: upload.signedUrl,
      publicUrl: upload.publicUrl,
      mediaType,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not prepare image upload";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
