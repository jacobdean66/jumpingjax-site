type ProviderError = { name?: string; statusCode?: number | null };

export function classifyEmailProviderError(error: ProviderError) {
  const name = error.name;
  if (name === "rate_limit_exceeded" || error.statusCode === 429)
    return { code: "email_rate_limited", retryable: true };
  if (name === "concurrent_idempotent_requests")
    return { code: "email_send_in_progress", retryable: true };
  if (name === "invalid_idempotent_request")
    return { code: "email_payload_conflict", retryable: false };
  if (name === "daily_quota_exceeded" || name === "monthly_quota_exceeded")
    return { code: "email_quota_exceeded", retryable: false };
  if (name === "invalid_api_key" || name === "missing_api_key" || name === "restricted_api_key" || error.statusCode === 401)
    return { code: "email_authentication_failed", retryable: false };
  if (name === "invalid_from_address" || name === "invalid_access" || error.statusCode === 403)
    return { code: "email_sender_not_authorized", retryable: false };
  if (name === "validation_error" || error.statusCode === 400 || error.statusCode === 422)
    return { code: "email_invalid_payload", retryable: false };
  if (name === "application_error" || name === "internal_server_error" || (error.statusCode ?? 0) >= 500)
    return { code: "email_provider_unavailable", retryable: true };
  return { code: "email_delivery_failed", retryable: false };
}
