/**
 * Supabase-backed durable store for Social Posts agent rate-limit + idempotency.
 * Fail closed on missing config / query errors. Never falls back to process-local
 * Maps on Vercel production/preview.
 */

import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  SOCIAL_POST_ADMIN_RATE_LIMITS,
  type SocialPostAdminRateLimitCategory,
  type SocialPostAdminRateLimitResult,
} from "../social-post-admin-rate-limit-core";

export type DurableAgentIdempotencyAction =
  | "agent-draft"
  | "regenerate"
  | "director-preview"
  | "image-director-preview"
  | "generate-image"
  | "generate-image-concepts"
  | "generate-media";

export type DurableAgentIdempotencyBeginResult =
  | { kind: "proceed"; storeKey: string }
  | { kind: "in_progress"; retryAfterSeconds: number }
  | { kind: "replay"; status: number; body: unknown };

export class DurableAgentStoreError extends Error {
  readonly code = "durable_store_unavailable" as const;

  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "DurableAgentStoreError";
  }
}

/** Map store failures to the same fail-closed 503 shape as protection gates. */
export function durableAgentStoreErrorResponse(
  error: unknown,
): NextResponse | null {
  if (!(error instanceof DurableAgentStoreError)) {
    return null;
  }
  return NextResponse.json(
    {
      ok: false,
      error:
        "Durable shared protection store unavailable. Billable actions remain disabled.",
      code: "durable_protection_unavailable",
    },
    { status: 503 },
  );
}

const READY_CACHE_TTL_MS = 30_000;
let readyCache: { ready: boolean; checkedAt: number } | null = null;

export function resetDurableAgentStoreReadyCacheForTests(): void {
  readyCache = null;
}

/** Env + service-role credentials present; does not prove tables exist. */
export function isDurableAgentStoreConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.SOCIAL_AGENT_DURABLE_PROTECTION === "0") {
    return false;
  }
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

/** Probes that the rate-limit table is queryable. Cached briefly per isolate. */
export async function isDurableAgentStoreReady(
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  if (!isDurableAgentStoreConfigured(env)) {
    return false;
  }

  const now = Date.now();
  if (readyCache && now - readyCache.checkedAt < READY_CACHE_TTL_MS) {
    return readyCache.ready;
  }

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("social_agent_rate_limit_buckets")
      .select("bucket_key")
      .limit(1);

    const ready = !error;
    readyCache = { ready, checkedAt: now };
    return ready;
  } catch (cause) {
    readyCache = { ready: false, checkedAt: now };
    void cause;
    return false;
  }
}

export async function durableCheckSocialPostAdminRateLimit(input: {
  clientKey: string;
  category: SocialPostAdminRateLimitCategory;
}): Promise<SocialPostAdminRateLimitResult> {
  const config = SOCIAL_POST_ADMIN_RATE_LIMITS[input.category];
  const bucketKey = `social-post-admin:${input.category}:${input.clientKey}`;

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("social_agent_rate_limit_hit", {
      p_bucket_key: bucketKey,
      p_category: input.category,
      p_limit: config.limit,
      p_window_ms: config.windowMs,
    });

    if (error) {
      throw new DurableAgentStoreError(
        "Durable rate-limit store query failed.",
        error,
      );
    }

    const payload = (data ?? {}) as {
      limited?: boolean;
      retryAfterSeconds?: number;
      category?: SocialPostAdminRateLimitCategory;
    };

    if (payload.limited) {
      return {
        limited: true,
        retryAfterSeconds: Math.max(1, Number(payload.retryAfterSeconds) || 1),
        category: payload.category ?? input.category,
      };
    }

    return { limited: false };
  } catch (cause) {
    if (cause instanceof DurableAgentStoreError) throw cause;
    throw new DurableAgentStoreError(
      "Durable rate-limit store unavailable.",
      cause,
    );
  }
}

const IN_FLIGHT_TTL_MS = 60_000;
const COMPLETED_TTL_MS = 2 * 60_000;

export function buildAgentIdempotencyStoreKey(input: {
  clientKey: string;
  action: DurableAgentIdempotencyAction;
  idempotencyKey: string | null;
  fingerprint: string;
}): string {
  if (input.idempotencyKey) {
    return `idem:${input.action}:${input.clientKey}:${input.idempotencyKey}`;
  }
  return `inflight:${input.action}:${input.clientKey}:${input.fingerprint}`;
}

export async function durableBeginAgentIdempotentAction(input: {
  clientKey: string;
  action: DurableAgentIdempotencyAction;
  idempotencyKey: string | null;
  fingerprint: string;
}): Promise<DurableAgentIdempotencyBeginResult> {
  const storeKey = buildAgentIdempotencyStoreKey(input);

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("social_agent_idempotency_begin", {
      p_store_key: storeKey,
      p_action: input.action,
      p_client_key: input.clientKey,
      p_idempotency_key: input.idempotencyKey,
      p_fingerprint: input.fingerprint,
      p_in_flight_ttl_ms: IN_FLIGHT_TTL_MS,
      p_completed_ttl_ms: COMPLETED_TTL_MS,
    });

    if (error) {
      throw new DurableAgentStoreError(
        "Durable idempotency begin failed.",
        error,
      );
    }

    const payload = (data ?? {}) as {
      kind?: string;
      storeKey?: string;
      retryAfterSeconds?: number;
      status?: number;
      body?: unknown;
    };

    if (payload.kind === "replay") {
      return {
        kind: "replay",
        status: Number(payload.status) || 200,
        body: payload.body,
      };
    }
    if (payload.kind === "in_progress") {
      return {
        kind: "in_progress",
        retryAfterSeconds: Math.max(1, Number(payload.retryAfterSeconds) || 1),
      };
    }
    return { kind: "proceed", storeKey: payload.storeKey ?? storeKey };
  } catch (cause) {
    if (cause instanceof DurableAgentStoreError) throw cause;
    throw new DurableAgentStoreError(
      "Durable idempotency store unavailable.",
      cause,
    );
  }
}

export async function durableCompleteAgentIdempotentAction(input: {
  storeKey: string;
  fingerprint: string;
  status: number;
  body: unknown;
}): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.rpc("social_agent_idempotency_complete", {
      p_store_key: input.storeKey,
      p_fingerprint: input.fingerprint,
      p_status: input.status,
      p_body: input.body as object | null,
      p_completed_ttl_ms: COMPLETED_TTL_MS,
    });
    if (error) {
      throw new DurableAgentStoreError(
        "Durable idempotency complete failed.",
        error,
      );
    }
  } catch (cause) {
    if (cause instanceof DurableAgentStoreError) throw cause;
    throw new DurableAgentStoreError(
      "Durable idempotency complete unavailable.",
      cause,
    );
  }
}

export async function durableFailAgentIdempotentAction(
  storeKey: string,
): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.rpc("social_agent_idempotency_fail", {
      p_store_key: storeKey,
    });
    if (error) {
      throw new DurableAgentStoreError(
        "Durable idempotency fail cleanup failed.",
        error,
      );
    }
  } catch (cause) {
    if (cause instanceof DurableAgentStoreError) throw cause;
    throw new DurableAgentStoreError(
      "Durable idempotency fail cleanup unavailable.",
      cause,
    );
  }
}
