import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadLiveCompositeAvailabilityBlocks } from "../composite-availability-service";
import { buildCompositeBookingDryRun, type CompositeServiceRequest } from "../composite-booking";
import { nextBookingConversationPrompt } from "../booking-conversation";
import { identifyWaiverTriageIssues } from "../waiver-triage";
import { getNominationAgentReadiness } from "../nomination-readiness";
import { getAnsweringMachineReadiness } from "@/lib/answering-machine/readiness";
import { loadSecurityDashboard } from "@/lib/security/dashboard-service";
import { INVITATION_THEMES } from "@/lib/facility-parties/invitations/theme-catalog";
import { prepareSupervisorHandoff } from "../supervisor-handoff";
import { collectSupervisorSnapshot } from "../supervisor-service";
import { AGENT_DIRECTORY, type NetworkResult } from "./contracts";
import type { AgentAdapter, AdapterContext, AdapterOutput } from "./engine";

const completed = (summary: string, data: Record<string, unknown> = {}): NetworkResult => ({ status: "completed", summary, data });
// Injected dependencies are also used by the synthetic integration tests.
export const adapterDependencies = {
  async health(actorId: string) {
    const snapshot = await collectSupervisorSnapshot(actorId);
    return { generatedAt: snapshot.generatedAt, deployment: snapshot.deployment, issues: snapshot.issues, agents: snapshot.agents, dataErrors: snapshot.dataErrors };
  },
  async bookingWorkflows() {
    const db = createServiceRoleClient();
    const { data, error } = await db.from("booking_integration_workflows").select("booking_kind,initial_customer_email_status,owner_notification_status,decision_email_status,calendar_status,operator_required").or("operator_required.eq.true,initial_customer_email_status.eq.failed,owner_notification_status.eq.failed,decision_email_status.eq.failed,calendar_status.eq.failed").limit(100);
    if (error) throw new Error("Workflow evidence unavailable.");
    return { reviewed: data.length, cappedAt: 100, workflows: data };
  },
  async waiverIntegrity() {
    const db = createServiceRoleClient();
    const { data, error } = await db.from("waiver_submissions").select("id,status,created_at,waiver_signatures(id),waiver_documents(id,generated_at,sha256)").eq("status", "completed").order("created_at", { ascending: false }).limit(25);
    if (error) throw new Error("Waiver evidence unavailable.");
    const counts: Record<string, number> = {};
    for (const row of data) for (const issue of identifyWaiverTriageIssues(row)) counts[issue.issue] = (counts[issue.issue] ?? 0) + 1;
    return { reviewed: data.length, cappedAt: 25, issues: counts };
  },
  async availability() {
    // The existing planner loads at most 500 active rows per source. Refuse to
    // report a conflict-free review when it cannot see the complete source.
    const db = createServiceRoleClient();
    const [rentals, facilities] = await Promise.all([
      db.from("bookings").select("id", { head: true, count: "exact" }).in("status", ["pending", "approved", "blocked"]),
      db.from("facility_bookings").select("id", { head: true, count: "exact" }).in("status", ["pending", "confirmed"]),
    ]);
    if (rentals.error || facilities.error || rentals.count === null || facilities.count === null || rentals.count >= 500 || facilities.count >= 500) throw new Error("Complete schedule evidence unavailable.");
    return loadLiveCompositeAvailabilityBlocks();
  },
  nomination: () => getNominationAgentReadiness(),
  calling: () => getAnsweringMachineReadiness(),
  async security(actorId: string) { const dashboard = await loadSecurityDashboard(actorId); return dashboard.services.map((s) => ({ name: s.name, state: s.state, summary: s.summary })); },
  social: (message: string) => prepareSupervisorHandoff(message),
  themes: () => INVITATION_THEMES.map((theme) => ({ id: theme.id, label: theme.label, family: theme.family })),
};

export function createAgentAdapters(deps = adapterDependencies): AgentAdapter[] {
  async function execute(skill: string, input: Record<string, unknown>, context: AdapterContext): Promise<AdapterOutput> {
    const { task } = context;
    switch (skill) {
      case "directory": return completed(`${AGENT_DIRECTORY.length} agent adapters are registered.`, { agents: AGENT_DIRECTORY });
      case "health": { const data = await deps.health(task.actor_id); return completed("Website health evidence reviewed.", data); }
      case "booking_review": return { delegate: { recipient: task.recipient_key === "booking" ? "availability" : "booking", skill: task.recipient_key === "booking" ? "availability_review" : "booking_review", input }, summary: "Requested the existing booking and schedule review." };
      case "availability_review": {
        const request = { conversationRef: task.context_id, revision: 1, services: input.services as CompositeServiceRequest[] };
        const plan = buildCompositeBookingDryRun(request, await deps.availability());
        const prompt = nextBookingConversationPrompt(plan);
        return { status: "input_required", summary: prompt?.text ?? "Owner review is required. Nothing has been reserved.", data: { planStatus: plan.status, missing: plan.missing, conflicts: plan.conflicts, nextPrompt: prompt, reservationCreated: false, finalInventoryCheckRequired: true }, links: [{ label: "Review booking requests", href: "/admin/rentals" }] };
      }
      case "workflow_review": return completed("Existing booking workflow failures reviewed.", await deps.bookingWorkflows());
      case "waiver_review": return completed("Completed waiver signature and document integrity reviewed.", await deps.waiverIntegrity());
      case "nomination_readiness": { const r = deps.nomination(); return completed("Nomination configuration checked; email receipt acceptance is separate.", { status: r.status, enabled: r.enabled, configured: r.configured, missing: r.missing }); }
      case "invitation_themes": return { ...completed("Existing invitation themes found.", { themes: deps.themes() }), links: [{ label: "Open facility invitations", href: "/admin/facility" }] };
      case "social_handoff": {
        if (task.recipient_key !== "social") return { delegate: { recipient: "social", skill: "social_handoff", input }, summary: "Requested the existing Social Posts review workflow." };
        const handoff = await deps.social(String(input.message));
        return { status: "input_required", summary: handoff?.outcome ?? "Describe the social post you want in the existing review workflow.", data: { published: false, scheduled: false, modelCalls: 0 }, links: [{ label: handoff?.relatedAction.label ?? "Open Social Posts", href: handoff?.relatedAction.href ?? "/admin/social-posts/new" }] };
      }
      case "code_review": { const h = await deps.health(task.actor_id); return completed("Deployed code health reviewed. Repairs require the existing review workflow.", h); }
      case "security_review": return completed("Security provider evidence reviewed.", { services: await deps.security(task.actor_id) });
      case "call_readiness": { const r = deps.calling(); return completed("Calling configuration checked; no real call acceptance test was performed.", { provider: r.provider, mode: r.mode, configured: r.configured, enabled: r.enabled, configurationStatus: r.status, missing: r.missing, realCallVerified: false }); }
      default: throw new Error("Unsupported adapter capability.");
    }
  }
  return AGENT_DIRECTORY.map((agent) => ({ key: agent.key, execute }));
}
