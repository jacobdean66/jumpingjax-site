import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { rateLimit } from "@/lib/rate-limit";
import { runAithuraHealthCheck } from "@/lib/security/aithura-client";
import { beginSecurityAction, saveSecurityObservation, writeSecurityAudit } from "@/lib/security/action-store";
import { privateJson, safeOwnerAuthError, validateOwnerPost } from "@/lib/security/request-guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  const limited = rateLimit(request, { scope: "admin-security-aithura-health", limit: 2, windowMs: 60_000 });
  if (limited) return privateJson({ ok: false, error: "Too many requests. Try again in a moment." }, 429, { "Retry-After": limited.headers.get("Retry-After") ?? "60" });

  let action;
  try {
    action = await beginSecurityAction({ actorId: auth.identity.id, action: "health", provider: "aithura", cooldownSeconds: 60 });
  } catch {
    return privateJson({ ok: false, error: "Durable action protection is unavailable." }, 503);
  }
  if (!action.claimed) return privateJson({ ok: false, error: "A live test was already requested recently." }, 429, { "Retry-After": "60" });

  const result = await runAithuraHealthCheck();
  try {
    await saveSecurityObservation({ provider: "aithura", state: result.healthy ? "healthy" : "failing", checkedAt: result.checkedAt, message: result.message, actorId: auth.identity.id });
    await writeSecurityAudit({ actorId: auth.identity.id, action: "health", provider: "aithura", outcome: result.healthy ? "succeeded" : "failed", safeCode: result.healthy ? "route_verified" : "route_test_failed", correlationId: action.correlationId });
  } catch {
    return privateJson({ ok: false, error: "The test completed but its audit record could not be saved." }, 503);
  }
  return privateJson({ ok: result.healthy, result }, result.healthy ? 200 : 502);
}
