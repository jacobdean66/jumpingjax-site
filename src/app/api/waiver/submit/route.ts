import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { publicSafeError } from "@/lib/open-play/staff-auth";
import { submitWaiver, WaiverSubmitError } from "@/lib/waivers/submit";
import {
  WAIVER_LIMITS,
  type SubmissionDraft,
} from "@/lib/waivers/validation";

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

  const contentLengthHeader = req.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > WAIVER_LIMITS.maxBodyBytes) {
      return publicSafeError("payload_too_large", 413, "Request body is too large");
    }
  }

  let rawText: string;
  try {
    rawText = await req.text();
  } catch {
    return publicSafeError("invalid_body", 400, "Unable to read request body");
  }
  if (rawText.length > WAIVER_LIMITS.maxBodyBytes) {
    return publicSafeError("payload_too_large", 413, "Request body is too large");
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    return publicSafeError("invalid_json", 400, "Invalid JSON request body");
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
    signatureContentType: asString(body.signatureContentType) || "image/png",
    idempotencyKey:
      asString(body.idempotencyKey) ||
      asString(req.headers.get("idempotency-key")),
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
        tokenExpiresAt: result.tokenExpiresAt,
        reused: result.reusedExisting,
      },
      {
        status: result.reusedExisting ? 200 : 201,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    if (error instanceof WaiverSubmitError) {
      const statusByCode: Record<string, number> = {
        validation: 400,
        template_inactive: 409,
        idempotency_conflict: 409,
        incomplete_prior_state: 409,
        misconfigured: 503,
        token_expired: 410,
      };
      return publicSafeError(
        error.code,
        statusByCode[error.code] ?? 503,
        error.code === "validation" ? error.message : "Request could not be completed",
      );
    }
    return publicSafeError("database", 503);
  }
}
