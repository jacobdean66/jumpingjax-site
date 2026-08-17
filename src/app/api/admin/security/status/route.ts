import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { loadSecurityDashboard } from "@/lib/security/dashboard-service";
import { privateJson, safeOwnerAuthError } from "@/lib/security/request-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  return privateJson({ ok: true, dashboard: await loadSecurityDashboard(auth.identity.id) });
}
