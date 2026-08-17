import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { rateLimit } from "@/lib/rate-limit";
import { pollAikidoScanStatus } from "@/lib/security/aikido-client";
import { completeAikidoScanJob, saveSecurityObservation, validateAikidoScanJob } from "@/lib/security/action-store";
import { privateJson, safeOwnerAuthError, validateOwnerPost } from "@/lib/security/request-guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  const limited = rateLimit(request, { scope: "admin-security-aikido-poll", limit: 15, windowMs: 60_000 });
  if (limited) return privateJson({ ok: false, error: "Too many scan checks. Try again in a moment." }, 429, { "Retry-After": limited.headers.get("Retry-After") ?? "60" });

  let body: { scanId?: unknown; correlationId?: unknown };
  try {
    body = await request.json();
  } catch {
    return privateJson({ ok: false, error: "Invalid scan status request." }, 400);
  }
  const scanId = Number(body.scanId);
  const correlationId = typeof body.correlationId === "string" ? body.correlationId : "";
  if (!Number.isSafeInteger(scanId) || scanId < 1 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(correlationId)) {
    return privateJson({ ok: false, error: "Invalid scan status request." }, 400);
  }

  let validJob = false;
  try {
    validJob = await validateAikidoScanJob({ scanId, correlationId, actorId: auth.identity.id });
  } catch {
    return privateJson({ ok: false, error: "Scan tracking is temporarily unavailable." }, 503);
  }
  if (!validJob) return privateJson({ ok: false, error: "Unknown or completed scan job." }, 404);

  const result = await pollAikidoScanStatus(scanId);
  if (result.completed) {
    try {
      const firstCompletion = await completeAikidoScanJob({ scanId, correlationId, actorId: auth.identity.id, passed: result.passed === true, message: result.message });
      if (!firstCompletion) return privateJson({ ok: false, error: "Scan result was already recorded." }, 409);
      await saveSecurityObservation({ provider: "aikido", state: result.passed ? "healthy" : "failing", checkedAt: new Date().toISOString(), message: result.message, actorId: auth.identity.id });
    } catch {
      return privateJson({ ok: false, error: "Scan completed but its result could not be audited." }, 503);
    }
  }
  return privateJson({ ok: true, result });
}
