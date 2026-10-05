import { billableModelProtectionBlock } from '@/lib/social-posts/agents/agent-protection-mode';
import { randomUUID } from 'node:crypto';
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
export async function searchInvitationWorkflow(body: unknown, options: { providerProbe?: boolean } = {}) {
  const input = themeSearchRequestSchema.parse(body);
  assertThemeSigningConfigured();
  const operationId = randomUUID(), started = Date.now();
  await recordInvitationEvent('search_started', { operationId, stage: 'search' });
  try {
    const interpretations = themeInterpretations(input);
    if (interpretations.length) {
      await recordInvitationEvent('clarification_required', { operationId, stage: 'search' });
      return { status: 'needs_confirmation' as const, question: 'Do you mean K-pop music or the animated movie KPop Demon Hunters?', candidates: [], interpretations };
    }
    let catalogHits = 0;
    const result = await performThemeSearch(input, { search: async context => {
      const cached = options.providerProbe ? [] : await findCatalogThemes(context);
      catalogHits = cached.length;
      if (cached.length) return { question: 'Which picture matches your theme?', candidates: cached };
      if (await billableModelProtectionBlock()) throw new Error('theme_provider_protection_unavailable');
      const discovered = await searchInvitationThemes(context);
      const candidates = [];
      // Bound image decodes/uploads. A failed save is visible, never substituted.
      for (const candidate of discovered.candidates) candidates.push(await stageCatalogTheme(candidate));
      return { ...discovered, candidates };
    } });
    await recordInvitationEvent(result.candidates.length ? 'candidates_found' : 'clarification_required', {
      operationId, stage: 'search', candidateCount: result.candidates.length, catalogHits, elapsedMs: Date.now() - started });
    return result;
  } catch (error) { await failure(error, 'search', operationId, started); throw error; }
}

export async function confirmInvitationWorkflow(body: unknown) {
  const operationId = randomUUID(), started = Date.now();
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
  const result = runInvitationAgent(input);
  assertInvitationArtwork(result.snapshot);
  await recordInvitationEvent('invitation_composed', { stage: 'composition', imageId: result.snapshot.confirmedTheme?.imagePath.split('/').pop() });
  return result;
}
