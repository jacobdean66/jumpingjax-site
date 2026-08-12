/**
 * Security helpers for AI receptionist (redaction, live gate, webhook stub).
 */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

export function redactPii(value: string): string {
  return value
    .replace(EMAIL_RE, "[redacted-email]")
    .replace(PHONE_RE, "[redacted-phone]");
}

export function redactPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(payload)) {
    if (typeof raw === "string") {
      const lower = key.toLowerCase();
      if (
        lower.includes("email") ||
        lower.includes("phone") ||
        lower.includes("e164")
      ) {
        out[key] = "[redacted]";
        continue;
      }
      out[key] = redactPii(raw);
      continue;
    }
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      out[key] = redactPayload(raw as Record<string, unknown>);
      continue;
    }
    out[key] = raw;
  }
  return out;
}

export function liveActionsDisabledResponse(action: string) {
  return {
    ok: false as const,
    code: "live_actions_disabled" as const,
    error: `AI receptionist live action blocked: ${action}. Owner approval required.`,
  };
}

/**
 * Phase 1 webhook signature verifier stub.
 * Live providers must implement real HMAC verification before enabling ingress.
 */
export function verifyWebhookSignatureStub(options: {
  liveActions: boolean;
  providedSignature: string | null;
  expectedSecretConfigured: boolean;
}): { ok: true } | { ok: false; code: string } {
  if (!options.liveActions) {
    return { ok: false, code: "live_actions_disabled" };
  }
  if (!options.expectedSecretConfigured) {
    return { ok: false, code: "webhook_secret_missing" };
  }
  if (!options.providedSignature) {
    return { ok: false, code: "webhook_signature_missing" };
  }
  // Live provider verification is intentionally not implemented in Phase 1.
  return { ok: false, code: "webhook_verification_not_implemented" };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhoneToE164Loose(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}
