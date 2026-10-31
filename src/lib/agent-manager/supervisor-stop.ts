import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { SUPERVISOR_CHAT_JOB_TYPE, validateSupervisorRequestId } from './supervisor';

export class SupervisorStoppedError extends Error {
  constructor() { super('Permanent Agent reply stopped.'); }
}

export async function stopSupervisorConversation(actorId: string, requestId: string) {
  const clientRequestId = validateSupervisorRequestId(requestId);
  const db = createServiceRoleClient();
  const { data: agent, error: agentError } = await db.from('agents').select('id').eq('key', 'supervisor').single();
  if (agentError || !agent) throw new Error('Permanent Agent stop is unavailable.');
  const now = new Date().toISOString(), key = `supervisor-chat:${clientRequestId}`;
  // Insert an already-cancelled placeholder if Stop beats the message upload/enqueue.
  // The existing unique request key prevents a later enqueue from reviving it.
  const { data: inserted, error: insertError } = await db.from('agent_jobs').upsert({
    agent_id: agent.id, job_type: SUPERVISOR_CHAT_JOB_TYPE, source: 'admin.supervisor-chat',
    idempotency_key: key, status: 'cancelled', completed_at: now, updated_at: now,
    payload: { actorId, clientRequestId, aiInvocations: 0, businessWritesAllowed: false },
  }, { onConflict: 'agent_id,idempotency_key', ignoreDuplicates: true }).select('id').maybeSingle();
  if (insertError) throw new Error('Permanent Agent stop is unavailable.');
  const { data: changed, error: stopError } = await db.from('agent_jobs').update({ status: 'cancelled', completed_at: now, updated_at: now, error_summary: null })
    .eq('agent_id', agent.id).eq('job_type', SUPERVISOR_CHAT_JOB_TYPE).eq('idempotency_key', key).contains('payload', { actorId, clientRequestId }).in('status', ['queued', 'claimed', 'running']).select('id').maybeSingle();
  if (stopError) throw new Error('Permanent Agent stop is unavailable.');
  const { data: job, error } = await db.from('agent_jobs').select('id,status').eq('agent_id', agent.id).eq('job_type', SUPERVISOR_CHAT_JOB_TYPE).eq('idempotency_key', key).contains('payload', { actorId, clientRequestId }).maybeSingle();
  if (error || !job) throw new Error('Permanent Agent request is unavailable.');
  if (inserted || changed) await db.from('agent_events').insert({ agent_id: agent.id, job_id: job.id, actor_id: actorId, event_type: 'supervisor.stopped', summary: 'Owner stopped a Permanent Agent reply.', metadata: { businessWrites: 0 } });
  return { stopped: job.status === 'cancelled', finished: !['queued', 'claimed', 'running'].includes(job.status) };
}

export function monitorSupervisorStop(readRunning: () => Promise<boolean>, requestSignal?: AbortSignal, intervalMs = 1000) {
  const controller = new AbortController();
  const stop = () => controller.abort(new SupervisorStoppedError());
  if (requestSignal?.aborted) stop();
  else requestSignal?.addEventListener('abort', stop, { once: true });
  async function check() {
    controller.signal.throwIfAborted();
    try { if (!await readRunning()) stop(); }
    catch (error) { controller.abort(error); }
    controller.signal.throwIfAborted();
  }
  let polling = false;
  const timer = setInterval(() => {
    if (polling || controller.signal.aborted) return;
    polling = true;
    void check().catch(() => undefined).finally(() => { polling = false; });
  }, intervalMs);
  timer.unref?.();
  return { signal: controller.signal, check, dispose: () => { clearInterval(timer); requestSignal?.removeEventListener('abort', stop); } };
}
