import { createHash } from "node:crypto";
import { AGENT_INPUT_LIMITS, AgentInputValidationError } from "./agent-input-bounds";
import {
  DurableAgentStoreError,
  durableBeginAgentIdempotentAction,
  durableCompleteAgentIdempotentAction,
  durableFailAgentIdempotentAction,
} from "./agent-durable-store";
import {
  usesDurableAgentProtection,
  usesProcessLocalAgentProtection,
} from "./agent-protection-mode";

/**
 * Process-local idempotency aid + async facade that selects durable Supabase
 * storage when protection mode requires it.
 */
export type AgentIdempotencyAction =
  | "agent-draft"
  | "regenerate"
  | "director-preview"
  | "image-director-preview"
  | "generate-image"
  | "generate-media";

type InFlightEntry = {
  startedAt: number;
  fingerprint: string;
};

type CompletedEntry = {
  completedAt: number;
  fingerprint: string;
  status: number;
  body: unknown;
};

const IN_FLIGHT_TTL_MS = 60_000;
const COMPLETED_TTL_MS = 2 * 60_000;

let inFlight = new Map<string, InFlightEntry>();
let completed = new Map<string, CompletedEntry>();

export function resetAgentIdempotencyStoreForTests(): void {
  inFlight = new Map();
  completed = new Map();
}

function nowMs(): number {
  return Date.now();
}

function prune(storeNow = nowMs()): void {
  for (const [key, entry] of inFlight) {
    if (entry.startedAt + IN_FLIGHT_TTL_MS < storeNow) {
      inFlight.delete(key);
    }
  }
  for (const [key, entry] of completed) {
    if (entry.completedAt + COMPLETED_TTL_MS < storeNow) {
      completed.delete(key);
    }
  }
}

export function normalizeIdempotencyKey(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string") {
    throw new AgentInputValidationError("Idempotency-Key must be a string.");
  }
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > AGENT_INPUT_LIMITS.idempotencyKey) {
    throw new AgentInputValidationError(
      `Idempotency-Key exceeds ${AGENT_INPUT_LIMITS.idempotencyKey} characters.`,
    );
  }
  return trimmed;
}

export function buildAgentActionFingerprint(parts: Record<string, unknown>): string {
  const stable = JSON.stringify(parts, Object.keys(parts).sort());
  return createHash("sha256").update(stable).digest("hex");
}

function storeKey(input: {
  clientKey: string;
  action: AgentIdempotencyAction;
  idempotencyKey: string | null;
  fingerprint: string;
}): string {
  if (input.idempotencyKey) {
    return `idem:${input.action}:${input.clientKey}:${input.idempotencyKey}`;
  }
  // Without an explicit key, still collapse identical in-flight duplicates.
  return `inflight:${input.action}:${input.clientKey}:${input.fingerprint}`;
}

export type AgentIdempotencyBeginResult =
  | { kind: "proceed"; storeKey: string }
  | { kind: "in_progress"; retryAfterSeconds: number }
  | { kind: "replay"; status: number; body: unknown };

export function beginAgentIdempotentAction(input: {
  clientKey: string;
  action: AgentIdempotencyAction;
  idempotencyKey: string | null;
  fingerprint: string;
}): AgentIdempotencyBeginResult {
  prune();
  const key = storeKey(input);
  const done = completed.get(key);
  if (done && done.fingerprint === input.fingerprint) {
    return { kind: "replay", status: done.status, body: done.body };
  }
  if (done && input.idempotencyKey) {
    // Same idempotency key with different payload is a conflict.
    return {
      kind: "replay",
      status: 409,
      body: {
        ok: false,
        error:
          "Idempotency-Key was already used with a different request payload.",
        code: "idempotency_payload_conflict",
      },
    };
  }

  const existing = inFlight.get(key);
  if (existing) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.startedAt + IN_FLIGHT_TTL_MS - nowMs()) / 1000),
    );
    return { kind: "in_progress", retryAfterSeconds };
  }

  inFlight.set(key, { startedAt: nowMs(), fingerprint: input.fingerprint });
  return { kind: "proceed", storeKey: key };
}

export function completeAgentIdempotentAction(input: {
  storeKey: string;
  fingerprint: string;
  status: number;
  body: unknown;
}): void {
  inFlight.delete(input.storeKey);
  completed.set(input.storeKey, {
    completedAt: nowMs(),
    fingerprint: input.fingerprint,
    status: input.status,
    body: input.body,
  });
}

export function failAgentIdempotentAction(storeKey: string): void {
  inFlight.delete(storeKey);
}

/** Async entrypoint used by billable routes. */
export async function beginAgentIdempotentActionAsync(input: {
  clientKey: string;
  action: AgentIdempotencyAction;
  idempotencyKey: string | null;
  fingerprint: string;
}): Promise<AgentIdempotencyBeginResult> {
  if (usesProcessLocalAgentProtection()) {
    return beginAgentIdempotentAction(input);
  }
  if (usesDurableAgentProtection()) {
    return durableBeginAgentIdempotentAction(input);
  }
  // Never fall back to process-local Maps when durable protection is required
  // but unavailable (Vercel production/preview fail-closed).
  throw new DurableAgentStoreError(
    "Durable shared protection unavailable; refusing process-local idempotency.",
  );
}

export async function completeAgentIdempotentActionAsync(input: {
  storeKey: string;
  fingerprint: string;
  status: number;
  body: unknown;
}): Promise<void> {
  if (usesProcessLocalAgentProtection()) {
    completeAgentIdempotentAction(input);
    return;
  }
  if (usesDurableAgentProtection()) {
    await durableCompleteAgentIdempotentAction(input);
    return;
  }
  throw new DurableAgentStoreError(
    "Durable shared protection unavailable; refusing process-local idempotency complete.",
  );
}

export async function failAgentIdempotentActionAsync(
  storeKey: string,
): Promise<void> {
  if (usesProcessLocalAgentProtection()) {
    failAgentIdempotentAction(storeKey);
    return;
  }
  if (usesDurableAgentProtection()) {
    try {
      await durableFailAgentIdempotentAction(storeKey);
    } catch {
      // Best-effort cleanup — do not mask the original route error.
    }
    return;
  }
  // Disabled: no durable in-flight record to clear; never touch process-local Maps.
}
