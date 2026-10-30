import "server-only";

import { RENTALS } from "@/data/rentals";
import { getAnsweringMachineReadiness } from "@/lib/answering-machine/readiness";
import { scanBookingWorkflowsForTriage } from "@/lib/agent-manager/booking-triage-service";
import { scanCompositeBookingFollowUps } from "@/lib/agent-manager/booking-follow-up-service";
import { scanWaiverSubmissionsForTriage } from "@/lib/agent-manager/waiver-triage-service";
import { loadSecurityDashboard } from "@/lib/security/dashboard-service";
import { CANONICAL_PRODUCTION_SITE_URL } from "@/lib/site-url";
import { getNominationAgentReadiness } from "@/lib/agent-manager/nomination-readiness";
import { createServiceRoleClient } from "@/lib/supabase/admin";

import { buildAgentWiring } from "./agent-wiring";
import { loadDashboardServiceCoverage } from "./service-coverage-service";
import { loadBookingWorkflowHealth } from "./booking-workflow-health-service";
import { prepareSupervisorHandoff } from "./supervisor-handoff";
import { supervisorNetworkRequest } from "./network/supervisor-routing";
import { enqueueJob, loadDashboard, setAgentPaused, setEmergencyStop } from "./service";
import {
  buildSupervisorIssues,
  parseSupervisorControl,
  SUPERVISOR_CHAT_JOB_TYPE,
  SUPERVISOR_WATCH_JOB_TYPE,
  supervisorJobMessage,
  supervisorWatchKey,
  supervisorWatchSummary,
  type SupervisorSnapshot,
  type SupervisorRelatedAction,
} from "./supervisor";
import type { AgentJob } from "./types";
import { loadCodeRepairWorkerStatus } from "./code-repair-service";
import { codingConversationAction, supervisorReplyContext } from "./conversation-reply";
import { generateSupervisorReply } from "./conversation-reply-provider";
import { invitationCorrectionHref } from "@/lib/facility-parties/invitations/correction";
import { createInvestigationReader } from './investigation-service';
import { canReadOfficeMail, parseInvestigationEvidence } from './investigation';

const PROBE_PATHS = ["/", "/rentals", "/facility-parties", "/booking"] as const;
const PROBE_TIMEOUT_MS = 5_000;

async function probeWebsite(path: string, fetchImpl: typeof fetch = fetch) {
  const started = Date.now();
  try {
    const response = await fetchImpl(new URL(path, CANONICAL_PRODUCTION_SITE_URL), {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: { "User-Agent": "JumpingJax-Permanent-Agent/1.0" },
    });
    await response.body?.cancel().catch(() => undefined);
    return { path, ok: response.status >= 200 && response.status < 400, status: response.status, latencyMs: Date.now() - started };
  } catch {
    return { path, ok: false, status: null, latencyMs: Date.now() - started };
  }
}

function countOrNull(result: { count: number | null; error: { message?: string } | null }, label: string, errors: string[]) {
  if (result.error) {
    errors.push(`${label} could not be checked.`);
    return null;
  }
  return result.count ?? 0;
}

export async function collectSupervisorSnapshot(actorId = "system:supervisor", fetchImpl: typeof fetch = fetch): Promise<SupervisorSnapshot> {
  const db = createServiceRoleClient();
  const dataErrors: string[] = [];
  const [dashboardResult, securityResult, website, workflowIssues, activeRentals, activeFacilities, pendingIntents, pendingCalls, failedCalls] = await Promise.all([
    loadDashboard().then((value) => ({ value, error: null })).catch(() => ({ value: null, error: "Agent Manager status could not be checked." })),
    loadSecurityDashboard(actorId).then((value) => ({ value, error: null })).catch(() => ({ value: null, error: "Code and security status could not be checked." })),
    Promise.all(PROBE_PATHS.map((path) => probeWebsite(path, fetchImpl))),
    loadBookingWorkflowHealth().then((health) => ({ count: health.current.length, historicalCount: health.historicalCount, error: null })).catch(() => ({ count: null, historicalCount: null, error: { message: "Booking workflow health could not be checked." } })),
    db.from("bookings").select("*", { count: "exact", head: true }).in("status", ["pending", "approved", "blocked"]),
    db.from("facility_bookings").select("*", { count: "exact", head: true }).in("status", ["pending", "confirmed"]),
    db.from("composite_booking_intents").select("*", { count: "exact", head: true }).in("status", ["pending_owner_approval", "projection_staged"]),
    db.from("answering_machine_calls").select("*", { count: "exact", head: true }).in("status", ["received", "in_progress", "processing", "needs_review"]),
    db.from("answering_machine_calls").select("*", { count: "exact", head: true }).eq("status", "failed"),
  ]);

  if (dashboardResult.error) dataErrors.push(dashboardResult.error);
  if (securityResult.error) dataErrors.push(securityResult.error);
  const dashboard = dashboardResult.value;
  const readiness = getAnsweringMachineReadiness();
  const nominationReadiness = getNominationAgentReadiness();
  const security = (securityResult.value?.services ?? []).map((service) => ({ name: service.name, state: service.state, summary: service.summary }));
  const codeRepairWorker = await loadCodeRepairWorkerStatus().catch(() => ({ connected: false }));
  const services = await loadDashboardServiceCoverage({ dashboard, security }).catch(() => {
    dataErrors.push("Dashboard service coverage could not be checked.");
    return [];
  });
  const base = {
    generatedAt: new Date().toISOString(),
    deployment: {
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null,
      environment: process.env.VERCEL_ENV?.trim() || process.env.NODE_ENV || "unknown",
    },
    website,
    agents: {
      total: dashboard?.agents.length ?? 0,
      paused: dashboard?.agents.filter((agent) => agent.paused).length ?? 0,
      errors: dashboard?.agents.filter((agent) => agent.status === "error").length ?? 0,
      queuedJobs: dashboard?.queue.queued ?? 0,
      activeJobs: dashboard ? dashboard.queue.queued + dashboard.queue.claimed + dashboard.queue.running : 0,
      staleJobs: dashboard?.queue.stale ?? 0,
      failedJobs: dashboard?.jobs.filter((job) => job.status === "failed").length ?? 0,
      approvalsWaiting: dashboard?.approvals.length ?? 0,
      emergencyStop: dashboard?.emergencyStop ?? false,
    },
    bookings: {
      workflowIssues: countOrNull(workflowIssues, "Booking integration workflows", dataErrors),
      historicalWorkflowIssues: workflowIssues.historicalCount,
      activeRentals: countOrNull(activeRentals, "Active rental bookings", dataErrors),
      activeFacilityParties: countOrNull(activeFacilities, "Active facility parties", dataErrors),
      pendingCompositeIntents: countOrNull(pendingIntents, "Pending coordinated booking intents", dataErrors),
    },
    rentals: { catalogItems: RENTALS.length },
    answeringMachine: {
      live: readiness.live,
      status: readiness.status,
      pendingReview: countOrNull(pendingCalls, "Answering-machine review queue", dataErrors),
      failedCalls: countOrNull(failedCalls, "Failed answering-machine calls", dataErrors),
    },
    security,
    services,
    wiring: buildAgentWiring({ nominationReady: nominationReadiness.enabled && nominationReadiness.configured, codeRepairReady: codeRepairWorker.connected }),
    dataErrors,
  } satisfies Omit<SupervisorSnapshot, "issues">;
  return { ...base, issues: buildSupervisorIssues(base) };
}

async function finishSupervisorJob(job: AgentJob, summary: string, payload?: Record<string, unknown>) {
  const db = createServiceRoleClient();
  const now = new Date().toISOString();
  const { error } = await db.from("agent_jobs").update({
    status: "succeeded",
    attempt_count: Math.max(1, job.attempt_count),
    result_summary: summary.slice(0, 4000),
    ...(payload ? { payload } : {}),
    error_summary: null,
    started_at: now,
    completed_at: now,
    updated_at: now,
  }).eq("id", job.id).in("status", ["queued", "running", "succeeded"]);
  if (error) throw new Error("Permanent Agent conversation could not be recorded.");
  await Promise.all([
    db.from("agents").update({
      status: "idle",
      capabilities: ["system.health_check", SUPERVISOR_CHAT_JOB_TYPE, SUPERVISOR_WATCH_JOB_TYPE, "repository.read", "website.inspect", "database.operational.read", "email.office.read", "social.draft.handoff", "agent.pause", "agent.resume", "manager.emergency_stop"],
      current_job_id: null,
      last_activity_at: now,
      last_success_at: now,
      updated_at: now,
    }).eq("id", job.agent_id),
    db.from("agent_events").insert({
      agent_id: job.agent_id,
      job_id: job.id,
      event_type: job.job_type === SUPERVISOR_CHAT_JOB_TYPE ? "supervisor.replied" : "supervisor.watch_completed",
      summary: summary.slice(0, 1000),
      metadata: { aiInvocations: payload?.aiInvocations ?? 0, readOnlyLookups: Array.isArray(payload?.evidence) ? payload.evidence.length : 0, businessWrites: 0 },
    }),
  ]);
}

async function runControl(message: string, actorId: string) {
  const control = parseSupervisorControl(message);
  if (!control) return null;
  if (control.kind === "emergency_stop") {
    await setEmergencyStop(true, actorId);
    return "Emergency stop enabled and recorded.";
  }
  if (control.kind === "release_emergency_stop") {
    await setEmergencyStop(false, actorId);
    return "Emergency stop released and recorded.";
  }
  if (control.kind === "booking_scan") {
    const result = await scanBookingWorkflowsForTriage(actorId);
    return `Booking scan reviewed ${result.workflowsReviewed} workflows, found ${result.issuesFound} issues, created ${result.created} review jobs, and reused ${result.reused}.`;
  }
  if (control.kind === "booking_follow_up_scan") {
    const result = await scanCompositeBookingFollowUps(actorId);
    return `Booking follow-up scan reviewed ${result.intentsReviewed} intents, found ${result.followUpsDue} due reviews, created ${result.created}, and reused ${result.reused}.`;
  }
  if (control.kind === "waiver_scan") {
    const result = await scanWaiverSubmissionsForTriage(actorId);
    return `Waiver scan reviewed ${result.submissionsReviewed} submissions, found ${result.issuesFound} issues, created ${result.created} review jobs, and reused ${result.reused}.`;
  }
  const db = createServiceRoleClient();
  const { data: agent, error } = await db.from("agents").select("id").eq("key", control.agentKey).single();
  if (error || !agent) throw new Error(`${control.displayName} is unavailable.`);
  const paused = control.kind === "pause_agent";
  await setAgentPaused(String(agent.id), paused, actorId);
  return `${control.displayName} ${paused ? "paused" : "resumed"} and the action was recorded.`;
}

export async function runSupervisorConversation(message: string, actorId: string, clientRequestId: string) {
  const job = await enqueueJob({
    agentKey: "supervisor",
    jobType: SUPERVISOR_CHAT_JOB_TYPE,
    source: "admin.supervisor-chat",
    payload: { message, clientRequestId, actorId, aiInvocations: 0, businessWritesAllowed: false },
    idempotencyKey: `supervisor-chat:${clientRequestId}`,
    actorId,
  });
  if (job.status === "succeeded" && job.result_summary && job.payload.snapshot) {
    return {
      jobId: job.id,
      reply: job.result_summary,
      snapshot: job.payload.snapshot as SupervisorSnapshot,
      actionOutcome: typeof job.payload.actionOutcome === "string" ? job.payload.actionOutcome : null,
      relatedAction: (job.payload.relatedAction as SupervisorRelatedAction | null | undefined) ?? null,
      evidence: parseInvestigationEvidence(job.payload.evidence),
      deduplicated: true,
    };
  }
  if (job.status !== "queued") throw new Error("This Permanent Agent request is already processing.");

  const db = createServiceRoleClient();
  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await db.from("agent_jobs")
    .update({ status: "running", started_at: now, updated_at: now })
    .eq("id", job.id)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();
  if (claimError || !claimed) throw new Error("This Permanent Agent request is already processing.");

  try {
    const networkRequest = supervisorNetworkRequest(message);
    let handoff;
    if (networkRequest) {
      const { submitNetworkTask } = await import("./network/service");
      const task = await submitNetworkTask({ ...networkRequest, requestId: clientRequestId, sender: "supervisor", actorId, title: "Supervisor handoff" });
      handoff = { outcome: "Queued a persistent specialist request. Open its conversation to follow the handoffs and saved reply.", relatedAction: { kind: "agent_network" as const, label: "Follow agent conversation", href: `/admin/agents?conversation=${task.context_id}#agent-conversations` } };
      if (networkRequest.skill === "invitation_correction") handoff = { outcome: "I’ve handed your correction request to the Invitation Agent. Choose the party, then describe or review the wording, layout or picture changes. You’ll see a preview before approving the save.", relatedAction: { kind: "agent_network" as const, label: "Choose invitation to correct", href: invitationCorrectionHref(String(networkRequest.input.message)) } };
    } else handoff = await prepareSupervisorHandoff(message);
    const actionOutcome = handoff?.outcome ?? await runControl(message, actorId);
    const snapshot = await collectSupervisorSnapshot(actorId);
    const relatedAction = handoff?.relatedAction ?? codingConversationAction(message);
    let reply: string;
    let aiInvocations = 0;
    const deadline = AbortSignal.timeout(55000);
    const reader = createInvestigationReader({ allowEmail: canReadOfficeMail(message) }, deadline);
    if (actionOutcome) {
      // Explicit commands keep their verified outcome; the model never runs a control.
      reply = actionOutcome;
    } else {
      const assertAllowed = async () => {
        const [supervisor, settings] = await Promise.all([
          db.from('agents').select('enabled,paused').eq('key', 'supervisor').single(),
          db.from('agent_manager_settings').select('emergency_stop').eq('singleton', true).single(),
        ]);
        if (supervisor.error || settings.error || !supervisor.data?.enabled || supervisor.data.paused || settings.data?.emergency_stop) throw new Error('Conversational replies are paused by Permanent Agent controls.');
      };
      await assertAllowed();
      const history = await loadSupervisorConversation(4, actorId);
      reply = await generateSupervisorReply({ message, context: supervisorReplyContext(message, snapshot), history, investigation: { execute: reader.execute, beforeLookups: assertAllowed, beforeModelCall: async () => {
        await assertAllowed();
        if (++aiInvocations > 4) throw new Error('Conversational investigation reached its model-call limit.');
        const reserved = await db.from('agent_jobs').update({ payload: { ...job.payload, actorId, aiInvocations } }).eq('id', job.id).eq('status', 'running').select('id').maybeSingle();
        if (reserved.error || !reserved.data) throw new Error('Conversational replies are temporarily unavailable.');
      } } }, deadline);
    }
    const payload = {
      message,
      clientRequestId,
      actorId,
      snapshot,
      actionOutcome,
      relatedAction,
      aiInvocations,
      evidence: reader.traces,
      businessWritesAllowed: false,
    };
    await finishSupervisorJob(job, reply, payload);
    return { jobId: job.id, reply, snapshot, actionOutcome, relatedAction, evidence: reader.traces, deduplicated: false };
  } catch (error) {
    const failedAt = new Date().toISOString();
    await Promise.all([
      db.from("agent_jobs").update({ status: "failed", error_summary: "Permanent Agent request failed safely.", completed_at: failedAt, updated_at: failedAt }).eq("id", job.id).eq("status", "running"),
      db.from("agents").update({ status: "idle", current_job_id: null, last_activity_at: failedAt, updated_at: failedAt }).eq("id", job.agent_id),
    ]);
    throw error;
  }
}

export async function loadSupervisorConversation(limit = 12, actorId?: string) {
  const db = createServiceRoleClient();
  const bounded = Math.max(1, Math.min(20, Math.trunc(limit)));
  const { data: agent, error: agentError } = await db.from("agents").select("id").eq("key", "supervisor").single();
  if (agentError || !agent) return [];
  let query = db.from("agent_jobs")
    .select("id,payload,result_summary,created_at")
    .eq("agent_id", agent.id)
    .eq("job_type", SUPERVISOR_CHAT_JOB_TYPE)
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(bounded);
  if (actorId) query = query.contains("payload", { actorId });
  const { data, error } = await query;
  if (error) throw new Error("Permanent Agent conversation history is unavailable.");
  return (data ?? []).map((job) => supervisorJobMessage(job as Pick<AgentJob, "payload" | "result_summary" | "created_at" | "id">)).filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export async function runSupervisorWatch(actorId = "system:vercel-cron") {
  const snapshot = await collectSupervisorSnapshot(actorId);
  const summary = supervisorWatchSummary(snapshot);
  const job = await enqueueJob({
    agentKey: "supervisor",
    jobType: SUPERVISOR_WATCH_JOB_TYPE,
    source: "vercel.cron",
    payload: { snapshot, aiInvocations: 0, businessWritesAllowed: false },
    idempotencyKey: supervisorWatchKey(snapshot),
    actorId,
  });
  if (job.status === "queued") await finishSupervisorJob(job, summary);
  else {
    const db = createServiceRoleClient();
    await db.from("agents").update({ last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("key", "supervisor");
  }
  return { jobId: job.id, deduplicated: job.status !== "queued", summary, snapshot };
}
