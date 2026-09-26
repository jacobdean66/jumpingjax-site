export type DashboardServiceState = "connected" | "degraded" | "setup_required" | "unavailable";

export type DashboardServiceCoverage = {
  key: string;
  name: string;
  href: string;
  state: DashboardServiceState;
  summary: string;
  checkedAt: string;
  source: "database" | "provider" | "application";
  recordCount: number | null;
  blocker: string | null;
};

export function serviceCoverageReply(services: DashboardServiceCoverage[]): string {
  const connected = services.filter((service) => service.state === "connected");
  const needsAttention = services.filter((service) => service.state !== "connected");
  const connectedNames = connected.map((service) => service.name).join(", ") || "none";
  const attention = needsAttention.length
    ? needsAttention.map((service) => `${service.name} (${service.state.replaceAll("_", " ")}): ${service.blocker ?? service.summary}`).join("; ")
    : "none";
  return `Dashboard coverage: ${connected.length}/${services.length} services connected. Connected: ${connectedNames}. Needs attention: ${attention}.`;
}

export function serviceCoverageIssueCount(services: DashboardServiceCoverage[]): number {
  return services.filter((service) => service.state === "unavailable" || service.state === "setup_required").length;
}
