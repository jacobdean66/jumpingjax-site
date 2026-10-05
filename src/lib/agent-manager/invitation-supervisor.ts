import { createHash } from 'node:crypto';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { invitationArtworkBucket } from '@/lib/facility-parties/invitations/artwork-bucket';
import type { AgentJob } from './types';
import type { AgentWorker, WorkerResult } from './worker';

export const INVITATION_SUPERVISION_JOB_TYPE = 'invitation.supervise';
export type InvitationStage = 'search' | 'confirmation' | 'composition' | 'booking';
export type InvitationCheckpoint = { event_type: string; metadata: Record<string, unknown>; created_at: string };
const uuid = /^[a-f0-9-]{36}$/;
const imageHash = /^[a-f0-9]{64}$/;

export function assessInvitationOperation(stage: InvitationStage, events: InvitationCheckpoint[], startedAt: string, now: number) {
  const failed = events.find(e => e.event_type === 'invitation.failed');
  if (failed) return { state: 'failed' as const, reason: typeof failed.metadata.category === 'string' && /^[a-z_]{1,64}$/.test(failed.metadata.category) ? failed.metadata.category : 'workflow_failed' };
  const find = (name: string) => events.find(e => e.event_type === `invitation.${name}`);
  if (stage === 'search') {
    if (find('clarification_required')) return { state: 'ready' as const, reason: 'Awaiting owner clarification; no invitation is complete.' };
    const candidates = find('candidates_found');
    if (candidates && Number.isInteger(candidates.metadata.candidate_count) && Number(candidates.metadata.candidate_count) > 0 && Number(candidates.metadata.candidate_count) <= 8) return { state: 'ready' as const, reason: 'Search finished; awaiting owner artwork selection.' };
  } else {
    const terminal = find(stage === 'booking' ? 'booking_verified' : 'invitation_composed');
    const confirmed = find('confirmation_saved');
    if (terminal && (stage !== 'confirmation' || (confirmed && confirmed.metadata.image_id === terminal.metadata.image_id))) {
      const imageId = terminal.metadata.image_id;
      if (typeof imageId !== 'string' || !imageHash.test(imageId)) return { state: 'failed' as const, reason: 'invalid_artwork_evidence' };
      return { state: 'verify' as const, imageId };
    }
  }
  return now - Date.parse(startedAt) >= 180_000
    ? { state: 'failed' as const, reason: 'operation_timed_out' }
    : { state: 'waiting' as const, reason: 'Waiting for invitation checkpoints.' };
}

const dependencies = {
  async events(job: AgentJob, operationId: string): Promise<InvitationCheckpoint[]> {
    const { data, error } = await createServiceRoleClient().from('agent_events')
      .select('event_type,metadata,created_at').eq('agent_id', job.agent_id)
      .contains('metadata', { operation_id: operationId }).order('id', { ascending: true }).limit(24);
    if (error) throw new Error('checkpoint_read_unavailable');
    return data as InvitationCheckpoint[];
  },
  async artwork(imageId: string) {
    const db = createServiceRoleClient();
    const bucket = invitationArtworkBucket();
    const { data: asset, error } = await db.from('invitation_theme_assets').select('id')
      .eq('storage_bucket', bucket).eq('storage_path', `${imageId}.png`).eq('approval_status', 'approved').limit(1);
    if (error) throw new Error('artwork_catalog_unavailable');
    if (!asset?.length) return false;
    const { data, error: downloadError } = await db.storage.from(bucket).download(`${imageId}.png`);
    if (downloadError || !data) throw new Error('artwork_storage_unavailable');
    if (data.size > 10_485_760) return false;
    const bytes = Buffer.from(await data.arrayBuffer());
    return bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' && createHash('sha256').update(bytes).digest('hex') === imageId;
  },
  async booking(payload: Record<string, unknown>, imageId: string) {
    if (typeof payload.bookingId !== 'string' || !uuid.test(payload.bookingId) || typeof payload.themeId !== 'string' || payload.themeId.length < 1 || payload.themeId.length > 80 || !Number.isInteger(payload.optionIndex) || Number(payload.optionIndex) < 0 || Number(payload.optionIndex) > 2) return false;
    const { data, error } = await createServiceRoleClient().from('facility_bookings').select('invitation').eq('id', payload.bookingId).single();
    if (error) throw new Error('booking_read_unavailable');
    const invitation = data?.invitation;
    return invitation?.confirmedTheme?.id === payload.themeId && invitation?.confirmedTheme?.imagePath === `/api/facility/invitations/artwork/${imageId}` && invitation?.optionIndex === payload.optionIndex;
  },
};

/** Read-only, deterministic supervision. Never regenerates artwork or sends customer messages. */
export class InvitationSupervisorWorker implements AgentWorker {
  readonly kind = 'deterministic' as const;
  constructor(private readonly deps = dependencies, private readonly now = Date.now) {}
  supports(jobType: string) { return jobType === INVITATION_SUPERVISION_JOB_TYPE; }
  async execute(job: AgentJob, signal: AbortSignal): Promise<WorkerResult> {
    const { operationId, stage, startedAt } = job.payload;
    if (signal.aborted) return { ok: false, transient: false, summary: 'Invitation supervision cancelled.' };
    if (typeof operationId !== 'string' || !uuid.test(operationId) || !['search', 'confirmation', 'composition', 'booking'].includes(String(stage)) || typeof startedAt !== 'string' || !Number.isFinite(Date.parse(startedAt))) return { ok: false, transient: false, summary: 'Invalid invitation supervision payload.' };
    try {
      const assessment = assessInvitationOperation(stage as InvitationStage, await this.deps.events(job, operationId), startedAt, this.now());
      if (assessment.state === 'failed') return { ok: false, transient: false, summary: `Invitation supervisor blocked ${stage}: ${assessment.reason}. Review the invitation builder; no paid retry was made.` };
      if (assessment.state === 'waiting') return { ok: false, transient: true, summary: assessment.reason };
      if (assessment.state === 'ready') return { ok: true, summary: `Invitation supervisor: ${assessment.reason} AI calls 0.` };
      if (!await this.deps.artwork(assessment.imageId)) return { ok: false, transient: false, summary: 'Invitation supervisor rejected missing, unapproved, or changed artwork.' };
      if (stage === 'booking' && !await this.deps.booking(job.payload, assessment.imageId)) return { ok: false, transient: false, summary: 'Invitation supervisor rejected a saved booking mismatch.' };
      if (signal.aborted) return { ok: false, transient: false, summary: 'Invitation supervision cancelled.' };
      return { ok: true, summary: stage === 'booking' ? 'Invitation supervisor independently verified approved artwork and the saved booking. AI calls 0.' : 'Invitation supervisor verified approved artwork and composition checkpoints; awaiting booking verification. AI calls 0.' };
    } catch { return { ok: false, transient: true, summary: 'Invitation supervision evidence temporarily unavailable; no completion claimed.' }; }
  }
}
