import test from 'node:test';
import assert from 'node:assert/strict';
import { localThemeCandidates, invitationCatalogStatus, LIBRARY_CATALOG_REVISION } from './local-theme';
import { teamCandidatesFromPages } from './team-directory';
import { assessInvitationOperation } from '@/lib/agent-manager/invitation-supervisor';

const input = (query: string) => ({ query, refinements: [], rejected: [] });
test('one repository index covers sports beyond the four exceptions and other general themes', () => {
  assert.ok(invitationCatalogStatus().indexedAssets > 1500);
  for (const name of ['Soccer','basketball','baseball','football','tennis','volleyball','badminton','bowling','cricket','rugby','lacrosse','curling','hockey','golf','swimming','skiing','table tennis','boxing','archery','gymnastics','snowboarding','fencing','climbing','handball','water polo','running','unicorn','rocket','dog','dinosaur']) {
    assert.ok(localThemeCandidates(input(name)).length, name);
  }
  assert.equal(localThemeCandidates(input('Dallas Cowboys')).length, 0);
  assert.equal(localThemeCandidates(input('Clemson football')).length, 0);
  assert.equal(localThemeCandidates(input('SpongeBob')).length, 0);
  assert.equal(localThemeCandidates({ ...input('hockey'), rejected: ['Ice hockey'] }).some(candidate => candidate.label === 'Ice hockey'), false);
});

test('directory accepts college/pro team choices but rejects unrelated pages, seasons, disambiguation and unsafe images', () => {
  const page = (title: string, description: string, source='https://thumb.wikimedia.org/wikipedia/en/team.png') => ({ title, description, thumbnail: { source } });
  const choices = teamCandidatesFromPages({ query: { pages: [page('Dallas Cowboys','NFL team in Texas'),page('Clemson Tigers','College athletic teams'),page('2024 Dallas Cowboys season','NFL team season'),page('Dallas Cowboys Cheerleaders','NFL cheerleader squad'),page('2016 Clemson Tigers football team','College football team'),page('Mike Coach','American football coach for a team'),page('Star Player','American football player'),page('Dallas','City in Texas'),page('Unsafe Club','Professional soccer club','http://127.0.0.1/private'),{ ...page('Tigers','Sports teams'), pageprops: { disambiguation: '' } }] } }, input('sports teams'));
  assert.deepEqual(choices.map(candidate => candidate.label), ['Dallas Cowboys','Clemson Tigers']);
  assert.ok(choices.every(candidate => candidate.sourceUrl.startsWith('https://en.wikipedia.org/wiki/')));
});

test('supervisor independently rejects omitted catalog evidence, wrong indexes and bypassed matches', () => {
  const searchInput = input('Tennis');
  const payload = { catalogContractVersion: 2, catalogRevision: LIBRARY_CATALOG_REVISION, searchInput };
  const event = (name: string, metadata: Record<string, unknown>) => ({ event_type: 'invitation.'+name, metadata, created_at: new Date(0).toISOString() });
  const checked = event('catalog_checked',{ catalog_revision: LIBRARY_CATALOG_REVISION, library_ids: localThemeCandidates(searchInput).map(candidate => candidate.id) });
  const terminal = event('candidates_found',{ candidate_count: 1, search_path: 'library' });
  const assess = (events: typeof checked[]) => assessInvitationOperation('search', events, new Date(0).toISOString(),100,payload);
  assert.equal(assess([terminal]).reason,'library_catalog_evidence_missing');
  assert.equal(assess([{ ...checked,metadata:{ ...checked.metadata,library_ids:[] } },terminal]).reason,'library_catalog_lookup_mismatch');
  assert.equal(assess([checked,{ ...terminal,metadata:{ ...terminal.metadata,search_path:'protected_provider' } }]).reason,'available_library_artwork_bypassed');
  assert.equal(assess([checked,terminal]).state,'ready');
  assert.match(assess([checked,terminal]).reason!,/awaiting owner/i);
});
