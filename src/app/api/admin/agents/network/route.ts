import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { privateJson, safeOwnerAuthError, validateOwnerPost } from "@/lib/security/request-guard";
import { submitSchema } from "@/lib/agent-manager/network/contracts";
import { conversationId, readNetworkBody } from "@/lib/agent-manager/network/http";
import { loadNetworkContext, loadNetworkOverview, submitNetworkTask } from "@/lib/agent-manager/network/service";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  const id = new URL(request.url).searchParams.get("context");
  if (id && !conversationId.safeParse(id).success) return privateJson({ ok: false, error: "Invalid conversation." }, 400);
  try { return privateJson({ ok: true, ...(id ? await loadNetworkContext(id) : await loadNetworkOverview()) }); }
  catch { return privateJson({ ok: false, error: "Agent network unavailable. Check its migration and storage." }, 503); }
}
export async function POST(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  const body = await readNetworkBody(request).catch(() => null);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return privateJson({ ok: false, error: "Invalid request. Use supported fields and remove credentials." }, 400);
  try {
    const task = await submitNetworkTask({ ...parsed.data, sender: "supervisor", actorId: auth.identity.id });
    return privateJson({ ok: true, task }, 202);
  } catch { return privateJson({ ok: false, error: "Request could not be queued. Check agent controls and conversation limits." }, 409); }
}
