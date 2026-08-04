import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { requireOwnerAuth, publicSafeError } from "@/lib/open-play/staff-auth";
import { getAuthorizedWaiverDocument } from "@/lib/waivers/documents-service";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  context: { params: Promise<{ submissionId: string }> },
) {
  const limited = rateLimit(req, {
    scope: "admin-open-play-documents",
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const auth = await requireOwnerAuth();
  if (!auth.ok) return auth.response;

  const { submissionId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(submissionId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid submission id", code: "validation" },
      { status: 400 },
    );
  }

  try {
    const document = await getAuthorizedWaiverDocument({
      submissionId,
      staffId: auth.auth.identity.id,
      expiresInSeconds: 60,
    });
    if (!document) {
      return publicSafeError("not_found", 404, "Document not found");
    }

    return NextResponse.json(
      {
        ok: true,
        submissionId: document.submissionId,
        status: document.status,
        source: document.source,
        signedUrl: document.signedUrl,
        expiresInSeconds: document.expiresInSeconds,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return publicSafeError("database", 503);
  }
}
