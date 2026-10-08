export type AgentNavigationSummary = {
  checkedAt: string | null;
  critical: number | null;
  warnings: number | null;
  approvals: number | null;
  coverage: { checked: number; total: number } | null;
};

export const UNKNOWN_AGENT_SUMMARY: AgentNavigationSummary = { checkedAt: null, critical: null, warnings: null, approvals: null, coverage: null };

/** Only project safe, validated counts; never send stored job payloads to navigation. */
export function agentNavigationSummary(value: unknown): AgentNavigationSummary {
  if (!value || typeof value !== "object") return UNKNOWN_AGENT_SUMMARY;
  const snapshot = value as Record<string, unknown>;
  if (typeof snapshot.generatedAt !== "string" || !Number.isFinite(Date.parse(snapshot.generatedAt))) return UNKNOWN_AGENT_SUMMARY;
  const issues = Array.isArray(snapshot.issues) && snapshot.issues.every(issue => issue && typeof issue === "object" && ["info", "warning", "critical"].includes(issue.severity)) ? snapshot.issues : null;
  const agents = snapshot.agents && typeof snapshot.agents === "object" ? snapshot.agents as Record<string, unknown> : null;
  const services = Array.isArray(snapshot.services) ? snapshot.services : null;
  const approvals = agents?.approvalsWaiting;
  return {
    checkedAt: snapshot.generatedAt,
    critical: issues ? issues.filter(issue => issue.severity === "critical").length : null,
    warnings: issues ? issues.filter(issue => issue.severity === "warning").length : null,
    approvals: typeof approvals === "number" && Number.isSafeInteger(approvals) && approvals >= 0 ? approvals : null,
    coverage: services && services.length > 0 && services.every(service => service && ["connected", "degraded", "setup_required", "unavailable"].includes(service.state)) ? { checked: services.filter(service => service.state === "connected").length, total: services.length } : null,
  };
}
