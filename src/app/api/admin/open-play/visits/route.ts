import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { requireStaffAuth, publicSafeError } from "@/lib/open-play/staff-auth";
import { isYmd, PricingMismatchError } from "@/lib/open-play/pricing";
import {
  CheckInValidationError,
  createOpenPlayVisit,
} from "@/lib/open-play/visit-service";
import type { VisitAttendeeRequest } from "@/lib/open-play/check-in";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = rateLimit(req, {
    scope: "admin-open-play-visit-create",
    limit: 60,
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

  const attendeesRaw = Array.isArray(body.attendees) ? body.attendees : [];
  const attendees: VisitAttendeeRequest[] = attendeesRaw.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const adultMode =
      row.adultMode === "playing" || row.adultMode === "watching"
        ? (row.adultMode as "playing" | "watching")
        : null;
    const paymentMethod =
      row.paymentMethod === "cash" || row.paymentMethod === "card" || row.paymentMethod === "free_pass"
        ? (row.paymentMethod as "cash" | "card" | "free_pass")
        : null;
    return {
      participantId: typeof row.participantId === "string" ? row.participantId : "",
      adultMode,
      clientPriceCents:
        typeof row.clientPriceCents === "number" ? row.clientPriceCents : null,
      overridePriceCents:
        typeof row.overridePriceCents === "number" ? row.overridePriceCents : null,
      paymentMethod,
    };
  });

  try {
    const result = await createOpenPlayVisit({
      visitDateYmd,
      notes: typeof body.notes === "string" ? body.notes : null,
      staffId: auth.auth.identity.id,
      attendees,
    });

    return NextResponse.json(
      {
        ok: true,
        visitId: result.visitId,
        businessDayYmd: result.businessDayYmd,
        attendees: result.attendees,
        paymentEntries: result.paymentEntries,
      },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (
      error instanceof CheckInValidationError ||
      error instanceof PricingMismatchError
    ) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: 400 },
      );
    }
    return publicSafeError("database", 503);
  }
}
