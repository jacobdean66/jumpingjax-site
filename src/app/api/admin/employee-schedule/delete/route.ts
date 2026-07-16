import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { deleteEmployeeShift } from "@/lib/admin/employee-shifts";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const token = String(form.get("token") ?? "");
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) {
    return NextResponse.json({ error: "Invalid owner login" }, { status: 401 });
  }

  try {
    await deleteEmployeeShift(String(form.get("id") ?? ""));
    revalidatePath("/admin/employee-schedule");
    return NextResponse.redirect(
      new URL(
        `/admin/employee-schedule?token=${encodeURIComponent(token)}&message=${encodeURIComponent("Shift deleted")}`,
        req.url,
      ),
      { status: 303 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shift could not be deleted";
    return NextResponse.redirect(
      new URL(
        `/admin/employee-schedule?token=${encodeURIComponent(token)}&error=${encodeURIComponent(message)}`,
        req.url,
      ),
      { status: 303 },
    );
  }
}
