import type { SupervisorIssue } from "@/lib/agent-manager/supervisor";
import type { DashboardServiceCoverage } from "@/lib/agent-manager/service-coverage";

export function agentConversationHref(key: string) {
  return key === "supervisor" ? "/admin/agents#supervisor" : `/admin/agents?agent=${encodeURIComponent(key)}#agent-conversations`;
}

export function agentWorkspaceHref(key: string): string | undefined {
  if (["social", "campaign-strategist", "creative-director", "independent-reviewer", "social-strategy-copy", "image-director", "video-director"].includes(key)) return "/admin/social-posts";
  return ({ booking: "/admin/rentals", availability: "/admin/schedule", waiver: "/admin/check-in", nomination: "/admin/giveaway", "party-invitation": "/admin/facility", coding: "/admin/security", "health-security": "/admin/security", "answering-machine": "/admin/answering-machine", receptionist: "/admin/answering-machine" } as Record<string, string>)[key];
}

export function supervisorIssueAction(issue: Pick<SupervisorIssue, "code" | "area">, services: Pick<DashboardServiceCoverage, "key" | "href" | "name">[]) {
  const [source, key] = issue.code.split(":");
  const service = source === "service" ? services.find((item) => item.key === key) : undefined;
  if (service) return { href: service.href, label: `Open ${service.name}` };
  const workspace = source === "agents" ? agentWorkspaceHref(key) : undefined;
  if (workspace) return { href: workspace, label: "Open agent workspace" };
  return { href: { website: "/admin/site-settings", bookings: "/admin/rentals", rentals: "/admin/rentals", agents: "#agent-controls", answering_machine: "/admin/answering-machine", security: "/admin/security" }[issue.area], label: `Open ${issue.area.replaceAll("_", " ")}` };
}
