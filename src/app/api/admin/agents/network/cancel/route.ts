import { z } from "zod";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { privateJson, safeOwnerAuthError, validateOwnerPost } from "@/lib/security/request-guard";
import { readNetworkBody } from "@/lib/agent-manager/network/http";
import { cancelNetworkContext } from "@/lib/agent-manager/network/service";
export async function POST(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  const parsed = z.object({ contextId: z.uuid() }).strict().safeParse(await readNetworkBody(request).catch(() => null));
  if (!parsed.success) return privateJson({ ok: false, error: "Invalid conversation." }, 400);
  try { await cancelNetworkContext(parsed.data.contextId, auth.identity.id); return privateJson({ ok: true }); }
  catch { return privateJson({ ok: false, error: "Conversation could not be cancelled." }, 409); }
}
