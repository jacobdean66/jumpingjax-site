import type { ChatPicture } from '@/lib/agent-manager/chat-pictures';
import type { SupervisorRelatedAction, SupervisorSnapshot } from '@/lib/agent-manager/supervisor';

export function createSupervisorRequest(fetchImpl: typeof fetch = fetch) {
  const clientRequestId = crypto.randomUUID(), controller = new AbortController();
  let stopped = false;
  return {
    get stopped() { return stopped; },
    async send(message: string, pictures: ChatPicture[]) {
      const response = await fetchImpl('/api/admin/agents/supervisor-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ message, pictures, clientRequestId }),
      });
      if (stopped) return null;
      const body = await response.json() as { jobId?: string; reply?: string; snapshot?: SupervisorSnapshot; relatedAction?: SupervisorRelatedAction | null; evidence?: unknown; error?: string };
      if (stopped) return null;
      if (!response.ok || !body.jobId || !body.reply || !body.snapshot) throw new Error(body.error || 'Permanent Agent request failed safely.');
      return { jobId: body.jobId, reply: body.reply, snapshot: body.snapshot, relatedAction: body.relatedAction, evidence: body.evidence };
    },
    async stop() {
      stopped = true;
      controller.abort();
      const response = await fetchImpl('/api/admin/agents/supervisor-chat', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000),
        body: JSON.stringify({ clientRequestId }),
      });
      const body = await response.json() as { ok?: boolean; stopped?: boolean; finished?: boolean };
      if (!response.ok || !body.ok || (!body.stopped && !body.finished)) throw new Error('Could not confirm the stop. Please try Stop again.');
      return { stopped: body.stopped === true };
    },
  };
}
