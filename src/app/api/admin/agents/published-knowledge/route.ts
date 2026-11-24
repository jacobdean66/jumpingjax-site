import { getPermanentAgentConnection } from "@/lib/agent-manager/permanent-agent-connection";
import {createHash} from "node:crypto";
import {verifyAdminAccess} from "@/lib/admin/session";
import {privateJson,safeOwnerAuthError} from "@/lib/security/request-guard";

export const dynamic="force-dynamic";

export async function GET(){
  const auth=await verifyAdminAccess();
  if(!auth.ok)return safeOwnerAuthError(auth.reason);
  try{
    const connection=getPermanentAgentConnection();
    if(!connection)throw Error("Published knowledge connection is unavailable");
    const {origin,token}=connection;
    const reply=await fetch(new URL("/api/internal/jumping-jax/published",origin),{
      headers:{Authorization:"Bearer "+token,"X-Jumping-Jax-Owner":createHash("sha256").update(auth.identity.id).digest("hex")},
      cache:"no-store",redirect:"error",signal:AbortSignal.timeout(5000),
    });
    if(!reply.ok)throw Error();
    return privateJson(await reply.json());
  }catch{return privateJson({error:"Published knowledge is unavailable."},503);}
}
