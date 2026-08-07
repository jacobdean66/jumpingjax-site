/**
 * Durable cross-instance protection for Social Posts agents.
 *
 * Production/preview require a shared Supabase durable store for
 * rate-limit/idempotency. Process-local Maps are NOT production-grade
 * protection on Vercel multi-instance and must never be used there.
 *
 * Scope of the fail-closed 503 (truthful claim):
 * ALL billable provider starts are disabled while durable protection is
 * unavailable — paid image/video media generation AND every billable
 * model-backed (OpenAI) call: agent draft creation, draft regeneration,
 * Creative/Video Director preview, and Image Director preview.
 * Deterministic, non-billable Social Posts functionality remains available.
 */

import {
  isDurableAgentStoreConfigured,
  isDurableAgentStoreReady,
} from "./agent-durable-store";

export type AgentProtectionMode =
  | {
      kind: "process-local-nonproduction";
      durable: false;
      label: string;
      note: string;
    }
  | {
      kind: "durable-supabase";
      durable: true;
      label: string;
      note: string;
    }
  | {
      kind: "disabled";
      durable: false;
      label: string;
      reason: string;
      code: "durable_protection_unavailable";
    };

export const DURABLE_STORE_BLOCKER =
  "BLOCKED — DURABLE STORE REQUIRES SEPARATE APPROVAL";

function isVercelDeploymentLike(env: NodeJS.ProcessEnv): boolean {
  const vercelEnv = env.VERCEL_ENV?.trim();
  const vercelFlag = env.VERCEL?.trim();
  return (
    vercelEnv === "production" ||
    vercelEnv === "preview" ||
    (Boolean(vercelFlag) && vercelEnv !== "development")
  );
}

/**
 * Synchronous mode selection from env/config only.
 * On Vercel production/preview, returns durable-supabase when service-role
 * credentials are configured; readiness of tables is checked asynchronously
 * by billable*ProtectionBlock / UI helpers.
 *
 * HARD INVARIANT: AGENT_ALLOW_PROCESS_LOCAL_PROTECTION=1 cannot enable
 * process-local protection on Vercel production/preview.
 */
export function getAgentProtectionMode(
  env: NodeJS.ProcessEnv = process.env,
): AgentProtectionMode {
  const nodeEnv = env.NODE_ENV?.trim();
  const vercelEnv = env.VERCEL_ENV?.trim();
  const vercelDeploymentLike = isVercelDeploymentLike(env);

  if (vercelDeploymentLike) {
    if (isDurableAgentStoreConfigured(env)) {
      return {
        kind: "durable-supabase",
        durable: true,
        label: "durable-supabase",
        note: "Supabase-backed shared rate-limit/idempotency. Fail closed if the store is unreachable.",
      };
    }

    return {
      kind: "disabled",
      durable: false,
      label: "disabled",
      reason: DURABLE_STORE_BLOCKER,
      code: "durable_protection_unavailable",
    };
  }

  const explicitlyNonProduction =
    env.AGENT_ALLOW_PROCESS_LOCAL_PROTECTION === "1" ||
    nodeEnv === "test" ||
    (nodeEnv === "development" &&
      (vercelEnv === undefined ||
        vercelEnv === "" ||
        vercelEnv === "development"));

  if (explicitlyNonProduction) {
    return {
      kind: "process-local-nonproduction",
      durable: false,
      label: "process-local-nonproduction",
      note: "In-memory rate-limit/idempotency only. Not safe across Vercel instances, regions, or cold starts. Never used as production protection.",
    };
  }

  // Ambiguous non-Vercel context: prefer durable if configured, else disabled.
  if (isDurableAgentStoreConfigured(env)) {
    return {
      kind: "durable-supabase",
      durable: true,
      label: "durable-supabase",
      note: "Supabase-backed shared rate-limit/idempotency. Fail closed if the store is unreachable.",
    };
  }

  return {
    kind: "disabled",
    durable: false,
    label: "disabled",
    reason: DURABLE_STORE_BLOCKER,
    code: "durable_protection_unavailable",
  };
}

export type ProtectionBlockBody = {
  ok: false;
  error: string;
  code: "durable_protection_unavailable";
  protection: AgentProtectionMode;
};

function disabledProtectionBody(
  mode: AgentProtectionMode,
  error: string,
): ProtectionBlockBody {
  const disabledMode: AgentProtectionMode =
    mode.kind === "disabled"
      ? mode
      : {
          kind: "disabled",
          durable: false,
          label: "disabled",
          reason: DURABLE_STORE_BLOCKER,
          code: "durable_protection_unavailable",
        };

  return {
    ok: false,
    error,
    code: "durable_protection_unavailable",
    protection: disabledMode,
  };
}

/**
 * Async billable gate: process-local OK in non-production; durable-supabase
 * requires a ready store; otherwise fail closed.
 */
export async function paidGenerationProtectionBlock(
  env: NodeJS.ProcessEnv = process.env,
): Promise<ProtectionBlockBody | null> {
  const mode = getAgentProtectionMode(env);
  if (mode.kind === "process-local-nonproduction") return null;
  if (mode.kind === "durable-supabase") {
    if (await isDurableAgentStoreReady(env)) return null;
    return disabledProtectionBody(
      mode,
      "Paid media generation is disabled until the durable shared rate-limit/idempotency store is available. " +
        DURABLE_STORE_BLOCKER,
    );
  }
  return disabledProtectionBody(
    mode,
    "Paid media generation is disabled until a durable shared rate-limit/idempotency store is approved and configured. " +
      (mode.kind === "disabled" ? mode.reason : DURABLE_STORE_BLOCKER),
  );
}

export async function billableModelProtectionBlock(
  env: NodeJS.ProcessEnv = process.env,
): Promise<ProtectionBlockBody | null> {
  const mode = getAgentProtectionMode(env);
  if (mode.kind === "process-local-nonproduction") return null;
  if (mode.kind === "durable-supabase") {
    if (await isDurableAgentStoreReady(env)) return null;
    return disabledProtectionBody(
      mode,
      "Model-backed (OpenAI) drafting, regeneration, and director previews are temporarily unavailable until the durable shared rate-limit/idempotency store is available. " +
        DURABLE_STORE_BLOCKER,
    );
  }
  return disabledProtectionBody(
    mode,
    "Model-backed (OpenAI) drafting, regeneration, and director previews are temporarily unavailable until a durable shared rate-limit/idempotency store is approved and configured. " +
      (mode.kind === "disabled" ? mode.reason : DURABLE_STORE_BLOCKER),
  );
}

export function protectionMetadata(
  env: NodeJS.ProcessEnv = process.env,
): AgentProtectionMode {
  return getAgentProtectionMode(env);
}

/** True when billable actions may use process-local Maps. */
export function usesProcessLocalAgentProtection(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return getAgentProtectionMode(env).kind === "process-local-nonproduction";
}

/** True when billable actions must use the Supabase durable store. */
export function usesDurableAgentProtection(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return getAgentProtectionMode(env).kind === "durable-supabase";
}
