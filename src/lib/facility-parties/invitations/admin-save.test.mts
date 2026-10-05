import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { savePartyInvitation } from './admin-save';
import { signConfirmedTheme } from './theme-token';
import type { ConfirmedInvitationTheme } from './theme-search';

test('admin invitation save requires signed artwork, preserves preferences and verifies the saved party', async context => {
  const previous = process.env.INVITATION_THEME_TOKEN_SECRET;
  process.env.INVITATION_THEME_TOKEN_SECRET = 'test-only-signing-secret-at-least-32-characters';
  context.after(() => { if (previous === undefined) delete process.env.INVITATION_THEME_TOKEN_SECRET; else process.env.INVITATION_THEME_TOKEN_SECRET = previous; });
  const theme: ConfirmedInvitationTheme = { id: 'test-theme', label: 'Test Theme', originalQuery: 'Test Theme', description: 'Test artwork', imageUrl: 'https://example.com/art.png', sourceUrl: 'https://example.com/art', imagePath: `/api/facility/invitations/artwork/${'a'.repeat(64)}`, confirmedAt: new Date().toISOString() };
  const input = { sourceText: theme.label, confirmationToken: signConfirmedTheme(theme), optionIndex: 2 };
  let saved: { invitation?: { optionIndex: number; confirmedTheme: ConfirmedInvitationTheme; deliveryPreference: string; quantity: number; approvedPrint: null }; party_theme?: string } = {}, writes = 0, corrupt = false, cancelled = false;
  const db = createClient('https://admin-invite-test.supabase.co', 'test-only', { global: { fetch: async (source, init) => {
    const req = new Request(source, init), url = new URL(req.url);
    if (url.pathname.includes('/storage/v1/object/')) return new Response(Buffer.from('89504e470d0a1a0a', 'hex'));
    assert.equal(url.pathname, '/rest/v1/facility_bookings');
    if (req.method === 'PATCH') {
      writes++; saved = await req.json();
      assert.equal(url.searchParams.get('id'), 'eq.test-party');
      assert.equal(url.searchParams.get('status'), 'eq.confirmed');
      return Response.json({ id: 'test-party' });
    }
    if (url.searchParams.get('select') === 'invitation') return Response.json({ invitation: corrupt ? {} : saved.invitation });
    return Response.json({ id: 'test-party', status: cancelled ? 'cancelled' : 'confirmed', invitation: { deliveryPreference: 'print', quantity: 8, approvedPrint: { stale: true } } });
  } } });
  assert.equal((await savePartyInvitation(db, 'test-party', { ...input, confirmationToken: 'forged' })).status, 409);
  assert.equal(writes, 0);
  assert.equal((await savePartyInvitation(db, 'test-party', input)).status, 200);
  assert.equal(saved.invitation!.optionIndex, 2);
  assert.equal(saved.invitation!.confirmedTheme.imagePath, theme.imagePath);
  assert.equal(saved.invitation!.deliveryPreference, 'print');
  assert.equal(saved.invitation!.quantity, 8);
  assert.equal(saved.invitation!.approvedPrint, null);
  assert.deepEqual(Object.keys(saved).sort(), ['invitation', 'party_theme']);
  corrupt = true;
  assert.equal((await savePartyInvitation(db, 'test-party', input)).status, 503);
  cancelled = true;
  const before = writes;
  assert.equal((await savePartyInvitation(db, 'test-party', input)).status, 409);
  assert.equal(writes, before);
});
