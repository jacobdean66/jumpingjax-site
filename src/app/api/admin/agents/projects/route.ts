import { getPermanentAgentConnection, permanentAgentOwnerScope } from "@/lib/agent-manager/permanent-agent-connection";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { privateJson, safeOwnerAuthError, validateOwnerPost } from "@/lib/security/request-guard";
import { readChatRequest } from "@/lib/agent-manager/chat-pictures-server";

export const dynamic = "force-dynamic";

async function forward(owner: string, body?: Record<string, unknown>) {
  try {
    const connection = getPermanentAgentConnection();
    if (!connection) throw new Error("Invalid service configuration");
    const { origin, token } = connection;
    const upstream = await fetch(new URL("/api/internal/jumping-jax/projects", origin), {
      method: body ? "POST" : "GET",
      headers: {Authorization: "Bearer " + token, "X-Jumping-Jax-Owner": permanentAgentOwnerScope(owner), "Content-Type": "application/json"},
      body: body ? JSON.stringify(body) : undefined,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if ([400, 404, 409, 429].includes(upstream.status)) {
      return privateJson(await upstream.json(), upstream.status);
    }
    if (!upstream.ok) throw new Error("Service unavailable");
    return privateJson(await upstream.json(), upstream.status);
  } catch {
    return privateJson({error: "Command Center is unavailable. Use Retry for the same submission."}, 503);
  }
}

export async function GET() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  return forward(auth.identity.id);
}

export async function POST(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  try {
    const body: Record<string, unknown> = await readChatRequest(request, 14000);
    return forward(auth.identity.id, body);
  } catch {
    return privateJson({error: "Invalid project request."}, 400);
  }
}
