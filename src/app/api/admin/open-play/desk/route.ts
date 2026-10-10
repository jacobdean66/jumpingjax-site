import { NextResponse } from "next/server";
import { requireStaffAuth, publicSafeError } from "@/lib/open-play/staff-auth";
import { businessDayYmdFromInstant } from "@/lib/open-play/business-day";
import { DeskValidationError, loadDeskState, runDeskCommand } from "@/lib/open-play/desk-service";
import { rateLimit } from "@/lib/rate-limit";
import { isYmd } from "@/lib/open-play/pricing";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(req: Request) {
  const auth = await requireStaffAuth();
  if (!auth.ok) return auth.response;
  const day = new URL(req.url).searchParams.get("date") ?? businessDayYmdFromInstant(new Date());
  try { return NextResponse.json({ ok: true, state: await loadDeskState(day) }, { headers }); }
  catch { return publicSafeError("desk_unavailable", 503, "Unable to load attendance and tickets. Refresh to try again."); }
}

export async function POST(req: Request) {
  const auth = await requireStaffAuth();
  if (!auth.ok) return auth.response;
  const limited = rateLimit(req, { scope: "admin-open-play-desk", limit: 1200, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return publicSafeError("validation", 400, "Invalid request."); }
  if (!body || typeof body !== "object" || typeof body.action !== "string" || !["mark_here", "depart", "create_ticket", "add", "edit", "remove", "pay", "payer", "void_payment", "complete_checkout", "correct_checkin", "delete_checkin"].includes(body.action)) {
    return publicSafeError("validation", 400, "Choose a valid desk action.");
  }
  if (body.action === "void_payment" && auth.auth.role !== "owner") return publicSafeError("forbidden", 403, "Owner access is required to void a saved receipt.");
  if (["correct_checkin", "delete_checkin"].includes(body.action) && auth.auth.role !== "owner") return publicSafeError("forbidden", 403, "Owner access is required to correct or delete a saved check-in.");
  // Saved check-in corrections may also apply to a selected historical date.
  const today = businessDayYmdFromInstant(new Date());
  const day = ["void_payment", "correct_checkin", "delete_checkin"].includes(body.action) && typeof body.date === "string" && isYmd(body.date) && body.date <= today ? body.date : today;
  if (body.date !== day) return publicSafeError("validation", 400, "The business day changed. Refresh before saving.");
  try {
    const result = await runDeskCommand(day, body.action, auth.auth.identity.id, body);
    // Return the saved identifiers first. A later read failure must not disguise a successful write.
    return NextResponse.json({ ok: true, result }, { headers });
  } catch (error) {
    return publicSafeError(error instanceof DeskValidationError ? "validation" : "desk_unavailable", error instanceof DeskValidationError ? 400 : 503,
      error instanceof DeskValidationError ? error.message : "Unable to save. Refresh to check the saved state before retrying.");
  }
}
