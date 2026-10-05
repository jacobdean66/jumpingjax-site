import { z } from "zod";

export const NETWORK_JOB_TYPE = "agent.network.dispatch";
export const MAX_NETWORK_HOPS = 4;
export const MAX_CONTEXT_TASKS = 24;
export const agentKeys = ["supervisor", "booking", "availability", "waiver", "nomination", "party-invitation", "social", "coding", "health-security", "answering-machine", "receptionist", "campaign-strategist", "creative-director", "independent-reviewer", "social-strategy-copy", "image-director", "video-director"] as const;
export type NetworkAgentKey = typeof agentKeys[number];
const empty = z.object({}).strict();
const safeText = z.string().trim().min(1).max(800).refine((v) => !/(?:\bBearer\s+\S+|\bsk-[\w-]+|\bEAA[\w-]{20,}|(?:password|access[_ -]?token|api[_ -]?key|secret)\s*[:=])/i.test(v), "Remove credentials from the request.");
const service = z.object({ kind: z.enum(["rental", "facility_party", "foam_party"]), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => { const d = new Date(`${v}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v; }).optional(), startMinutes: z.number().int().min(0).max(1439).optional(), durationMinutes: z.number().int().min(1).max(1440).optional(), itemRefs: z.array(z.string().regex(/^[\w -]{1,80}$/)).min(1).max(10).optional(), packageRef: z.string().regex(/^[\w -]{1,80}$/).optional(), locationRef: z.string().regex(/^[\w -]{1,120}$/).optional(), distanceMiles: z.number().min(0).max(500).optional() }).strict();
const bookingInput = z.object({ services: z.array(service).min(1).max(3).refine((s) => new Set(s.map((v) => v.kind)).size === s.length) }).strict();
export const skills = {
  directory: { name: "Discover agents", schema: empty }, health: { name: "Review website health", schema: empty },
  booking_review: { name: "Review a booking request", schema: bookingInput }, availability_review: { name: "Review schedule conflicts", schema: bookingInput },
  workflow_review: { name: "Review booking integration failures", schema: empty }, waiver_review: { name: "Review waiver document integrity", schema: empty },
  nomination_readiness: { name: "Review nomination intake setup", schema: empty }, invitation_themes: { name: "Find invitation themes", schema: empty },
  social_handoff: { name: "Prepare a Social Posts review handoff", schema: z.object({ message: safeText }).strict() },
  code_review: { name: "Review deployed code health", schema: empty }, security_review: { name: "Review security provider evidence", schema: empty }, call_readiness: { name: "Review calling configuration", schema: empty },
} as const;
export type NetworkSkill = keyof typeof skills;
export type AgentDefinition = { key: NetworkAgentKey; name: string; description: string; skills: NetworkSkill[]; controlKey: NetworkAgentKey };
const define = (key: NetworkAgentKey, name: string, description: string, available: NetworkSkill[], controlKey: NetworkAgentKey = key): AgentDefinition => ({ key, name, description, skills: ["directory", ...available], controlKey });
export const AGENT_DIRECTORY: AgentDefinition[] = [
  define("supervisor", "Agent Manager", "Coordinates persistent requests and reads operational health.", ["health"]),
  define("booking", "Booking Agent", "Reviews requests and delegates schedule checks; booking creation uses owner review.", ["booking_review", "workflow_review"]),
  define("availability", "Schedule Review Agent", "Runs the existing composite conflict planner. Review is not a reservation or final inventory guarantee.", ["availability_review"], "booking"),
  define("waiver", "Waiver Agent", "Reviews signature/document metadata without participant details.", ["waiver_review"]),
  define("nomination", "Nomination Agent", "Reports readiness of the existing signed email intake.", ["nomination_readiness"]),
  define("party-invitation", "Party / Invitation Agent", "Reports invitation layouts, the indexed licensed artwork repository, team search and supervisor acceptance rules; selection and saving use the invitation builder.", ["invitation_themes"]),
  define("social", "Social Agent", "Finds an existing draft or prepares the owner-review workflow.", ["social_handoff"]),
  define("coding", "Coding Agent", "Reads deployed evidence; repairs use the reviewed workflow.", ["code_review"]),
  define("health-security", "Health / Security Agent", "Reads existing security provider evidence.", ["security_review"]),
  define("answering-machine", "Answering Machine", "Reports configuration readiness; real call acceptance is separate.", ["call_readiness", "booking_review"]),
  define("receptionist", "Receptionist", "Delegates structured inquiries to Booking through this server interface.", ["booking_review", "call_readiness"], "answering-machine"),
  ...(["campaign-strategist", "creative-director", "independent-reviewer", "social-strategy-copy", "image-director", "video-director"] as const).map((key) => define(key, key.split("-").map((s) => s[0].toUpperCase() + s.slice(1)).join(" "), "Routes review requests into the staged Social Posts workflow. Model generation requires its existing checkpoints.", ["social_handoff"], "social")),
];
export function definition(key: string) { const found = AGENT_DIRECTORY.find((a) => a.key === key); if (!found) throw new Error("Unknown agent."); return found; }
export function validateSkillInput(recipient: string, skill: string, input: unknown): Record<string, unknown> {
  if (!definition(recipient).skills.includes(skill as NetworkSkill)) throw new Error("Agent does not support this capability.");
  const parsed = skills[skill as NetworkSkill].schema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid capability input. Use the listed fields and remove credentials.");
  return parsed.data;
}
export const submitSchema = z.object({ requestId: z.uuid(), contextId: z.uuid().optional(), recipient: z.enum(agentKeys), skill: z.enum(Object.keys(skills) as [NetworkSkill, ...NetworkSkill[]]), input: z.record(z.string(), z.unknown()), title: safeText.max(120).optional() }).strict();
export type NetworkStatus = "queued" | "working" | "waiting" | "completed" | "input_required" | "blocked" | "failed" | "cancelled";
export type NetworkResult = { status: "completed" | "input_required" | "blocked" | "failed" | "cancelled"; summary: string; data: Record<string, unknown>; links?: Array<{ label: string; href: string }> };
export type NetworkTask = { id: string; context_id: string; sender_key: NetworkAgentKey; recipient_key: NetworkAgentKey; skill: NetworkSkill; input: Record<string, unknown>; fingerprint: string; request_id: string; parent_task_id: string | null; hop: number; actor_id: string; job_id: string; status: NetworkStatus; result: NetworkResult | null; created_at: string; updated_at: string };
export type NetworkMessage = { id: number; context_id: string; task_id: string; sender_key: string; recipient_key: string; kind: "request" | "reply" | "handoff"; summary: string; created_at: string };
export type NetworkContext = { id: string; title: string; created_at: string };
