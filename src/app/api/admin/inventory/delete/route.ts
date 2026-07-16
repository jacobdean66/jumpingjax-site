import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { deleteInventoryItem } from "@/lib/admin/inventory";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const token = String(formData.get("token") ?? "");
  const id = String(formData.get("id") ?? "");
  const auth = await verifyAdminOwnerAccess(token);

  if (!auth.ok) {
    return NextResponse.json({ error: "Invalid admin token" }, { status: 401 });
  }

  try {
    await deleteInventoryItem(id);
    revalidatePath("/admin/inventory");
    return NextResponse.redirect(
      new URL(
        `/admin/inventory?token=${encodeURIComponent(token)}&message=${encodeURIComponent("Inventory item deleted")}`,
        req.url,
      ),
      { status: 303 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inventory delete failed";
    return NextResponse.redirect(
      new URL(
        `/admin/inventory?token=${encodeURIComponent(token)}&error=${encodeURIComponent(message)}`,
        req.url,
      ),
      { status: 303 },
    );
  }
}
