import { NextResponse } from "next/server";

import { verifyAdminAccess } from "@/lib/admin/session";
import { rateLimit } from "@/lib/rate-limit";
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

  const auth = await verifyAdminAccess();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: "Staff authentication required", code: "unauthorized" },
      { status: auth.reason === "missing_config" ? 503 : 401 },
    );
  }

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
      staffId: auth.identity.id,
      expiresInSeconds: 60,
    });
    if (!document) {
      return NextResponse.json(
        { ok: false, error: "Document not found", code: "not_found" },
        { status: 404 },
      );
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
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Document access failed",
        code: "database",
      },
      { status: 503 },
    );
  }
}
