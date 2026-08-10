export type AgentOutputSource = "model" | "deterministic-fallback";

export type AgentProviderId = "openai" | "none";

export type AgentFailureKind =
  | "not_configured"
  | "timeout"
  | "provider_failure"
  | "schema_failure"
  | "empty_response"
  | "unknown";

export type AgentId =
  | "campaign-strategist"
  | "creative-director"
  | "independent-reviewer"
  | "social-strategy-copy"
  | "image-director"
  | "video-director";

export type AgentDiagnostics = {
  agentId: AgentId;
  source: AgentOutputSource;
  provider: AgentProviderId;
  model: string | null;
  requestId: string;
  fallbackReason: string | null;
  timedOut: boolean;
  truncatedInput: boolean;
  failureKind: AgentFailureKind | null;
};

export type AgentSuccess<T> = {
  ok: true;
  output: T;
  diagnostics: AgentDiagnostics;
};

export type AgentFailure = {
  ok: false;
  error: string;
  diagnostics: AgentDiagnostics;
};

export type AgentResult<T> = AgentSuccess<T> | AgentFailure;

export function createRequestId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function classifyAgentFailureKind(
  error: string | null | undefined,
): AgentFailureKind {
  if (!error) return "unknown";
  if (/not configured/i.test(error)) return "not_configured";
  if (/timed out|timeout|aborted/i.test(error)) return "timeout";
  if (/schema validation|unknown keys|invalid non-string|invalid JSON/i.test(error)) {
    return "schema_failure";
  }
  if (/empty response/i.test(error)) return "empty_response";
  if (/rate limit|authentication|provider|openai|language model/i.test(error)) {
    return "provider_failure";
  }
  return "unknown";
}

export function sanitizeAgentError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Agent request failed.";
  }

  const message = error.message.replace(/\s+/g, " ").trim();
  if (!message) return "Agent request failed.";

  const scrubbed = message
    .replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/api[_-]?key[=:]\s*\S+/gi, "api_key=[redacted]");

  if (/timeout|aborted|AbortError/i.test(scrubbed)) {
    return "Language model request timed out.";
  }
  if (/rate limit|429/i.test(scrubbed)) {
    return "Language model rate limit reached. Try again shortly.";
  }
  if (/401|unauthorized|invalid api key/i.test(scrubbed)) {
    return "Language model provider authentication failed.";
  }

  return scrubbed.length > 240 ? `${scrubbed.slice(0, 237)}...` : scrubbed;
}
