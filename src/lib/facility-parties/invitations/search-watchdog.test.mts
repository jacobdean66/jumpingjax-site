import test from 'node:test';
import assert from 'node:assert/strict';
import { superviseThemeSearch } from './search-watchdog';
import { localThemeCandidate, readLocalThemeArtwork } from './local-theme';
import { searchInvitationWorkflow } from './workflow';
import { readThemeSelection } from './theme-token';

test('supervisor checks at ten seconds and cancels a stuck provider when saved artwork is found', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let reviews = 0, recoveries = 0;
  let providerSignal: AbortSignal | undefined;
  const result = superviseThemeSearch(signal => { providerSignal = signal; return new Promise<string>(() => {}); }, async () => { recoveries++; return 'saved-picture'; }, { onReview: () => reviews++ });
  context.mock.timers.tick(9999);
  assert.equal(reviews, 0);
  context.mock.timers.tick(1);
  assert.equal(await result, 'saved-picture');
  assert.equal(reviews, 1);
  assert.equal(recoveries, 1);
  assert.equal(providerSignal?.aborted, true);
});

test('failed recovery stops the search at 45 seconds with no paid retry', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let searches = 0, recoveries = 0;
  const result = superviseThemeSearch<string>(() => { searches++; return new Promise(() => {}); }, async () => { recoveries++; return null; });
  const rejection = assert.rejects(result, /search_deadline_exceeded/);
  context.mock.timers.tick(10000);
  await Promise.resolve();
  context.mock.timers.tick(35000);
  await rejection;
  assert.equal(searches, 1); assert.equal(recoveries, 1);
});

test('fast results never start the recovery check', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let recoveries = 0;
  assert.equal(await superviseThemeSearch(async () => 'ready', async () => { recoveries++; return 'saved'; }), 'ready');
  context.mock.timers.tick(45000);
  assert.equal(recoveries, 0);
});

test('exact sports use real local pictures, while teams, refinements and rejected pictures never get substituted', async () => {
  const input = { query: 'Soccer', refinements: [], rejected: [] };
  const soccer = localThemeCandidate(input)!;
  assert.equal(soccer.label, 'Soccer');
  assert.ok(soccer.imageUrl.endsWith('/soccer.png'));
  const bytes = await readLocalThemeArtwork(soccer.imageUrl);
  assert.equal(bytes?.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(localThemeCandidate({ ...input, query: 'Chelsea soccer' }), null);
  assert.equal(localThemeCandidate({ ...input, refinements: ['Chelsea'] }), null);
  assert.equal(localThemeCandidate({ ...input, rejected: ['Soccer'] }), null);
  assert.equal(await readLocalThemeArtwork('https://example.com/soccer.png'), null);
});

test('soccer search stages local artwork and returns a signed choice without an AI or external-image call', async context => {
  const keys = ['INVITATION_THEME_TOKEN_SECRET', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const saved = keys.map(key => process.env[key]);
  Object.assign(process.env, { INVITATION_THEME_TOKEN_SECRET: 'test-only-signing-secret-at-least-32-characters', NEXT_PUBLIC_SUPABASE_URL: 'https://soccer-test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only' });
  context.after(() => keys.forEach((key, index) => { if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index]; }));
  let uploads = 0, writes = 0;
  context.mock.method(globalThis, 'fetch', async (source: string | Request, init?: RequestInit) => {
    const request = new Request(source, init), url = new URL(request.url);
    assert.equal(url.hostname, 'soccer-test.supabase.co', 'No provider or external picture calls');
    if (url.pathname === '/rest/v1/rpc/search_invitation_theme_assets') return Response.json([]);
    if (url.pathname === '/rest/v1/agents') return Response.json(null);
    if (url.pathname.startsWith('/storage/v1/object/')) { uploads++; return Response.json({ Key: 'test-picture' }); }
    if (url.pathname === '/rest/v1/invitation_theme_assets') { writes++; return new Response(null, { status: 201 }); }
    throw new Error('Unexpected dependency ' + url.pathname);
  });
  const result = await searchInvitationWorkflow({ query: 'Soccer' });
  assert.equal(result.status, 'needs_confirmation');
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].label, 'Soccer');
  assert.match(result.candidates[0].imagePath!, /^\/api\/facility\/invitations\/artwork\/[a-f0-9]{64}$/);
  assert.equal(readThemeSelection(result.candidates[0].selectionToken)?.candidate.label, 'Soccer');
  assert.equal(uploads, 1); assert.equal(writes, 1);
});
