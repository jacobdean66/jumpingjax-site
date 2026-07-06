/**
 * D16 execution stack shared invariants.
 * Single source of truth for forbidden record keys and read-only layer flags.
 * Do not add execution, publishing, network, or credential access here.
 */

export const SOCIAL_EXECUTION_FORBIDDEN_RECORD_KEYS = [
  "fetch",
  "http",
  "publish",
  "execute",
  "credential",
  "token",
  "oauth",
  "vault",
  "worker",
  "queue",
  "cron",
  "retry",
  "secret",
  "accesstoken",
  "refreshtoken",
  "authorizationcode",
] as const;

export type SocialExecutionForbiddenRecordKey =
  (typeof SOCIAL_EXECUTION_FORBIDDEN_RECORD_KEYS)[number];

export const SOCIAL_EXECUTION_FORBIDDEN_RECORD_KEY_SET = new Set<string>(
  SOCIAL_EXECUTION_FORBIDDEN_RECORD_KEYS.map((key) => key.toLowerCase()),
);

export const SOCIAL_EXECUTION_INVARIANT_ERROR_CODES = [
  "grants_execution_permission_forbidden",
  "proves_execution_forbidden",
  "simulated_only_required",
  "forbidden_key_detected",
] as const;

export type SocialExecutionInvariantErrorCode =
  (typeof SOCIAL_EXECUTION_INVARIANT_ERROR_CODES)[number];

export const SOCIAL_EXECUTION_CORRELATION_ID_PATTERN =
  /^corr:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

export const SOCIAL_EXECUTION_REFERENCE_ID_PATTERN =
  /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

/** Shared flags for preflight, replay, and diagnostics responses (W11–W15). */
export const SOCIAL_EXECUTION_READ_ONLY_LAYER_INVARIANTS = {
  computedOnly: true,
  readOnly: true,
  authoritative: false,
  grantsExecutionPermission: false,
  executesNothing: true,
  publishesNothing: true,
} as const;

/** Shared flags for simulated-only domain records (runner, session, plan). */
export const SOCIAL_EXECUTION_SIMULATED_RECORD_INVARIANTS = {
  simulatedOnly: true,
  grantsExecutionPermission: false,
} as const;
