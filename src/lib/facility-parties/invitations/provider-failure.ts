/** Safe metadata only. Never retain the original error, message, body or headers. */
export type ProviderFailure = {
  status?: number;
  providerType: "http" | "timeout" | "connection" | "aborted" | "unknown";
  providerErrorType?: "invalid_request_error" | "authentication_error" | "permission_error" | "rate_limit_error" | "insufficient_quota" | "server_error" | "api_error";
};

const acceptedErrorTypes = new Set<NonNullable<ProviderFailure["providerErrorType"]>>([
  "invalid_request_error", "authentication_error", "permission_error", "rate_limit_error",
  "insufficient_quota", "server_error", "api_error",
]);

function field(error: unknown, key: string): unknown {
  if (!error || typeof error !== "object") return undefined;
  try { return (error as Record<string, unknown>)[key]; } catch { return undefined; }
}

export function safeProviderFailure(error: unknown): ProviderFailure {
  const rawStatus = field(error, "status");
  const status = typeof rawStatus === "number" && Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599 ? rawStatus : undefined;
  // SDK Error.name is generic; the class identifies network/timeout failures.
  let name: unknown;
  if (error instanceof Error) {
    try { name = error.constructor.name; } catch { /* Unknown name stays unknown. */ }
  }
  const errorName = field(error, "name");
  const providerType: ProviderFailure["providerType"] = status !== undefined ? "http"
    : name === "APIConnectionTimeoutError" || errorName === "TimeoutError" ? "timeout"
    : name === "APIConnectionError" ? "connection"
    : name === "APIUserAbortError" || errorName === "AbortError" ? "aborted"
    : "unknown";
  const rawType = field(error, "type");
  const providerErrorType = typeof rawType === "string" && acceptedErrorTypes.has(rawType as NonNullable<ProviderFailure["providerErrorType"]>)
    ? rawType as NonNullable<ProviderFailure["providerErrorType"]> : undefined;
  return { ...(status !== undefined ? { status } : {}), providerType, ...(providerErrorType ? { providerErrorType } : {}) };
}
