import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { submitWaiver, WaiverSubmitError } from "@/lib/waivers/submit";
import type { SubmissionDraft } from "@/lib/waivers/validation";

export const dynamic = "force-dynamic";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

export async function POST(req: Request) {
  const limited = rateLimit(req, {
    scope: "waiver-submit",
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 256 * 1024) {
    return NextResponse.json(
      { ok: false, error: "Request body is too large", code: "payload_too_large" },
      { status: 413 },
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

  const participantsRaw = Array.isArray(body.participants) ? body.participants : [];
  const draft: SubmissionDraft = {
    templateVersionId: asString(body.templateVersionId),
    signer: {
      firstName: asString((body.signer as Record<string, unknown> | undefined)?.firstName),
      lastName: asString((body.signer as Record<string, unknown> | undefined)?.lastName),
      email: asString((body.signer as Record<string, unknown> | undefined)?.email),
      phone: asString((body.signer as Record<string, unknown> | undefined)?.phone),
    },
    participants: participantsRaw.map((item, index) => {
      const row = (item ?? {}) as Record<string, unknown>;
      return {
        tempId: asString(row.tempId) || `p-${index}`,
        firstName: asString(row.firstName),
        lastName: asString(row.lastName),
        dob: asString(row.dob),
        role: asString(row.role) as SubmissionDraft["participants"][number]["role"],
        guardianTempId: row.guardianTempId ? asString(row.guardianTempId) : null,
      };
    }),
    consent: {
      acknowledgedRisk: asBoolean(
        (body.consent as Record<string, unknown> | undefined)?.acknowledgedRisk,
      ),
      acknowledgedTerms: asBoolean(
        (body.consent as Record<string, unknown> | undefined)?.acknowledgedTerms,
      ),
      isLegalGuardian: asBoolean(
        (body.consent as Record<string, unknown> | undefined)?.isLegalGuardian,
      ),
    },
    source: asString(body.source) as SubmissionDraft["source"],
    signatureStoragePath: asString(body.signatureStoragePath),
    signatureContentType: asString(body.signatureContentType) || "image/png",
    idempotencyKey:
      asString(body.idempotencyKey) ||
      req.headers.get("idempotency-key") ||
      null,
  };

  try {
    const result = await submitWaiver({
      draft,
      requestIp:
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip"),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json(
      {
        ok: true,
        submissionId: result.submissionId,
        publicToken: result.publicToken,
        expiresOn: result.expiresOn,
      },
      {
        status: result.reusedExisting ? 200 : 201,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    if (error instanceof WaiverSubmitError) {
      const status =
        error.code === "template_inactive"
          ? 409
          : error.code === "validation"
            ? 400
            : 503;
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Submission failed",
        code: "database",
      },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
