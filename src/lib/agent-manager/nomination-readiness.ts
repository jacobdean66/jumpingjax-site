import "server-only";

const REQUIRED_CONFIGURATION = [
  ["Trigger.dev credential", "TRIGGER_SECRET_KEY"],
  ["Resend API credential", "RESEND_API_KEY"],
  ["Resend webhook signature", "RESEND_WEBHOOK_SECRET"],
  ["Inbound nomination address", "NOMINATION_AGENT_INBOUND_RECIPIENT"],
  ["Application callback URL", "AGENT_MANAGER_APP_URL"],
  ["Application callback secret", "AGENT_MANAGER_CALLBACK_SECRET"],
] as const;

export function getNominationAgentReadiness() {
  const missing = REQUIRED_CONFIGURATION
    .filter(([, key]) => !process.env[key]?.trim())
    .map(([label]) => label);
  const enabled = process.env.NOMINATION_AGENT_INBOUND_ENABLED === "1";
  return {
    enabled,
    configured: missing.length === 0,
    missing,
    status: enabled && missing.length === 0 ? "READY" : enabled ? "CONFIGURATION ERROR" : "DISABLED",
  } as const;
}
