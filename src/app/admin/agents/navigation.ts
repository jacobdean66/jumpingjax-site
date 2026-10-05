export function askAgent(key: string) {
  window.dispatchEvent(new CustomEvent("agent-manager:select-agent", { detail: key }));
  window.location.hash = "agent-conversations";
}

export function agentWorkspaceHref(key: string): string | undefined {
  if (["social", "campaign-strategist", "creative-director", "independent-reviewer", "social-strategy-copy", "image-director", "video-director"].includes(key)) return "/admin/social-posts";
  return ({ booking: "/admin/rentals", availability: "/admin/schedule", waiver: "/admin/check-in", nomination: "/admin/giveaway", "party-invitation": "/admin/facility", coding: "/admin/security", "health-security": "/admin/security", "answering-machine": "/admin/answering-machine", receptionist: "/admin/answering-machine" } as Record<string, string>)[key];
}
