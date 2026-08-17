import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { rateLimit } from "@/lib/rate-limit";
import { requestAikidoScan } from "@/lib/security/aikido-client";
import { beginSecurityAction, saveAikidoScanJob, saveSecurityObservation, writeSecurityAudit } from "@/lib/security/action-store";
import { privateJson, safeOwnerAuthError, validateOwnerPost } from "@/lib/security/request-guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  const limited = rateLimit(request, { scope: "admin-security-aikido-scan", limit: 1, windowMs: 60_000 });
  if (limited) return privateJson({ ok: false, error: "Too many requests. Try again in a moment." }, 429, { "Retry-After": limited.headers.get("Retry-After") ?? "60" });

  let action;
  try {
    action = await beginSecurityAction({ actorId: auth.identity.id, action: "scan", provider: "aikido", cooldownSeconds: 300 });
  } catch {
    return privateJson({ ok: false, error: "Durable action protection is unavailable." }, 503);
  }
  if (!action.claimed) return privateJson({ ok: false, error: "A scan was already requested recently." }, 429, { "Retry-After": "300" });

  const result = await requestAikidoScan();
  try {
    if (result.accepted && result.scanId) {
      await saveAikidoScanJob({ scanId: result.scanId, correlationId: action.correlationId, actorId: auth.identity.id });
    }
    await saveSecurityObservation({
      provider: "aikido",
      state: result.accepted ? "degraded" : "failing",
      checkedAt: new Date().toISOString(),
      message: result.accepted ? `Aikido accepted feature-branch CI scan ${result.scanId}; acceptance is not a passing result.` : result.message,
      actorId: auth.identity.id,
    });
    await writeSecurityAudit({ actorId: auth.identity.id, action: "scan", provider: "aikido", outcome: result.accepted ? "accepted" : "failed", safeCode: result.accepted ? "scan_accepted" : "scan_rejected", correlationId: action.correlationId });
  } catch {
    return privateJson({ ok: false, error: "The scan request completed but its audit record could not be saved." }, 503);
  }
  return privateJson({ ok: result.accepted, result, correlationId: action.correlationId }, result.accepted ? 202 : 409);
}
