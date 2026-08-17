import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { requireOwnerAuth, publicSafeError } from "@/lib/open-play/staff-auth";
import {
  applyLegacyVisitCorrection,
  LedgerValidationError,
  parseCorrectionRequest,
} from "@/lib/open-play/corrections-service";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(req, {
    scope: "admin-open-play-legacy-corrections",
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;
  const auth = await requireOwnerAuth();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json(
      { ok: false, error: "Invalid visit id", code: "validation" },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return publicSafeError("invalid_json", 400, "Invalid JSON request body");
  }

  try {
    const correction = parseCorrectionRequest(body);
    if (!correction) {
      return NextResponse.json(
        { ok: false, error: "Unsupported correction type", code: "validation" },
        { status: 400 },
      );
    }
    const result = await applyLegacyVisitCorrection({
      visitId: id,
      staffId: auth.auth.identity.id,
      correction,
    });
    return NextResponse.json(
      { ok: true, entries: result.entries },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof LedgerValidationError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: 400 },
      );
    }
    return publicSafeError("database", 503);
  }
}
