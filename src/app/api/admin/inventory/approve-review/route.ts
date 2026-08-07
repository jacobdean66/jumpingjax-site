import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { approveInventoryItemsForWebsite } from "@/lib/admin/inventory";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";

function inventoryRedirect(
  req: NextRequest,
  token: string,
  params: {
    category?: string;
    visibility?: string;
    message?: string;
    error?: string;
  },
) {
  const search = new URLSearchParams({ token });
  if (params.category) search.set("category", params.category);
  if (params.visibility) search.set("visibility", params.visibility);
  if (params.message) search.set("message", params.message);
  if (params.error) search.set("error", params.error);
  return NextResponse.redirect(
    new URL(`/admin/inventory?${search.toString()}`, req.url),
    { status: 303 },
  );
}

/**
 * Approve one or more review items for the public website.
 * Approved items stay in admin inventory; they are never deleted here.
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const token = String(formData.get("token") ?? "");
  const category = String(formData.get("category") ?? "").trim();
  const visibility = String(formData.get("visibility") ?? "").trim();
  const ids = formData
    .getAll("ids")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const auth = await verifyAdminOwnerAccess();

  if (!auth.ok) {
    return NextResponse.json({ error: "Invalid admin token" }, { status: 401 });
  }

  try {
    const result = await approveInventoryItemsForWebsite(ids);

    revalidatePath("/admin/inventory");
    revalidatePath("/rentals");
    for (const item of result.items) {
      revalidatePath(`/rentals/${item.categoryId}`);
      revalidatePath(`/rentals/${item.categoryId}/${item.slug}`);
    }

    return inventoryRedirect(req, token, {
      category: category || undefined,
      visibility: visibility || "review",
      message:
        result.approvedCount === 1
          ? "1 item approved for the public website. It is still in inventory."
          : `${result.approvedCount} items approved for the public website. They are still in inventory.`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Website approval failed";
    return inventoryRedirect(req, token, {
      category: category || undefined,
      visibility: visibility || "review",
      error: message,
    });
  }
}
