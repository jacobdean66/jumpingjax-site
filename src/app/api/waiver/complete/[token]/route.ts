import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { getCompletionByToken } from "@/lib/waivers/submit";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  context: { params: Promise<{ token: string }> },
) {
  const limited = rateLimit(req, {
    scope: "waiver-complete",
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const { token } = await context.params;
  if (!token || token.length < 32 || token.length > 128) {
    return NextResponse.json(
      { ok: false, error: "Invalid completion token", code: "not_found" },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    const completion = await getCompletionByToken({ token });
    if (!completion) {
      return NextResponse.json(
        { ok: false, error: "Waiver not found", code: "not_found" },
        { status: 404, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        submissionId: completion.submissionId,
        signerFirstName: completion.signerFirstName,
        signerLastName: completion.signerLastName,
        signedAt: completion.signedAt,
        expiresOn: completion.expiresOn,
        expired: completion.expired,
        participantCount: completion.participantCount,
        status: completion.status,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Lookup failed",
        code: "database",
      },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
