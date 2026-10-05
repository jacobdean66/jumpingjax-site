import { createServiceRoleClient } from '@/lib/supabase/admin';
import type { InvitationAgentResult } from '@/lib/facility-parties/invitations/agent';
import { INVITATION_SUPERVISION_JOB_TYPE } from './invitation-supervisor';

export type InvitationWorkflowEvent = 'operation_started' | 'search_started' | 'candidates_found' | 'clarification_required' | 'confirmation_saved' | 'invitation_composed' | 'booking_verified' | 'failed' | 'layout_viewed';
export type InvitationEventEvidence = {
  operationId?: string; candidateCount?: number; catalogHits?: number; imageId?: string;
  stage?: 'search' | 'confirmation' | 'composition' | 'booking';
  category?: string; status?: number; providerType?: string; elapsedMs?: number;
  bookingId?: string; themeId?: string; optionIndex?: number;
  providerErrorType?: string;
};
/** Logs contain bounded operational data only, never customer text or provider bodies. */
export async function recordInvitationEvent(event: InvitationWorkflowEvent, evidence: InvitationEventEvidence = {}): Promise<void> {
  const safe = {
    operation_id: evidence.operationId && /^[a-f0-9-]{36}$/.test(evidence.operationId) ? evidence.operationId : undefined,
    candidate_count: evidence.candidateCount === undefined ? undefined : Math.max(0, Math.min(8, evidence.candidateCount)),
    catalog_hits: evidence.catalogHits === undefined ? undefined : Math.max(0, Math.min(8, evidence.catalogHits)),
    image_id: evidence.imageId && /^[a-f0-9]{64}$/.test(evidence.imageId) ? evidence.imageId : undefined,
    stage: evidence.stage,
    category: evidence.category && /^[a-z_]{1,64}$/.test(evidence.category) ? evidence.category : undefined,
    status: evidence.status && evidence.status >= 400 && evidence.status <= 599 ? evidence.status : undefined,
    provider_type: ['http','timeout','connection','aborted','unknown'].includes(evidence.providerType ?? '') ? evidence.providerType : undefined,
    provider_error_type: ['invalid_request_error','authentication_error','permission_error','rate_limit_error','insufficient_quota','server_error','api_error'].includes(evidence.providerErrorType ?? '') ? evidence.providerErrorType : undefined,
    elapsed_ms: evidence.elapsedMs === undefined ? undefined : Math.min(120000, Math.max(0, Math.round(evidence.elapsedMs))),
  };
  console.info('[invitation-workflow]', { event, ...safe });
  try {
    const db = createServiceRoleClient();
    const { data: agent } = await db.from('agents').select('id').eq('key', 'party-invitation').maybeSingle<{ id: string }>();
    if (!agent) return;
    const { error } = await db.from('agent_events').insert({ agent_id: agent.id,
      event_type: 'invitation.' + event, summary: 'Invitation workflow: ' + event.replaceAll('_', ' '), metadata: safe });
    if (error) throw new Error('event_write_failed');
    const now = new Date().toISOString();
    let supervisionJobId: string | undefined;
    if (['search_started', 'operation_started'].includes(event) && safe.operation_id && safe.stage) {
      const queued = await db.rpc('enqueue_agent_job', { p_agent_key: 'party-invitation', p_job_type: INVITATION_SUPERVISION_JOB_TYPE,
        p_source: 'invitation.lifecycle', p_priority: 100, p_approval_required: false,
        p_idempotency_key: `invitation-supervise:${safe.operation_id}`,
        p_payload: { operationId: safe.operation_id, stage: safe.stage, startedAt: now, aiInvocations: 0,
          ...(evidence.bookingId && /^[a-f0-9-]{36}$/.test(evidence.bookingId) ? { bookingId: evidence.bookingId } : {}),
          ...(typeof evidence.themeId === 'string' && evidence.themeId.length > 0 && evidence.themeId.length <= 80 ? { themeId: evidence.themeId } : {}),
          ...(Number.isInteger(evidence.optionIndex) && evidence.optionIndex! >= 0 && evidence.optionIndex! <= 2 ? { optionIndex: evidence.optionIndex } : {}) },
      });
      if (queued.error) throw new Error('supervision_enqueue_failed');
      if (typeof queued.data?.id === 'string') supervisionJobId = queued.data.id;
    }
    await db.from('agents').update({ last_activity_at: now, updated_at: now,
      ...(['search_started', 'operation_started'].includes(event) ? { status: 'working', ...(supervisionJobId ? { current_job_id: supervisionJobId } : {}) } : {}) }).eq('id', agent.id);
  } catch { console.warn('[invitation-workflow] evidence_store_unavailable'); }
}
/** Layout activity does not prove that a character booking was saved. */
export async function recordInvitationAgentRun(result: InvitationAgentResult): Promise<void> {
  if (result.status === 'needs_theme_confirmation') {
    await recordInvitationEvent('clarification_required', { stage: 'composition', category: 'theme_confirmation_required' });
    return;
  }
  const composed = result.snapshot.confirmedTheme && ['create','alternate','choose-template'].includes(result.action);
  await recordInvitationEvent(composed ? 'invitation_composed' : 'layout_viewed', {
    stage: 'composition', imageId: result.snapshot.confirmedTheme?.imagePath.split('/').pop(),
  });
}
