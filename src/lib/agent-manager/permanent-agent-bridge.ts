import "server-only";
import { createHash } from "node:crypto";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { readChatRequest } from "@/lib/agent-manager/chat-pictures-server";
import { privateJson, safeOwnerAuthError, validateOwnerPost } from "@/lib/security/request-guard";

const routes = {
  ask: "/api/internal/jumping-jax/ask",
  projects: "/api/internal/jumping-jax/projects",
  "published-knowledge": "/api/internal/jumping-jax/published",
} as const;

function connection() {
  try {
    const origin = new URL(process.env.COMMAND_CENTER_JAX_ORIGIN ?? "");
    const token = process.env.COMMAND_CENTER_JAX_TOKEN ?? "";
    if (origin.protocol === "https:" && !origin.username && !origin.password &&
        origin.pathname === "/" && !origin.search && !origin.hash &&
        /^[A-Za-z0-9_-]{43,128}$/.test(token)) return { origin, token };
  } catch {
    return null;
  }
  return null;
}

export function permanentAgentConfigured() {
  return connection() !== null;
}

export async function permanentAgentRoute(area: keyof typeof routes, request?: Request) {
  const access = await verifyAdminOwnerAccess();
  if (!access.ok) return safeOwnerAuthError(access.reason);

  let body: string | undefined;
  if (request) {
    const browserRequest = process.env.VERCEL_ENV === "production"
      ? new Request(new URL(`/api/admin/agents/${area}`, "https://jumpingjaxllc.com"), {
          method: request.method, headers: request.headers,
        })
      : request;
    const rejected = validateOwnerPost(browserRequest);
    if (rejected) return rejected;
    try {
      body = JSON.stringify(await readChatRequest(request, 14000));
    } catch {
      return privateJson({ error: "Invalid Permanent Agent request." }, 400);
    }
  }

  const upstream = connection();
  const unavailable = () => privateJson({ error: "Permanent Agent’s private connection is unavailable." }, 503);
  if (!upstream) return unavailable();
  try {
    const response = await fetch(new URL(routes[area], upstream.origin), {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${upstream.token}`,
        "X-Jumping-Jax-Owner": createHash("sha256").update(access.identity.id).digest("hex"),
        "Content-Type": "application/json",
      },
      body,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok && ![400, 404, 409, 429].includes(response.status)) return unavailable();
    return privateJson(await response.json(), response.status);
  } catch {
    return unavailable();
  }
}
