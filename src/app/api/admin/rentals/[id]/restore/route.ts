import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/admin";

type RestoreResult = {
  outcome?: string;
  booking_id?: string;
  status?: string;
  item?: string;
  date?: string;
};

function conflictMessage(result: RestoreResult): string {
  const item = result.item?.trim() || "A rental item";
  const date = result.date?.trim() || "one of the rental dates";
  if (result.outcome === "inventory_unavailable") {
    return `${item} is currently hidden or unavailable. The rental remains cancelled.`;
  }
  return `${item} is unavailable on ${date}. The rental remains cancelled.`;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(req, {
    scope: "admin-rental-restore",
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: "Owner authentication required." },
      { status: auth.reason === "missing_config" ? 503 : 401 },
    );
  }

  const { id } = await context.params;
  if (!/^[0-9a-z-]{1,128}$/i.test(id)) {
    return NextResponse.json(
      { ok: false, message: "Invalid rental ID." },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc(
    "restore_cancelled_rental_atomic",
    { p_booking_id: id },
  );

  if (error) {
    console.error("[api/admin/rentals/restore] atomic restore failed", {
      code: error.code,
    });
    const migrationMissing =
      error.code === "PGRST202" ||
      error.message.toLowerCase().includes("restore_cancelled_rental_atomic");
    return NextResponse.json(
      {
        ok: false,
        message: migrationMissing
          ? "Rental restore is not enabled in the database yet. The rental remains cancelled."
          : "The restore check could not complete. The rental remains cancelled.",
      },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const result = (data ?? {}) as RestoreResult;
  if (
    result.outcome === "booking_conflict" ||
    result.outcome === "inventory_unavailable"
  ) {
    return NextResponse.json(
      { ok: false, message: conflictMessage(result), conflict: result },
      { status: 409, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  if (result.outcome === "not_found") {
    return NextResponse.json(
      { ok: false, message: "Rental not found." },
      { status: 404 },
    );
  }
  if (result.outcome === "missing_items") {
    return NextResponse.json(
      {
        ok: false,
        message:
          "This legacy rental has no reliable stored items, so it cannot be restored safely.",
      },
      { status: 409 },
    );
  }
  if (result.outcome === "invalid_status") {
    return NextResponse.json(
      {
        ok: false,
        message: `This rental is ${result.status ?? "not cancelled"} and was not changed.`,
      },
      { status: 409 },
    );
  }
  if (result.outcome !== "restored" && result.outcome !== "already_restored") {
    return NextResponse.json(
      { ok: false, message: "The rental was not restored." },
      { status: 500 },
    );
  }

  revalidatePath("/admin/rentals");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin/deliveries");
  revalidatePath("/driver");

  return NextResponse.json(
    {
      ok: true,
      alreadyRestored: result.outcome === "already_restored",
      message:
        result.outcome === "already_restored"
          ? "This rental was already restored and remains pending approval."
          : "Rental restored to pending and returned to operations unassigned.",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
