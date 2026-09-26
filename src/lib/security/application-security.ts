import "server-only";

import { isSupabaseServiceConfigured } from "@/lib/supabase/admin";
import type { ApplicationSecurityCheck, SecurityState } from "./types";

function check(
  id: ApplicationSecurityCheck["id"],
  name: string,
  state: SecurityState,
  summary: string,
  now: Date,
): ApplicationSecurityCheck {
  return { id, name, state, summary, checkedAt: now.toISOString() };
}

function publicSecretVariableCount(): number {
  return Object.keys(process.env).filter((name) => {
    if (!name.startsWith("NEXT_PUBLIC_")) return false;
    if (name === "NEXT_PUBLIC_SUPABASE_URL") return false;
    return /(secret|private|password|token|service.*role|api.*key)/i.test(name);
  }).length;
}

export function getApplicationSecurityChecks(input: {
  now?: Date;
  securityStoreReachable: boolean;
}): ApplicationSecurityCheck[] {
  const now = input.now ?? new Date();
  const deploymentSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || "";
  const deploymentBranch = process.env.VERCEL_GIT_COMMIT_REF?.trim() || "";
  const hasDeploymentIdentity = /^[0-9a-f]{40}$/i.test(deploymentSha) && Boolean(deploymentBranch);
  const hasDedicatedSessionSecret = Boolean(process.env.ADMIN_SESSION_SECRET?.trim());
  const hasFallbackSessionKey = Boolean(
    process.env.ADMIN_OWNER_PASSWORD?.trim() ||
      process.env.ADMIN_DELIVERIES_TOKEN?.trim() ||
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
  const publicSecretCount = publicSecretVariableCount();

  return [
    check(
      "deployment-identity",
      "Production identity",
      hasDeploymentIdentity ? "healthy" : "degraded",
      hasDeploymentIdentity
        ? `Checks are bound to ${deploymentBranch}@${deploymentSha.slice(0, 7)}.`
        : "A production commit and branch were not available. Results cannot be tied to an exact deployment.",
      now,
    ),
    check(
      "admin-session",
      "Admin session signing",
      hasDedicatedSessionSecret ? "healthy" : hasFallbackSessionKey ? "degraded" : "misconfigured",
      hasDedicatedSessionSecret
        ? "Admin sessions use a dedicated server-only signing secret."
        : hasFallbackSessionKey
          ? "Admin sessions are signed with a fallback credential. Configure ADMIN_SESSION_SECRET to isolate session signing."
          : "No server-side key is available for signed admin sessions.",
      now,
    ),
    check(
      "database-boundary",
      "Database service boundary",
      isSupabaseServiceConfigured() ? "healthy" : "misconfigured",
      isSupabaseServiceConfigured()
        ? "The server-only Supabase service client is configured."
        : "The Supabase URL or service-role credential is missing.",
      now,
    ),
    check(
      "security-store",
      "Security audit store",
      input.securityStoreReachable ? "healthy" : "unavailable",
      input.securityStoreReachable
        ? "Security observations, scan jobs, and append-only audit records are reachable."
        : "The Security Center could not verify its private audit tables.",
      now,
    ),
    check(
      "public-secret-exposure",
      "Public environment boundary",
      publicSecretCount === 0 ? "healthy" : "failing",
      publicSecretCount === 0
        ? "No secret-like environment variable names are exposed with the NEXT_PUBLIC_ prefix."
        : `${publicSecretCount} secret-like environment variable name${publicSecretCount === 1 ? " is" : "s are"} exposed with the NEXT_PUBLIC_ prefix.`,
      now,
    ),
  ];
}
