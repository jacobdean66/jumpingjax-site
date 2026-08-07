/**
 * Durable cross-instance protection for Social Posts agents.
 *
 * BLOCKED — DURABLE STORE REQUIRES SEPARATE APPROVAL
 * No shared Supabase/Redis/KV store exists today without a migration,
 * new dependency, or environment change. Process-local Maps are NOT
 * production-grade protection on Vercel multi-instance.
 *
 * Scope of the fail-closed 503 (truthful claim):
 * ALL billable provider starts are disabled while durable protection is
 * unavailable — paid image/video media generation AND every billable
 * model-backed (OpenAI) call: agent draft creation, draft regeneration,
 * Creative/Video Director preview, and Image Director preview.
 * Deterministic, non-billable Social Posts functionality remains available.
 */

export type AgentProtectionMode =
  | {
      kind: "process-local-nonproduction";
      durable: false;
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

/**
 * Process-local Maps may be used only as explicitly non-production aids.
 *
 * Environment detection fails safe: process-local protection is enabled
 * ONLY when the runtime is affirmatively known to be non-production —
 * `NODE_ENV === "test"`, `NODE_ENV === "development"` with no
 * production/preview Vercel deployment, or the explicit
 * `AGENT_ALLOW_PROCESS_LOCAL_PROTECTION=1` local override. A missing,
 * malformed, or ambiguous NODE_ENV/VERCEL_ENV combination is treated as
 * production-like and keeps billable calls disabled.
 *
 * HARD INVARIANT: no combination of flags — including the
 * AGENT_ALLOW_PROCESS_LOCAL_PROTECTION=1 local override — may enable
 * process-local protection on a Vercel deployment (production OR preview,
 * or any ambiguous Vercel context). Those environments stay fail-closed
 * until an approved durable shared store exists.
 */
export function getAgentProtectionMode(
  env: NodeJS.ProcessEnv = process.env,
): AgentProtectionMode {
  const nodeEnv = env.NODE_ENV?.trim();
  const vercelEnv = env.VERCEL_ENV?.trim();
  const vercelFlag = env.VERCEL?.trim();

  // Any Vercel deployment context that is not affirmatively local
  // development is fail-closed regardless of every other flag, including
  // the local override. Ambiguous (VERCEL set without a recognized
  // development VERCEL_ENV) counts as a deployment.
  const vercelDeploymentLike =
    vercelEnv === "production" ||
    vercelEnv === "preview" ||
    (Boolean(vercelFlag) && vercelEnv !== "development");

  const explicitlyNonProduction =
    !vercelDeploymentLike &&
    (env.AGENT_ALLOW_PROCESS_LOCAL_PROTECTION === "1" ||
      nodeEnv === "test" ||
      (nodeEnv === "development" &&
        (vercelEnv === undefined ||
          vercelEnv === "" ||
          vercelEnv === "development")));

  if (explicitlyNonProduction) {
    return {
      kind: "process-local-nonproduction",
      durable: false,
      label: "process-local-nonproduction",
      note:
        "In-memory rate-limit/idempotency only. Not safe across Vercel instances, regions, or cold starts. Never used as production protection.",
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

/**
 * Paid media (image/video) generation must not start when durable
 * protection is unavailable.
 */
export function paidGenerationProtectionBlock(
  env: NodeJS.ProcessEnv = process.env,
): ProtectionBlockBody | null {
  const mode = getAgentProtectionMode(env);
  if (mode.kind !== "disabled") return null;
  return {
    ok: false,
    error:
      "Paid media generation is disabled until a durable shared rate-limit/idempotency store is approved and configured. " +
      mode.reason,
    code: "durable_protection_unavailable",
    protection: mode,
  };
}

/**
 * Billable model-backed (OpenAI) calls — agent draft, regeneration, and
 * director previews — must not start when durable protection is
 * unavailable. Same fail-closed rule as paid media generation; only the
 * user-facing message differs.
 */
export function billableModelProtectionBlock(
  env: NodeJS.ProcessEnv = process.env,
): ProtectionBlockBody | null {
  const mode = getAgentProtectionMode(env);
  if (mode.kind !== "disabled") return null;
  return {
    ok: false,
    error:
      "Model-backed (OpenAI) drafting, regeneration, and director previews are temporarily unavailable until a durable shared rate-limit/idempotency store is approved and configured. " +
      mode.reason,
    code: "durable_protection_unavailable",
    protection: mode,
  };
}

export function protectionMetadata(
  env: NodeJS.ProcessEnv = process.env,
): AgentProtectionMode {
  return getAgentProtectionMode(env);
}
