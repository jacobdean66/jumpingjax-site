import "server-only";
import { randomUUID } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { assertAgentDispatchAllowed } from "../service";
import type { AgentJob } from "../types";
import { AGENT_DIRECTORY, definition, validateSkillInput, type NetworkAgentKey, type NetworkContext, type NetworkMessage, type NetworkResult, type NetworkSkill, type NetworkTask } from "./contracts";
import { taskFingerprint } from "./fingerprint";
import { executeAdapter, isTerminal } from "./engine";
import { createAgentAdapters } from "./adapters";

export async function submitNetworkTask(input: { requestId: string; contextId?: string; sender: NetworkAgentKey; recipient: NetworkAgentKey; skill: NetworkSkill; input: Record<string, unknown>; actorId: string; title?: string; parent?: NetworkTask; workerId?: string }) {
  definition(input.sender);
  const payload = validateSkillInput(input.recipient, input.skill, input.input);
  const db = createServiceRoleClient();
  const { data, error } = await db.rpc("submit_agent_network_task", { p_context_id: input.contextId ?? input.requestId, p_request_id: input.requestId, p_sender: input.sender, p_recipient: input.recipient, p_skill: input.skill, p_input: payload, p_fingerprint: taskFingerprint(input.recipient, input.skill, payload), p_actor: input.actorId, p_title: input.title ?? "Agent conversation", p_parent: input.parent?.id ?? null, p_worker: input.workerId ?? null });
  if (error) throw new Error("Unable to submit agent request. Check paused agents, emergency stop, conversation limits, and request identity.");
  return data as NetworkTask;
}
export async function loadNetworkContext(contextId: string) {
  const db = createServiceRoleClient();
  const [context, tasks, messages] = await Promise.all([
    db.from("agent_network_contexts").select("id,title,created_at").eq("id", contextId).single(),
    db.from("agent_network_tasks").select("*").eq("context_id", contextId).order("created_at").limit(24),
    db.from("agent_network_messages").select("*").eq("context_id", contextId).order("id").limit(72),
  ]);
  if (context.error || tasks.error || messages.error) throw new Error("Agent conversation unavailable.");
  return { context: context.data as NetworkContext, tasks: tasks.data as NetworkTask[], messages: messages.data as NetworkMessage[] };
}
export async function loadNetworkOverview() {
  const db = createServiceRoleClient();
  const [contexts, agents, settings, active] = await Promise.all([
    db.from("agent_network_contexts").select("id,title,created_at").order("created_at", { ascending: false }).limit(20),
    db.from("agents").select("key,enabled,paused,status"),
    db.from("agent_manager_settings").select("emergency_stop").eq("singleton", true).single(),
    db.from("agent_network_tasks").select("id", { head: true, count: "exact" }).in("status", ["queued", "working", "waiting"]),
  ]);
  if (contexts.error || agents.error || settings.error || active.error) throw new Error("Agent network storage is unavailable. Apply its additive migration before activating.");
  const directory = AGENT_DIRECTORY.map((a) => {
    const self = agents.data.find((row) => row.key === a.key);
    const control = agents.data.find((row) => row.key === a.controlKey);
    return { ...a, available: Boolean(self?.enabled && !self.paused && control?.enabled && !control.paused && !settings.data.emergency_stop), status: !self || !control ? "unregistered" : settings.data.emergency_stop ? "stopped" : !self.enabled || !control.enabled ? "disabled" : self.paused || control.paused ? "paused" : "adapter ready" };
  });
  return { directory, contexts: contexts.data as NetworkContext[], activeTasks: active.count ?? 0, emergencyStop: Boolean(settings.data.emergency_stop) };
}
export type NetworkOverview = Awaited<ReturnType<typeof loadNetworkOverview>>;

export async function runNetworkJob(job: AgentJob, workerId: string): Promise<AgentJob> {
  const db = createServiceRoleClient();
  const { data, error } = await db.from("agent_network_tasks").select("*").eq("job_id", job.id).single();
  if (error || !data || data.id !== job.payload.networkTaskId) throw new Error("Network job correlation unavailable.");
  const task = data as NetworkTask;
  let result: NetworkResult | null = task.result;
  let retry = false;
  try {
    if (!isTerminal(task.status) && task.status !== "waiting") {
      for (const key of new Set([task.sender_key, task.recipient_key, definition(task.sender_key).controlKey, definition(task.recipient_key).controlKey])) await assertAgentDispatchAllowed(key);
      const { error: started } = await db.rpc("start_agent_network_task", { p_task_id: task.id, p_worker: workerId });
      if (started) throw new Error("Task start unavailable.");
      task.status = "working";
      const history = await loadNetworkContext(task.context_id);
      const output = await executeAdapter(task, createAgentAdapters(), history.tasks, AbortSignal.timeout(Math.min(40_000, job.timeout_seconds * 1000)));
      if ("delegate" in output) {
        await submitNetworkTask({ requestId: task.id, contextId: task.context_id, sender: task.recipient_key, ...output.delegate, actorId: task.actor_id, parent: task, workerId });
        result = null;
      } else result = output;
    }
  } catch (error) {
    const blocked = /paused|disabled|emergency stop/.test(error instanceof Error ? error.message : "");
    retry = !blocked && job.attempt_count < job.max_attempts;
    result = retry ? null : { status: blocked ? "blocked" : "failed", summary: blocked ? "Agent is paused, disabled, or the manager is stopped. Owner review is required." : "The agent could not verify this request after bounded retries. Check its provider and storage access.", data: {} };
  }
  const { data: finished, error: finishError } = await db.rpc("finish_agent_network_task", { p_task_id: task.id, p_worker: workerId, p_result: result, p_retry: retry });
  if (finishError) throw new Error("Agent request completion could not be recorded.");
  return finished as AgentJob;
}
export async function cancelNetworkContext(contextId: string, actorId: string) {
  const { error } = await createServiceRoleClient().rpc("cancel_agent_network_context", { p_context_id: contextId, p_actor: actorId });
  if (error) throw new Error("Conversation cancellation unavailable.");
}
// Trusted server callers (including the separately developed receptionist) use
// this interface rather than forging browser cookies or exposing service keys.
export function requestAgent(input: { sender: NetworkAgentKey; recipient: NetworkAgentKey; skill: NetworkSkill; input: Record<string, unknown>; actorId: string; requestId: string; contextId?: string }) {
  return submitNetworkTask({ ...input, contextId: input.contextId ?? input.requestId });
}
export const newNetworkRequestId = () => randomUUID();

export async function loadNetworkTask(id: string, recipient: string, actorId: string) {
  const { data, error } = await createServiceRoleClient().from("agent_network_tasks").select("*").eq("id", id).eq("recipient_key", recipient).eq("actor_id", actorId).single();
  if (error || !data) throw new Error("Agent task unavailable.");
  return data as NetworkTask;
}
