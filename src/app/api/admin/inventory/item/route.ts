import { revalidatePath } from "next/cache";
import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import {
  normalizeInventorySlug,
  saveInventoryItem,
} from "@/lib/admin/inventory";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const INVENTORY_IMAGE_BUCKET = "rental-inventory-images";

function checkboxValue(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

function numberValue(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function fileValue(value: FormDataEntryValue | null): File | null {
  return value instanceof File && value.size > 0 ? value : null;
}

function safeFileName(value: string): string {
  const name = value.trim().toLowerCase() || "rental-image";
  return name
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function uploadInventoryImage(input: {
  file: File;
  slug: string;
}): Promise<string> {
  const supabase = createServiceRoleClient();

  const { error: bucketError } = await supabase.storage.createBucket(INVENTORY_IMAGE_BUCKET, {
    public: true,
  });
  if (bucketError && !bucketError.message.toLowerCase().includes("already")) {
    throw new Error(bucketError.message);
  }

  const extension = safeFileName(input.file.name).split(".").pop() ?? "jpg";
  const path = `${input.slug}/${Date.now()}.${extension}`;
  const bytes = Buffer.from(await input.file.arrayBuffer());

  const { error } = await supabase.storage
    .from(INVENTORY_IMAGE_BUCKET)
    .upload(path, bytes, {
      contentType: input.file.type || "application/octet-stream",
      upsert: true,
    });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage
    .from(INVENTORY_IMAGE_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const token = String(formData.get("token") ?? "");
  const auth = await verifyAdminOwnerAccess();

  if (!auth.ok) {
    return NextResponse.json({ error: "Invalid admin token" }, { status: 401 });
  }

  try {
    const title = String(formData.get("title") ?? "");
    const slug = normalizeInventorySlug(String(formData.get("slug") ?? ""), title);
    const imageFile = fileValue(formData.get("imageFile"));
    const imageSrc = imageFile
      ? await uploadInventoryImage({ file: imageFile, slug })
      : String(formData.get("imageSrc") ?? "");

    await saveInventoryItem({
      id: String(formData.get("id") ?? "") || undefined,
      slug,
      categoryId: String(formData.get("categoryId") ?? ""),
      title,
      shortDescription: String(formData.get("shortDescription") ?? ""),
      description: String(formData.get("description") ?? ""),
      startingPrice: numberValue(formData.get("startingPrice"), 0),
      imageSrc,
      imageAlt: String(formData.get("imageAlt") ?? ""),
      ageRecommendation: String(formData.get("ageRecommendation") ?? ""),
      setupRequirements: String(formData.get("setupRequirements") ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      routeKind: String(formData.get("routeKind") ?? ""),
      estimatedSetupMinutes: numberValue(formData.get("estimatedSetupMinutes"), 45),
      isActive: checkboxValue(formData.get("isActive")),
      publicVisible: checkboxValue(formData.get("publicVisible")),
    });

    revalidatePath("/admin/inventory");
    return NextResponse.redirect(
      new URL(
        `/admin/inventory?token=${encodeURIComponent(token)}&message=${encodeURIComponent("Inventory item saved")}`,
        req.url,
      ),
      { status: 303 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inventory save failed";
    return NextResponse.redirect(
      new URL(
        `/admin/inventory?token=${encodeURIComponent(token)}&error=${encodeURIComponent(message)}`,
        req.url,
      ),
      { status: 303 },
    );
  }
}
