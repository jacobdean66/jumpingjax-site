import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import {
  normalizeInventorySlug,
  saveInventoryItem,
} from "@/lib/admin/inventory";
import { isInlineImageDataUrl } from "@/lib/admin/inventory-image-constants";
import type { RentalMedia } from "@/data/rentals";
import {
  normalizeBlowerRequirements,
  parsePositiveDimension,
  type CleaningSupply,
  type DimensionConfidence,
  type DimensionUnit,
} from "@/lib/admin/inventory-ops";

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

function parseBlowerRequirementsField(value: FormDataEntryValue | null): unknown {
  const raw = String(value ?? "[]").trim() || "[]";
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Blower requirements payload is invalid.");
  }
}

function optionalDimensionConfidence(
  value: FormDataEntryValue | null,
): DimensionConfidence | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return raw as DimensionConfidence;
}

function parseMediaField(value: FormDataEntryValue | null): RentalMedia[] {
  const raw = String(value ?? "[]").trim() || "[]";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Rental media details are invalid. Refresh and try again.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Rental media details are invalid. Refresh and try again.");
  }
  return parsed.map((value, index) => {
    const item = value as Record<string, unknown>;
    const mediaType = item.mediaType === "video" ? "video" : "image";
    const url = String(item.url ?? "").trim();
    if (!url || url.toLowerCase().startsWith("data:")) {
      throw new Error("Rental media must be uploaded directly to storage first.");
    }
    return {
      id: String(item.id ?? `new:${index}`),
      mediaType,
      url,
      altText: String(item.altText ?? ""),
      caption: String(item.caption ?? ""),
      sortOrder: index,
      isCover: item.isCover === true,
      posterUrl: String(item.posterUrl ?? "").trim() || null,
    };
  });
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const token = String(formData.get("token") ?? "");
  const auth = await verifyAdminOwnerAccess();

  if (!auth.ok) {
    return NextResponse.json({ error: "Invalid admin token" }, { status: 401 });
  }

  try {
    // Images must upload directly to storage via signed URL before Save.
    // Reject any file bytes here so large photos cannot hit Vercel's 413 limit.
    if (fileValue(formData.get("imageFile"))) {
      throw new Error(
        "Photo uploads must go directly to storage. Refresh the inventory page and try again.",
      );
    }
    if (formData.getAll("mediaFiles").some((value) => fileValue(value))) {
      throw new Error(
        "Photo and video uploads must go directly to storage. Refresh the inventory page and try again.",
      );
    }

    const title = String(formData.get("title") ?? "");
    const slug = normalizeInventorySlug(String(formData.get("slug") ?? ""), title);
    const imageSrc = String(formData.get("imageSrc") ?? "").trim();
    if (isInlineImageDataUrl(imageSrc)) {
      throw new Error(
        "Inline image data is not allowed. Upload the photo to storage first.",
      );
    }

    const categoryId = String(formData.get("categoryId") ?? "");
    const publicVisible = checkboxValue(formData.get("publicVisible"));
    const saved = await saveInventoryItem({
      id: String(formData.get("id") ?? "") || undefined,
      slug,
      categoryId,
      title,
      shortDescription: String(formData.get("shortDescription") ?? ""),
      description: String(formData.get("description") ?? ""),
      startingPrice: numberValue(formData.get("startingPrice"), 0),
      imageSrc,
      imageAlt: String(formData.get("imageAlt") ?? ""),
      media: parseMediaField(formData.get("mediaJson")),
      ageRecommendation: String(formData.get("ageRecommendation") ?? ""),
      setupRequirements: String(formData.get("setupRequirements") ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      routeKind: String(formData.get("routeKind") ?? ""),
      estimatedSetupMinutes: numberValue(formData.get("estimatedSetupMinutes"), 45),
      isActive: checkboxValue(formData.get("isActive")),
      publicVisible,
      blowerRequirements: normalizeBlowerRequirements(
        parseBlowerRequirementsField(formData.get("blowerRequirements")),
      ),
      tarpRequirement: String(formData.get("tarpRequirement") ?? ""),
      cleaningSupply: String(formData.get("cleaningSupply") ?? "") as CleaningSupply,
      lengthFt: parsePositiveDimension(String(formData.get("lengthFt") ?? "")),
      widthFt: parsePositiveDimension(String(formData.get("widthFt") ?? "")),
      heightFt: parsePositiveDimension(String(formData.get("heightFt") ?? "")),
      dimensionUnit: String(formData.get("dimensionUnit") ?? "ft") as DimensionUnit,
      dimensionSourceText: String(formData.get("dimensionSourceText") ?? ""),
      dimensionSourceUrl: String(formData.get("dimensionSourceUrl") ?? ""),
      dimensionManufacturer: String(formData.get("dimensionManufacturer") ?? ""),
      dimensionConfidence: optionalDimensionConfidence(
        formData.get("dimensionConfidence"),
      ),
      dimensionResearchNotes: String(formData.get("dimensionResearchNotes") ?? ""),
    });

    revalidatePath("/admin/inventory");
    revalidatePath("/rentals");
    revalidatePath(`/rentals/${saved.categoryId}`);
    revalidatePath(`/rentals/${saved.categoryId}/${saved.slug}`);

    const params = new URLSearchParams({
      token,
      item: saved.id,
      category: saved.categoryId,
      message: publicVisible
        ? "Inventory item saved and approved for the public website. It is still in inventory."
        : "Inventory item saved. It is still in inventory.",
    });

    return NextResponse.redirect(
      new URL(`/admin/inventory?${params.toString()}`, req.url),
      { status: 303 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inventory save failed";
    const params = new URLSearchParams({
      token,
      error: message,
    });
    const existingId = String(formData.get("id") ?? "").trim();
    const categoryId = String(formData.get("categoryId") ?? "").trim();
    if (existingId) params.set("item", existingId);
    if (categoryId) params.set("category", categoryId);
    return NextResponse.redirect(
      new URL(`/admin/inventory?${params.toString()}`, req.url),
      { status: 303 },
    );
  }
}
