import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { requireStaffAuth, publicSafeError } from "@/lib/open-play/staff-auth";
import { isYmd, PricingMismatchError } from "@/lib/open-play/pricing";
import { CheckInValidationError } from "@/lib/open-play/check-in";
import { createLegacySmartwaiverCheckIns } from "@/lib/open-play/legacy-check-in-service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = rateLimit(req, {
    scope: "admin-open-play-legacy-check-in",
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
  const attendees = attendeesRaw.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const adultMode =
      row.adultMode === "playing" || row.adultMode === "watching"
        ? (row.adultMode as "playing" | "watching")
        : null;
    const paymentMethod =
      row.paymentMethod === "cash" || row.paymentMethod === "card"
        ? (row.paymentMethod as "cash" | "card")
        : null;
    return {
      legacyParticipantId:
        typeof row.legacyParticipantId === "string" ? row.legacyParticipantId : "",
      participantId: "",
      adultMode,
      clientPriceCents:
        typeof row.clientPriceCents === "number" ? row.clientPriceCents : null,
      paymentMethod,
    };
  });

  try {
    const result = await createLegacySmartwaiverCheckIns({
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
        paymentEntries: result.paymentEntries.map((entry) => ({
          id: entry.id,
          visitId: result.visitId,
          attendeeId: entry.attendeeId,
          entryType: "charge",
          method: entry.method,
          amountCents: entry.amountCents,
          relatedEntryId: null,
          reason: null,
          createdByStaffId: auth.auth.identity.id,
          createdAt: new Date().toISOString(),
        })),
        source: "legacy_smartwaiver",
      },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (
      error instanceof CheckInValidationError ||
      error instanceof PricingMismatchError
    ) {
      return NextResponse.json(
        { ok: false, error: error.message, code: "check_in_validation" },
        { status: 400 },
      );
    }
    return publicSafeError("server_error", 500, "Unable to create legacy check-in");
  }
}
