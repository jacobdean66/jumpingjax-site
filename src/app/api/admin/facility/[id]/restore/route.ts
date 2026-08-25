import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/admin";

type RestoreResult = {
  outcome?: string;
  booking_id?: string;
  status?: string;
};

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(req, {
    scope: "admin-facility-restore",
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
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  ) {
    return NextResponse.json(
      { ok: false, message: "Invalid facility party ID." },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc(
    "restore_cancelled_facility_booking_atomic",
    { p_booking_id: id },
  );

  if (error) {
    console.error("[api/admin/facility/restore] atomic restore failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    const migrationMissing =
      error.code === "PGRST202" ||
      error.message
        .toLowerCase()
        .includes("restore_cancelled_facility_booking_atomic");
    return NextResponse.json(
      {
        ok: false,
        message: migrationMissing
          ? "Facility party restore is not enabled in the database yet. The party remains cancelled."
          : "The restore check could not complete. The party remains cancelled.",
      },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const result = (data ?? {}) as RestoreResult;
  if (result.outcome === "booking_conflict") {
    return NextResponse.json(
      {
        ok: false,
        message:
          "That facility time slot is no longer available. The party remains cancelled.",
        conflict: result,
      },
      { status: 409, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  if (result.outcome === "not_found") {
    return NextResponse.json(
      { ok: false, message: "Facility party not found." },
      { status: 404 },
    );
  }
  if (result.outcome === "invalid_status") {
    return NextResponse.json(
      {
        ok: false,
        message: `This facility party is ${result.status ?? "not cancelled"} and was not changed.`,
      },
      { status: 409 },
    );
  }
  if (result.outcome !== "restored" && result.outcome !== "already_restored") {
    return NextResponse.json(
      { ok: false, message: "The facility party was not restored." },
      { status: 500 },
    );
  }

  revalidatePath("/admin/facility");
  revalidatePath("/admin/schedule");
  revalidatePath("/facility-parties");

  return NextResponse.json(
    {
      ok: true,
      alreadyRestored: result.outcome === "already_restored",
      message:
        result.outcome === "already_restored"
          ? "This facility party was already restored and remains pending approval."
          : "Facility party restored to pending approval.",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
