import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { requireStaffAuth, publicSafeError } from "@/lib/open-play/staff-auth";
import { isYmd } from "@/lib/open-play/pricing";
import { findOpenPlayVisitConflicts } from "@/lib/open-play/visit-service";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const limited = rateLimit(req, {
    scope: "admin-open-play-visit-conflicts",
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const auth = await requireStaffAuth();
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return publicSafeError("invalid_json", 400, "Invalid JSON request body");
  }

  const visitDateYmd = typeof body.visitDate === "string" ? body.visitDate : "";
  if (!isYmd(visitDateYmd)) {
    return NextResponse.json(
      { ok: false, error: "visitDate must be YYYY-MM-DD", code: "validation" },
      { status: 400 },
    );
  }

  const participantIds = Array.isArray(body.participantIds)
    ? body.participantIds.filter((item): item is string => typeof item === "string")
    : [];
  if (participantIds.some((item) => !UUID_RE.test(item.trim()))) {
    return NextResponse.json(
      { ok: false, error: "participantIds must be UUID strings", code: "validation" },
      { status: 400 },
    );
  }
  const legacyParticipantIds = Array.isArray(body.legacyParticipantIds)
    ? body.legacyParticipantIds.filter((item): item is string => typeof item === "string")
    : [];
  if (legacyParticipantIds.some((item) => !UUID_RE.test(item.trim()))) {
    return NextResponse.json(
      { ok: false, error: "legacyParticipantIds must be UUID strings", code: "validation" },
      { status: 400 },
    );
  }

  try {
    const conflicts = await findOpenPlayVisitConflicts({
      visitDateYmd,
      participantIds,
      legacyParticipantIds,
    });
    return NextResponse.json(
      { ok: true, conflicts },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return publicSafeError("database", 503);
  }
}
