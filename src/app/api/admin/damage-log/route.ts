import { NextResponse } from "next/server";
import { saveInventoryDamageReport } from "@/lib/admin/damage-reports";
import { verifyAdminAccess } from "@/lib/admin/session";

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  const form = await req.formData();
  const token = clean(form.get("token"));
  const auth = await verifyAdminAccess(token);

  if (!auth.ok) {
    return NextResponse.redirect(
      new URL(`/admin?error=${encodeURIComponent("Invalid admin login")}`, req.url),
      303,
    );
  }

  try {
    await saveInventoryDamageReport({
      reportedBy: clean(form.get("reportedBy")) || auth.identity.name,
      itemType: clean(form.get("itemType")) || "Other",
      itemName: clean(form.get("itemName")),
      issueSummary: clean(form.get("issueSummary")),
      severity: clean(form.get("severity")) || "Needs review",
      relatedBookingId: clean(form.get("relatedBookingId")),
      actionNeeded: clean(form.get("actionNeeded")),
      notes: clean(form.get("notes")),
    });

    const params = new URLSearchParams({
      token,
      message: "Damage report saved",
    });
    return NextResponse.redirect(
      new URL(`/admin/damage-log?${params.toString()}`, req.url),
      303,
    );
  } catch (error) {
    const params = new URLSearchParams({
      token,
      error: error instanceof Error ? error.message : "Damage report failed",
    });
    return NextResponse.redirect(
      new URL(`/admin/damage-log?${params.toString()}`, req.url),
      303,
    );
  }
}
