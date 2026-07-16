import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { saveAdminStaffUser } from "@/lib/admin/staff-users";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const token = String(formData.get("token") ?? "");
  const auth = await verifyAdminOwnerAccess();

  if (!auth.ok) {
    return NextResponse.json({ error: "Invalid owner login" }, { status: 401 });
  }

  try {
    await saveAdminStaffUser({
      id: String(formData.get("id") ?? ""),
      username: String(formData.get("username") ?? ""),
      displayName: String(formData.get("displayName") ?? ""),
      password: String(formData.get("password") ?? ""),
      isActive: formData.get("isActive") === "on",
    });

    revalidatePath("/admin/staff");
    return NextResponse.redirect(
      new URL(
        `/admin/staff?token=${encodeURIComponent(token)}&message=${encodeURIComponent("Staff login saved")}`,
        req.url,
      ),
      { status: 303 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Staff login could not be saved";
    return NextResponse.redirect(
      new URL(
        `/admin/staff?token=${encodeURIComponent(token)}&error=${encodeURIComponent(message)}`,
        req.url,
      ),
      { status: 303 },
    );
  }
}
