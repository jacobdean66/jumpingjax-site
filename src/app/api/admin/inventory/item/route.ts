import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import {
  normalizeInventorySlug,
  saveInventoryItem,
} from "@/lib/admin/inventory";
import { isInlineImageDataUrl } from "@/lib/admin/inventory-image-constants";
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

    const title = String(formData.get("title") ?? "");
    const slug = normalizeInventorySlug(String(formData.get("slug") ?? ""), title);
    const imageSrc = String(formData.get("imageSrc") ?? "").trim();
    if (isInlineImageDataUrl(imageSrc)) {
      throw new Error(
        "Inline image data is not allowed. Upload the photo to storage first.",
      );
    }

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
