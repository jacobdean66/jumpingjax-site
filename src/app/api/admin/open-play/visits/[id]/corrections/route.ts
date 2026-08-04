import { NextResponse } from "next/server";

import { verifyAdminAccess } from "@/lib/admin/session";
import { rateLimit } from "@/lib/rate-limit";
import {
  applyVisitCorrection,
  LedgerValidationError,
  type CorrectionRequest,
} from "@/lib/open-play/corrections-service";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(req, {
    scope: "admin-open-play-corrections",
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const auth = await verifyAdminAccess();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: "Staff authentication required", code: "unauthorized" },
      { status: auth.reason === "missing_config" ? 503 : 401 },
    );
  }

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
    return NextResponse.json(
      { ok: false, error: "Invalid JSON request body", code: "invalid_json" },
      { status: 400 },
    );
  }

  const type = typeof body.type === "string" ? body.type : "";
  let correction: CorrectionRequest | null = null;

  if (type === "method_correction") {
    correction = {
      type: "method_correction",
      relatedEntryId: String(body.relatedEntryId ?? ""),
      fromMethod: body.fromMethod === "card" ? "card" : "cash",
      toMethod: body.toMethod === "card" ? "card" : "cash",
      amountCents: Number(body.amountCents),
      reason: String(body.reason ?? ""),
      attendeeId: body.attendeeId ? String(body.attendeeId) : null,
    };
  } else if (type === "void") {
    correction = {
      type: "void",
      relatedEntryId: String(body.relatedEntryId ?? ""),
      reason: String(body.reason ?? ""),
      attendeeId: body.attendeeId ? String(body.attendeeId) : null,
      removeAttendeeId: body.removeAttendeeId
        ? String(body.removeAttendeeId)
        : null,
    };
  } else if (type === "refund") {
    correction = {
      type: "refund",
      relatedEntryId: String(body.relatedEntryId ?? ""),
      method: body.method === "card" ? "card" : "cash",
      amountCents: Number(body.amountCents),
      reason: String(body.reason ?? ""),
      attendeeId: body.attendeeId ? String(body.attendeeId) : null,
    };
  } else if (type === "remove_attendee") {
    correction = {
      type: "remove_attendee",
      attendeeId: String(body.attendeeId ?? ""),
      relatedEntryId: body.relatedEntryId ? String(body.relatedEntryId) : null,
      reason: String(body.reason ?? ""),
    };
  }

  if (!correction) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unsupported correction type",
        code: "validation",
      },
      { status: 400 },
    );
  }

  try {
    const result = await applyVisitCorrection({
      visitId: id,
      staffId: auth.identity.id,
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
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Correction failed",
        code: "database",
      },
      { status: 503 },
    );
  }
}
