import "server-only";
import { createHash } from "node:crypto";

export function getPermanentAgentConnection() {
  const token = process.env.COMMAND_CENTER_JAX_TOKEN;
  const configuredOrigin = process.env.COMMAND_CENTER_JAX_ORIGIN;

  if (!configuredOrigin || !token || !/^[A-Za-z0-9_-]{43,128}$/.test(token)) return null;

  try {
    const origin = new URL(configuredOrigin);
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" ||
        origin.search || origin.hash) return null;
    return { origin, token };
  } catch {
    return null;
  }
}


// Configure a binding only after verifying both accounts belong to the same owner.
export function permanentAgentOwnerScope(ownerIdentity: string) {
  const signedInOwner = createHash("sha256").update(ownerIdentity).digest("hex");
  const binding = /^([a-f0-9]{64}):([a-f0-9]{64})$/.exec(process.env.COMMAND_CENTER_JAX_OWNER_BINDING ?? "");
  return binding?.[1] === signedInOwner ? binding[2] : signedInOwner;
}
