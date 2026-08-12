const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
/** Prefer explicit phone shapes; avoid chewing hex digests / git SHAs. */
const PHONE_RE = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;

export function redactPii(value: string): string {
  return value.replace(EMAIL_RE, "[redacted-email]").replace(PHONE_RE, "[redacted-phone]");
}

export function redactDeep<T>(value: T): T {
  if (typeof value === "string") return redactPii(value) as T;
  if (Array.isArray(value)) return value.map((item) => redactDeep(item)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "sha256" || k === "codeVersion" || k === "importVersion") {
        out[k] = v;
        continue;
      }
      if (
        /email|phone|first_name|last_name|dob|signer|address/i.test(k) &&
        typeof v === "string" &&
        !/^(sha256|codeVersion)$/i.test(k)
      ) {
        out[k] = "[redacted]";
      } else {
        out[k] = redactDeep(v);
      }
    }
    return out as T;
  }
  return value;
}
