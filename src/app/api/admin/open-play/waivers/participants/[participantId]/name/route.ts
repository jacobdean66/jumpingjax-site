import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { requireStaffAuth, publicSafeError } from "@/lib/open-play/staff-auth";
import {
  correctWaiverParticipantDisplayName,
  WaiverNameCorrectionValidationError,
} from "@/lib/waivers/name-corrections";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ participantId: string }> },
) {
  const limited = rateLimit(req, {
    scope: "admin-open-play-waiver-name-correction",
    limit: 80,
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

  const { participantId } = await params;
  if (!UUID_RE.test(participantId)) {
    return NextResponse.json(
      { ok: false, error: "participantId must be a UUID", code: "validation" },
      { status: 400 },
    );
  }

  try {
    const result = await correctWaiverParticipantDisplayName({
      participantId,
      firstName: typeof body.firstName === "string" ? body.firstName : "",
      lastName: typeof body.lastName === "string" ? body.lastName : "",
      reason: typeof body.reason === "string" ? body.reason : "",
      staffId: auth.auth.identity.id,
    });

    return NextResponse.json(
      { ok: true, correction: result },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof WaiverNameCorrectionValidationError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: 400 },
      );
    }
    return publicSafeError("database", 503);
  }
}
