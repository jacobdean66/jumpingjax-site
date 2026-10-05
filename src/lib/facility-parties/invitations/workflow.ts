import { billableModelProtectionBlock } from '@/lib/social-posts/agents/agent-protection-mode';
import { randomUUID } from 'node:crypto';
import { localThemeCandidates, LIBRARY_CATALOG_REVISION } from './local-theme';
import { findTeamCandidates } from './team-directory';
import { recordInvitationEvent } from '@/lib/agent-manager/invitation-run';
import { findCatalogThemes, stageCatalogTheme, approveCatalogTheme } from './theme-asset-catalog';
import { searchInvitationThemes } from './theme-search-provider';
import { themeInterpretations } from './theme-interpretations';
import { assertThemeSigningConfigured } from './theme-token';
import { confirmInvitationTheme, performThemeSearch } from './theme-search-service';
import { runInvitationAgent, type InvitationAgentInput } from './agent';
import { themeSearchRequestSchema } from './theme-search';
import { ThemeChatCapabilityError } from './theme-search-chat-core';
import { safeProviderFailure } from './provider-failure';
import { assertInvitationArtwork } from './artwork-policy';

const categories = new Set(['theme_catalog_lookup_failed', 'theme_catalog_write_failed', 'theme_catalog_confirmation_failed', 'theme_artwork_missing', 'theme_artwork_invalid', 'theme_identity_uncertain']);
async function failure(error: unknown, stage: 'search' | 'confirmation' | 'composition', operationId: string, started: number) {
  const provider = safeProviderFailure(error);
  await recordInvitationEvent('failed', { operationId, stage, elapsedMs: Date.now() - started,
    category: error instanceof ThemeChatCapabilityError ? error.code : error instanceof Error && categories.has(error.message) ? error.message : 'workflow_failed',
    status: provider.status, providerType: error instanceof ThemeChatCapabilityError ? error.providerType : provider.providerType, providerErrorType: provider.providerErrorType });
}

/** The server workflow owns lookup, verification, frozen artwork, confirmation and composition. */
export async function searchInvitationWorkflow(body: unknown, options: { providerProbe?: boolean; signal?: AbortSignal; operationId?: string } = {}) {
  const input = themeSearchRequestSchema.parse(body);
  assertThemeSigningConfigured();
  const operationId = options.operationId ?? randomUUID(), started = Date.now();
  await recordInvitationEvent('search_started', { operationId, stage: 'search', catalogRevision: LIBRARY_CATALOG_REVISION, searchInput: input });
  try {
    const library = options.providerProbe ? [] : localThemeCandidates(input);
    await recordInvitationEvent('catalog_checked', { operationId, stage: 'search', catalogRevision: LIBRARY_CATALOG_REVISION, libraryIds: library.map(candidate => candidate.id) });
    const interpretations = themeInterpretations(input);
    if (interpretations.length) {
      await recordInvitationEvent('clarification_required', { operationId, stage: 'search' });
      return { status: 'needs_confirmation' as const, question: 'Do you mean K-pop music or the animated movie KPop Demon Hunters?', candidates: [], interpretations };
    }
    let catalogHits = 0;
    let searchPath: 'library' | 'saved_catalog' | 'team_directory' | 'protected_provider' = 'protected_provider';
    const result = await performThemeSearch(input, { search: async context => {
      options.signal?.throwIfAborted();
      const cached = options.providerProbe ? [] : await findCatalogThemes(context);
      catalogHits = cached.length;
      if (library.length) {
        searchPath = 'library';
        const candidates = [];
        for (const candidate of library) { options.signal?.throwIfAborted(); const saved = cached.find(asset => asset.sourceUrl === candidate.sourceUrl || asset.imageUrl === candidate.imageUrl); candidates.push(saved ?? await stageCatalogTheme(candidate)); }
        return { question: "Which library picture matches your party?", candidates };
      }
      if (cached.length) { searchPath = 'saved_catalog'; return { question: 'Which picture matches your theme?', candidates: cached }; }
      const teams = options.providerProbe ? [] : await findTeamCandidates(context, options.signal);
      if (teams.length) {
        const staged = await Promise.allSettled(teams.map(candidate => stageCatalogTheme(candidate)));
        const candidates = staged.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
        if (candidates.length) { searchPath = 'team_directory'; return { question: "Which team name and picture matches your party?", candidates }; }
      }
      if (await billableModelProtectionBlock()) throw new Error('theme_provider_protection_unavailable');
      const discovered = await searchInvitationThemes(context, options.signal);
      const candidates = [];
      // Bound image decodes/uploads. A failed save is visible, never substituted.
      for (const candidate of discovered.candidates) { options.signal?.throwIfAborted(); candidates.push(await stageCatalogTheme(candidate)); }
      return { ...discovered, candidates };
    } });
    await recordInvitationEvent(result.candidates.length ? 'candidates_found' : 'clarification_required', {
      operationId, stage: 'search', candidateCount: result.candidates.length, catalogHits, searchPath, elapsedMs: Date.now() - started });
    return result;
  } catch (error) { if (options.signal?.reason !== 'saved_artwork_recovery') await failure(error, 'search', operationId, started); throw error; }
}

export async function confirmInvitationWorkflow(body: unknown) {
  const operationId = randomUUID(), started = Date.now();
  if (body && typeof body === 'object' && 'confirmed' in body && body.confirmed === true) {
    await recordInvitationEvent('operation_started', { operationId, stage: 'confirmation' });
  }
  try {
    const design = await confirmInvitationTheme(body, { persist: (_url, candidate) => approveCatalogTheme(candidate) });
    await recordInvitationEvent('confirmation_saved', { operationId, stage: 'confirmation', imageId: design.theme.imagePath.split('/').pop() });
    const layouts = [0, 1, 2].map(optionIndex => runInvitationAgent({ action: 'create', sourceText: design.sourceText, confirmedTheme: design.theme, optionIndex }).snapshot);
    await recordInvitationEvent('invitation_composed', { operationId, stage: 'composition', imageId: design.theme.imagePath.split('/').pop() });
    return { ...design, layouts };
  } catch (error) { await failure(error, 'confirmation', operationId, started); throw error; }
}

export async function composeInvitationWorkflow(input: InvitationAgentInput) {
  if (!input.confirmedTheme) throw new Error('theme_confirmation_required');
  const operationId = randomUUID(), started = Date.now();
  await recordInvitationEvent('operation_started', { operationId, stage: 'composition' });
  try {
    const result = runInvitationAgent(input);
    assertInvitationArtwork(result.snapshot);
    await recordInvitationEvent('invitation_composed', { operationId, stage: 'composition', imageId: result.snapshot.confirmedTheme?.imagePath.split('/').pop() });
    return result;
  } catch (error) { await failure(error, 'composition', operationId, started); throw error; }
}
