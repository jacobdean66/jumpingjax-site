import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { DeterministicWorker, selectWorker } from "./worker";
import type { AgentDashboard, AgentJob } from "./types";

const SAFE_JOB_TYPES = new Set(["system.health_check"]);
const APPROVAL_ACTIONS = new Set(["production.deploy", "database.destructive", "schema.production", "credentials.change", "provider.paid_enable", "billing.change", "message.bulk", "git.destructive", "git.merge_protected"]);

export function requiresApproval(jobType: string) { return APPROVAL_ACTIONS.has(jobType); }
export function isSafeManualJob(jobType: string) { return SAFE_JOB_TYPES.has(jobType); }

export async function enqueueJob(input: { agentKey: string; jobType: string; source: string; payload?: Record<string, unknown>; idempotencyKey: string; actorId: string }) {
  const db = createServiceRoleClient();
  const approvalRequired = requiresApproval(input.jobType);
  const { data, error } = await db.rpc("enqueue_agent_job", { p_agent_key: input.agentKey, p_job_type: input.jobType, p_source: input.source, p_payload: input.payload ?? {}, p_idempotency_key: input.idempotencyKey, p_priority: 100, p_approval_required: approvalRequired });
  if (error) throw new Error(`Unable to enqueue agent job: ${error.message}`);
  const job = data as AgentJob;
  if (approvalRequired) {
    await db.from("agent_approvals").upsert({ job_id: job.id, action_type: input.jobType, requested_by: input.actorId }, { onConflict: "job_id", ignoreDuplicates: true });
  }
  return job;
}

export async function runOne(workerId: string): Promise<AgentJob | null> {
  const db = createServiceRoleClient();
  await db.rpc("recover_expired_agent_jobs");
  const { data, error } = await db.rpc("claim_agent_job", { p_worker_id: workerId, p_lease_seconds: 90 });
  if (error) throw new Error(`Unable to claim job: ${error.message}`);
  const job = data as AgentJob | null;
  if (!job) return null;
  const worker = selectWorker(job, [new DeterministicWorker()]);
  const result = worker ? await worker.execute(job, AbortSignal.timeout(job.timeout_seconds * 1000)) : { ok: false as const, summary: "No configured worker supports this job type", transient: false };
  const finished = new Date().toISOString();
  const retry = !result.ok && result.transient && job.attempt_count < job.max_attempts;
  const status = result.ok ? "succeeded" : retry ? "queued" : "failed";
  const nextRetry = retry ? new Date(Date.now() + Math.min(300_000, 5_000 * 2 ** job.attempt_count)).toISOString() : null;
  const { data: updated, error: updateError } = await db.from("agent_jobs").update({ status, result_summary: result.ok ? result.summary : null, error_summary: result.ok ? null : result.summary, completed_at: retry ? null : finished, next_retry_at: nextRetry, claimed_by: null, lease_expires_at: null, updated_at: finished }).eq("id", job.id).eq("claimed_by", workerId).select("*").single();
  if (updateError) throw new Error(`Unable to finish job: ${updateError.message}`);
  await db.from("agents").update({ status: result.ok ? "idle" : retry ? "idle" : "error", current_job_id: null, last_activity_at: finished, ...(result.ok ? { last_success_at: finished } : {}), updated_at: finished }).eq("id", job.agent_id);
  await db.from("agent_events").insert({ agent_id: job.agent_id, job_id: job.id, event_type: result.ok ? "job.succeeded" : retry ? "job.retry_scheduled" : "job.failed", summary: result.summary });
  return updated as AgentJob;
}

export async function loadDashboard(): Promise<AgentDashboard> {
  const db = createServiceRoleClient();
  const [agents, jobs, events, approvals, settings] = await Promise.all([
    db.from("agents").select("*").order("display_name"),
    db.from("agent_jobs").select("*").order("created_at", { ascending: false }).limit(40),
    db.from("agent_events").select("id,event_type,summary,created_at,job_id").order("created_at", { ascending: false }).limit(50),
    db.from("agent_approvals").select("id,job_id,action_type,status,created_at").eq("status", "pending").order("created_at"),
    db.from("agent_manager_settings").select("*").eq("singleton", true).single(),
  ]);
  const error = [agents.error,jobs.error,events.error,approvals.error,settings.error].find(Boolean);
  if (error) throw new Error(`Agent dashboard unavailable: ${error.message}`);
  return { generatedAt: new Date().toISOString(), emergencyStop: Boolean(settings.data.emergency_stop), maxConcurrency: settings.data.max_concurrency, agents: agents.data as AgentDashboard["agents"], jobs: jobs.data as AgentDashboard["jobs"], events: events.data as AgentDashboard["events"], approvals: approvals.data as AgentDashboard["approvals"] };
}

export async function setAgentPaused(agentId: string, paused: boolean, actorId: string) {
  const db=createServiceRoleClient(); const now=new Date().toISOString();
  const { data,error }=await db.from("agents").update({ paused,status:paused?"paused":"idle",updated_at:now }).eq("id",agentId).select("*").single();
  if(error) throw new Error(error.message); await db.from("agent_events").insert({agent_id:agentId,event_type:paused?"agent.paused":"agent.resumed",actor_id:actorId,summary:paused?"Agent paused by owner":"Agent resumed by owner"}); return data;
}

export async function setEmergencyStop(stopped:boolean,actorId:string){const db=createServiceRoleClient();const {error}=await db.from("agent_manager_settings").update({emergency_stop:stopped,updated_by:actorId,updated_at:new Date().toISOString()}).eq("singleton",true);if(error)throw new Error(error.message);await db.from("agent_events").insert({event_type:stopped?"manager.stopped":"manager.resumed",actor_id:actorId,summary:stopped?"Emergency stop enabled":"Emergency stop released"});}

export async function decideApproval(approvalId:string,decision:"approved"|"rejected",actorId:string){const db=createServiceRoleClient();const now=new Date().toISOString();const {data,error}=await db.from("agent_approvals").update({status:decision,decided_by:actorId,decided_at:now}).eq("id",approvalId).eq("status","pending").select("*").single();if(error)throw new Error(error.message);await db.from("agent_jobs").update({approval_status:decision,status:decision==="approved"?"queued":"cancelled",completed_at:decision==="rejected"?now:null,updated_at:now}).eq("id",data.job_id).eq("status","approval_required");await db.from("agent_events").insert({job_id:data.job_id,event_type:`approval.${decision}`,actor_id:actorId,summary:`Owner ${decision} requested action`});return data;}
