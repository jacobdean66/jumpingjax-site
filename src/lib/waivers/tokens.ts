import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Completion token lifetime after signing. Owner review may adjust. */
export const WAIVER_COMPLETION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Prefer dedicated evidence secret when present.
 * Falls back to ADMIN_SESSION_SECRET. Does not invent env vars.
 */
export function getWaiverHmacSecret(): string | null {
  const dedicated = process.env.WAIVER_EVIDENCE_HMAC_SECRET?.trim();
  if (dedicated && dedicated.length >= 32) return dedicated;
  const session = process.env.ADMIN_SESSION_SECRET?.trim();
  if (session && session.length >= 32) return session;
  return null;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashPublicToken(token: string): string {
  return sha256Hex(token);
}

export function createPublicCompletionToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Deterministic completion token bound to the mandatory idempotency key.
 * Allows safe reissue on identical idempotent replay without storing plaintext.
 */
export function deriveCompletionTokenFromIdempotencyKey(
  idempotencyKey: string,
): string {
  const secret = getWaiverHmacSecret();
  if (!secret) {
    throw new Error("waiver_hmac_secret_missing");
  }
  return createHmac("sha256", secret)
    .update(`waiver-completion-token:v1:${idempotencyKey}`)
    .digest("base64url");
}

export function hmacIpAddress(ip: string | null | undefined): string | null {
  const value = ip?.trim();
  if (!value) return null;
  const secret = getWaiverHmacSecret();
  if (!secret) {
    // Safe missing-configuration boundary: omit IP evidence rather than store
    // unsalted hashes or invent environment variables.
    return null;
  }
  return createHmac("sha256", secret).update(`ip:${value}`).digest("hex");
}

/** @deprecated Use hmacIpAddress. Kept only for test migration clarity. */
export function hashIpAddress(ip: string | null | undefined): string | null {
  return hmacIpAddress(ip);
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, "utf8");
    const right = Buffer.from(b, "utf8");
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function canonicalRequestHash(payload: unknown): string {
  return sha256Hex(stableStringify(payload));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(",")}}`;
}
