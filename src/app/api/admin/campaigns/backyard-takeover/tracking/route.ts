import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { loadBackyardTrackingReport } from "@/lib/admin/backyard-tracking-report";
import { privateJson, safeOwnerAuthError } from "@/lib/security/request-guard";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  return privateJson(await loadBackyardTrackingReport(new URL(request.url).searchParams.get("period") ?? undefined));
}
