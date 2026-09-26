const MAX_SECURITY_MESSAGE_LENGTH = 240;

const SECRET_PATTERNS: RegExp[] = [
  /\bAuthorization\s*:\s*Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\b(?:api[_-]?key|token|secret|password|authorization|x-aik-api-secret)\s*[:=]\s*["']?[^"'\s,;&]+/gi,
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\bGOCSPX-[A-Za-z0-9_-]+\b/g,
];

const SENSITIVE_QUERY_KEYS = /(?:token|secret|key|api_key|apikey|password|authorization|code|state|signature|sig|access_token|refresh_token)/i;

function redactUrlSearchParams(value: string): string {
  return value.replace(/https?:\/\/[^\s<>"')]+/gi, (candidate) => {
    try {
      const url = new URL(candidate);
      let redacted = false;
      for (const key of Array.from(url.searchParams.keys())) {
        if (SENSITIVE_QUERY_KEYS.test(key)) {
          url.searchParams.set(key, "[redacted]");
          redacted = true;
        }
      }
      return redacted ? url.toString() : candidate;
    } catch {
      return candidate;
    }
  });
}

export function sanitizeSecurityMessage(value: unknown, fallback = "Security status is unavailable."): string {
  const raw = typeof value === "string" ? value : "";
  let sanitized = redactUrlSearchParams(raw)
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      const separator = match.includes("=") ? "=" : match.includes(":") ? ":" : " ";
      const label = match.slice(0, Math.max(0, match.indexOf(separator))).trim();
      return label ? `${label}${separator}[redacted]` : "[redacted]";
    });
  }

  if (!sanitized) sanitized = fallback;
  return sanitized.slice(0, MAX_SECURITY_MESSAGE_LENGTH);
}

export function sanitizeAikidoDetailsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "app.aikido.dev") return null;
    if (!url.pathname.startsWith("/featurebranch/scan/")) return null;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
