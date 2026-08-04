import { createHash, randomBytes } from "node:crypto";

export function createPublicCompletionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashIpAddress(ip: string | null | undefined): string | null {
  const value = ip?.trim();
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createIdempotencyKeyFallback(parts: string[]): string {
  return sha256Hex(parts.join("|")).slice(0, 64);
}
