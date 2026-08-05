import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { setInventoryPublicVisibility } from "@/lib/admin/inventory";

function checkboxValue(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

function inventoryRedirect(
  req: NextRequest,
  token: string,
  params: {
    item?: string;
    category?: string;
    message?: string;
    error?: string;
  },
) {
  const search = new URLSearchParams({ token });
  if (params.item) search.set("item", params.item);
  if (params.category) search.set("category", params.category);
  if (params.message) search.set("message", params.message);
  if (params.error) search.set("error", params.error);
  return NextResponse.redirect(
    new URL(`/admin/inventory?${search.toString()}`, req.url),
    { status: 303 },
  );
}

/**
 * Toggle website approval only.
 * Approved items stay in admin inventory; they are never deleted here.
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const token = String(formData.get("token") ?? "");
  const id = String(formData.get("id") ?? "");
  const category = String(formData.get("category") ?? "").trim();
  const publicVisible = checkboxValue(formData.get("publicVisible"));
  const auth = await verifyAdminOwnerAccess();

  if (!auth.ok) {
    return NextResponse.json({ error: "Invalid admin token" }, { status: 401 });
  }

  try {
    const saved = await setInventoryPublicVisibility({
      id,
      publicVisible,
    });

    revalidatePath("/admin/inventory");
    revalidatePath("/rentals");
    revalidatePath(`/rentals/${saved.categoryId}`);
    revalidatePath(`/rentals/${saved.categoryId}/${saved.slug}`);

    return inventoryRedirect(req, token, {
      item: saved.id,
      category: category || saved.categoryId,
      message: publicVisible
        ? "Item approved for the public website. It is still in inventory."
        : "Item removed from the public website. It is still in inventory.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Website visibility update failed";
    return inventoryRedirect(req, token, {
      item: id || undefined,
      category: category || undefined,
      error: message,
    });
  }
}
