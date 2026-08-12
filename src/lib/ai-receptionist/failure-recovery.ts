export type RetryDecision =
  | { action: "retry"; attempt: number }
  | { action: "dead_letter"; attempt: number; reason: string }
  | { action: "reuse_idempotency"; attempt: number };

export function decideBookingRetry(options: {
  attemptCount: number;
  maxAttempts: number;
  lastCode?: string | null;
}): RetryDecision {
  const attempt = options.attemptCount;
  if (options.lastCode === "conflict") {
    return {
      action: "dead_letter",
      attempt,
      reason: "inventory_conflict",
    };
  }
  if (attempt < options.maxAttempts) {
    return { action: "reuse_idempotency", attempt: attempt + 1 };
  }
  return {
    action: "dead_letter",
    attempt,
    reason: "max_attempts_exceeded",
  };
}

export function shouldEscalateAfterFailure(options: {
  attemptCount: number;
  maxAttempts: number;
  lastCode?: string | null;
}): boolean {
  const decision = decideBookingRetry(options);
  return decision.action === "dead_letter";
}
