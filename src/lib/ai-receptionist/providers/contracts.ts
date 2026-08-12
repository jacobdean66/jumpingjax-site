export type TelephonyProvider = "vapi" | "retell" | "twilio_openai_realtime";

export type NormalizedCallEvent = {
  provider: TelephonyProvider;
  eventId: string;
  eventType:
    | "call.started"
    | "call.updated"
    | "call.ended"
    | "call.transfer_requested"
    | "unknown";
  callId: string;
  occurredAtIso: string;
  payload: Record<string, unknown>;
};

export type WebhookVerificationInput = {
  rawBody: string;
  headers: Headers;
  publicUrl: string;
  nowMs: number;
};

export type WebhookVerificationResult =
  | { ok: true; eventId: string; timestampMs: number }
  | { ok: false; code: "missing_signature" | "invalid_signature" | "stale_timestamp" | "invalid_payload" };

export interface ProviderWebhookAdapter {
  readonly provider: TelephonyProvider;
  verify(input: WebhookVerificationInput): Promise<WebhookVerificationResult>;
  normalize(rawBody: string): NormalizedCallEvent;
}

export interface ProviderCallControl {
  readonly provider: TelephonyProvider;
  transfer(callId: string, destinationE164: string): Promise<{ accepted: boolean }>;
  end(callId: string): Promise<{ accepted: boolean }>;
}

export const WEBHOOK_LIMITS = {
  maxBodyBytes: 256_000,
  maxClockSkewMs: 5 * 60_000,
  replayTtlMs: 10 * 60_000,
  requestsPerMinutePerKey: 60,
  providerTimeoutMs: 7_000,
} as const;

export function validateNormalizedCallEvent(value: unknown): NormalizedCallEvent {
  if (!value || typeof value !== "object") throw new Error("invalid_event");
  const event = value as Partial<NormalizedCallEvent>;
  if (
    !["vapi", "retell", "twilio_openai_realtime"].includes(String(event.provider)) ||
    !event.eventId ||
    !event.callId ||
    !event.occurredAtIso ||
    Number.isNaN(Date.parse(event.occurredAtIso)) ||
    !event.payload ||
    typeof event.payload !== "object"
  ) throw new Error("invalid_event");
  return event as NormalizedCallEvent;
}

export function assertWebhookBodySize(rawBody: string, maxBytes = WEBHOOK_LIMITS.maxBodyBytes) {
  if (new TextEncoder().encode(rawBody).byteLength > maxBytes) {
    throw new Error("webhook_body_too_large");
  }
}

export class InMemoryReplayGuard {
  private readonly seen = new Map<string, number>();

  accept(key: string, nowMs: number, ttlMs = WEBHOOK_LIMITS.replayTtlMs): boolean {
    for (const [id, expiresAt] of this.seen) if (expiresAt <= nowMs) this.seen.delete(id);
    if (this.seen.has(key)) return false;
    this.seen.set(key, nowMs + ttlMs);
    return true;
  }
}

export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, { startMs: number; count: number }>();

  accept(key: string, nowMs: number, limit = WEBHOOK_LIMITS.requestsPerMinutePerKey): boolean {
    const current = this.windows.get(key);
    if (!current || nowMs - current.startMs >= 60_000) {
      this.windows.set(key, { startMs: nowMs, count: 1 });
      return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
  }
}

export async function withProviderTimeout<T>(
  operation: Promise<T>,
  timeoutMs = WEBHOOK_LIMITS.providerTimeoutMs,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("provider_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
