import { timingSafeEqual } from 'node:crypto';
import { searchInvitationWorkflow } from '@/lib/facility-parties/invitations/workflow';
import { invitationThemeSearchLimit } from '@/lib/facility-parties/invitations/theme-search-limit';
import { readThemeSelection } from '@/lib/facility-parties/invitations/theme-token';
import { themeInterpretations } from '@/lib/facility-parties/invitations/theme-interpretations';
import { safeProviderFailure } from '@/lib/facility-parties/invitations/provider-failure';
import { ThemeChatCapabilityError } from '@/lib/facility-parties/invitations/theme-search-chat-core';

export const maxDuration = 180;
/** Manual authenticated production contract probe. No confirmation, booking or email. */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!secret || !supplied || Buffer.byteLength(secret) !== Buffer.byteLength(supplied) || !timingSafeEqual(Buffer.from(secret), Buffer.from(supplied))) return Response.json({ ok:false }, { status:401 });
  const limited = await invitationThemeSearchLimit(request);
  if (limited) return limited;
  try {
    const result = await searchInvitationWorkflow({ query:'KPop Demon Hunters characters', refinements:['The animated movie characters'], rejected:[] }, { providerProbe:true });
    const ok = result.candidates.length > 0 && result.candidates.every(candidate => Boolean(candidate.imagePath && readThemeSelection(candidate.selectionToken)));
    return Response.json({ ok, providerExercised:true, candidates:result.candidates.length,
      broadInterpretations:themeInterpretations({ query:'K-pop',refinements:[],rejected:[] }).length,
      firstPartyPngs:result.candidates.filter(candidate=>candidate.imagePath).length,
      bookingsCreated:0, emailsSent:0 }, { status:ok?200:503, headers:{'cache-control':'no-store'} });
  } catch(error) {
    return Response.json({ ok:false, providerExercised:true, category:error instanceof ThemeChatCapabilityError?error.code:'workflow_failed', ...safeProviderFailure(error) }, { status:503,headers:{'cache-control':'no-store'} });
  }
}
