import { NextResponse } from "next/server";

import { publicSafeError } from "@/lib/open-play/staff-auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  ActiveTemplateError,
  getActiveWaiverTemplate,
  toPublicActiveTemplateResponse,
} from "@/lib/waivers/active-template";

export const dynamic = "force-dynamic";

/**
 * GET /api/waiver/template/active
 *
 * Public read-only active waiver template/version.
 * Legal HTML must not be cached indefinitely after version changes.
 */
export async function GET(req: Request) {
  const limited = rateLimit(req, {
    scope: "waiver-template-active",
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  try {
    const template = await getActiveWaiverTemplate();
    return NextResponse.json(toPublicActiveTemplateResponse(template), {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof ActiveTemplateError) {
      const statusByCode: Record<ActiveTemplateError["code"], number> = {
        not_found: 404,
        ambiguous_active_template: 409,
        incomplete_template: 503,
        database: 503,
        misconfigured: 503,
      };
      const publicMessageByCode: Partial<
        Record<ActiveTemplateError["code"], string>
      > = {
        not_found: "No active waiver is available",
      };
      return publicSafeError(
        error.code,
        statusByCode[error.code],
        publicMessageByCode[error.code],
      );
    }
    return publicSafeError("database", 503);
  }
}
