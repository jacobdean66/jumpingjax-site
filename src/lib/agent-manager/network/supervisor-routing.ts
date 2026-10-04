import { AGENT_DIRECTORY, type NetworkSkill } from "./contracts";
// Explicit commands only: existing free-form status/control behavior stays intact.
export function supervisorNetworkRequest(message: string) {
  const match = /^ask (?:the )?(.+?) to (.+)$/i.exec(message.trim());
  if (!match) return null;
  const target = match[1].toLowerCase().replace(/ agent$/, "");
  const aliases: Record<string, string> = { security: "health-security", health: "health-security", invitation: "party-invitation", party: "party-invitation", "answering machine": "answering-machine" };
  const agent = AGENT_DIRECTORY.find((a) => a.key === (aliases[target] ?? target) || a.name.toLowerCase().replace(/ agent$/, "") === target);
  if (!agent) return null;
  const instruction = match[2].toLowerCase().replace(/[.!?]+$/, "").trim();
  if (agent.skills.includes("social_handoff") && /^(prepare|draft)\b/.test(instruction)) return { recipient: agent.key, skill: "social_handoff" as const, input: { message: match[2] } };
  const actions: Record<string, NetworkSkill> = { "discover agents": "directory", "list agents": "directory", "check website health": "health", "review booking workflows": "workflow_review", "review waiver integrity": "waiver_review", "check nomination setup": "nomination_readiness", "list invitation themes": "invitation_themes", "review code health": "code_review", "review security evidence": "security_review", "check calling setup": "call_readiness" };
  const skill = actions[instruction];
  return skill && agent.skills.includes(skill) ? { recipient: agent.key, skill, input: {} } : null;
}
