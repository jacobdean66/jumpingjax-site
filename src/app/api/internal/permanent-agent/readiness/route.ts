import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { getPermanentAgentConnection, permanentAgentOwnerScope } from "@/lib/agent-manager/permanent-agent-connection";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
const digest = (value: string) => createHash("sha256").update(value).digest();

// Service-authenticated read-only release verification. Never returns backend content or credentials.
export async function GET(request: Request) {
  const connection = getPermanentAgentConnection();
  const reply = (value: unknown, status: number) => Response.json(value, {status, headers:{"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"}});
  if (!connection) return reply({error:"Unavailable"},404);
  if (!timingSafeEqual(digest(request.headers.get("authorization") ?? ""), digest("Bearer " + connection.token))) return reply({error:"Authorization required"},401);
  const headers = {Authorization:"Bearer " + connection.token, "X-Jumping-Jax-Owner":permanentAgentOwnerScope("owner")};
  const paths = {ask:"/api/internal/jumping-jax/ask",projects:"/api/internal/jumping-jax/projects",published:"/api/internal/jumping-jax/published"};
  const upstreams = await Promise.all(Object.entries(paths).map(async ([name,path]) => {
    try {
      const response = await fetch(new URL(path,connection.origin), {headers,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(8000)});
      const value = response.ok ? await response.json() : null;
      return [name,{status:response.status,...(name === "projects" && Array.isArray(value?.projects) ? {count:value.projects.length}: {})}] as const;
    } catch (error) {
      const failure = error as {name?:string;cause?:{code?:string}};
      const known = new Set(["ENOTFOUND","EAI_AGAIN","ECONNREFUSED","ETIMEDOUT","UND_ERR_CONNECT_TIMEOUT","CERT_HAS_EXPIRED","UNABLE_TO_VERIFY_LEAF_SIGNATURE"]);
      const code = failure.name === "TimeoutError" ? "TIMEOUT" : known.has(failure.cause?.code??"") ? failure.cause?.code : "UNAVAILABLE";
      return [name,{status:503,errorCode:code}] as const;
    }
  }));
  const results = Object.fromEntries(upstreams);
  const ready = Object.values(results).every(value => (value as {status:number}).status === 200);
  return reply({ready,runtime:process.env.VERCEL === "1" ? "vercel-function":"local",region:process.env.VERCEL_REGION??null,revision:process.env.VERCEL_GIT_COMMIT_SHA??null,upstreams:results},ready?200:503);
}
