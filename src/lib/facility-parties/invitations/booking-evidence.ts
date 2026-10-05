import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { confirmedThemeSchema, type ConfirmedInvitationTheme } from './theme-search';
import { invitationArtworkBucket } from './artwork-bucket';
import { recordInvitationEvent } from '@/lib/agent-manager/invitation-run';

export async function assertConfirmedArtworkAvailable(db: SupabaseClient, theme: ConfirmedInvitationTheme): Promise<void> {
  const id = theme.imagePath.split('/').pop();
  const { data, error } = await db.storage.from(invitationArtworkBucket()).download(id + '.png');
  if (error || !data || Buffer.from(await data.slice(0,8).arrayBuffer()).toString('hex') !== '89504e470d0a1a0a') {
    await recordInvitationEvent('failed', { stage:'booking', category:'theme_artwork_missing', imageId:id });
    throw new Error('theme_artwork_missing');
  }
}

/** Read the actual inserted row, not the request or composer result. */
export async function verifyBookedInvitation(db: SupabaseClient, bookingId: string, expected: ConfirmedInvitationTheme, optionIndex: number): Promise<boolean> {
  const operationId = randomUUID();
  await recordInvitationEvent('operation_started', { operationId, stage: 'booking', bookingId, themeId: expected.id, optionIndex });
  const { data, error } = await db.from('facility_bookings').select('invitation').eq('id',bookingId)
    .single<{ invitation: { confirmedTheme?: unknown; optionIndex?: number } }>();
  const saved = confirmedThemeSchema.safeParse(data?.invitation?.confirmedTheme);
  const ok = !error && saved.success && saved.data.id === expected.id && saved.data.imagePath === expected.imagePath && saved.data.label === expected.label && data?.invitation.optionIndex === optionIndex;
  await recordInvitationEvent(ok ? 'booking_verified' : 'failed', {
    operationId, stage:'booking', category: ok ? undefined : 'booking_invitation_mismatch', imageId: expected.imagePath.split('/').pop(),
  });
  return Boolean(ok);
}
