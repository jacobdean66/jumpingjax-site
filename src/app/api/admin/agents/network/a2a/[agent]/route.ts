import { AgentCard } from "@a2a-js/sdk";
import { JsonRpcTransportHandler, ServerCallContext } from "@a2a-js/sdk/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { privateJson, safeOwnerAuthError, validateOwnerPost } from "@/lib/security/request-guard";
import { definition } from "@/lib/agent-manager/network/contracts";
import { createNetworkA2AHandler, networkAgentCard } from "@/lib/agent-manager/network/a2a";
import { readNetworkBody } from "@/lib/agent-manager/network/http";
import { cancelNetworkContext, loadNetworkTask, submitNetworkTask } from "@/lib/agent-manager/network/service";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ agent: string }> };
export async function GET(request: Request, context: Context) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  try { const agent = definition((await context.params).agent); return privateJson(AgentCard.toJSON(networkAgentCard(agent.key, new URL(request.url).origin))); }
  catch { return privateJson({ error: "Unknown agent." }, 404); }
}
export async function POST(request: Request, context: Context) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  if (request.headers.get("A2A-Version") !== "1.0") return privateJson({ error: "Use A2A-Version: 1.0." }, 400);
  let key;
  try { key = definition((await context.params).agent).key; } catch { return privateJson({ error: "Unknown agent." }, 404); }
  try {
    const body = await readNetworkBody(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) return privateJson({ error: "Invalid JSON-RPC request." }, 400);
    const handler = createNetworkA2AHandler(key, auth.identity.id, new URL(request.url).origin, { submit: submitNetworkTask, load: loadNetworkTask, cancel: cancelNetworkContext });
    const response = await new JsonRpcTransportHandler(handler).handle(body as Record<string, unknown>, new ServerCallContext({ user: { isAuthenticated: true, userName: auth.identity.id }, requestedVersion: "1.0" }));
    if (Symbol.asyncIterator in response) return privateJson({ error: "Streaming is unavailable; poll GetTask." }, 400);
    return privateJson(response);
  } catch { return privateJson({ error: "Agent protocol request unavailable." }, 400); }
}
