import { rateLimit } from "@/lib/rate-limit";
import { publicSafeError } from "@/lib/open-play/staff-auth";
import { getCompletionByToken, WaiverSubmitError } from "@/lib/waivers/submit";
import { NextResponse } from "next/server";

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
    return publicSafeError("not_found", 404, "Waiver not found");
  }

  try {
    const completion = await getCompletionByToken({ token });
    if (!completion) {
      return publicSafeError("not_found", 404, "Waiver not found");
    }

    return NextResponse.json(
      {
        ok: true,
        // Minimal confirmation payload — no signer PII.
        expiresOn: completion.expiresOn,
        expired: completion.expired,
        participantCount: completion.participantCount,
        status: completion.status,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof WaiverSubmitError && error.code === "token_expired") {
      return publicSafeError("token_expired", 410, "Completion token has expired");
    }
    return publicSafeError("database", 503);
  }
}
