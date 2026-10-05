import { setTimeout } from 'node:timers/promises';
import { safeProviderFailure } from './provider-failure';

/** One bounded retry for transient upstream failures. Auth/configuration errors never retry. */
export async function withThemeProviderRetry<T>(work: () => Promise<T>, signal: AbortSignal,
  stage: 'search' | 'vision', pause = (ms: number) => setTimeout(ms, undefined, { signal })): Promise<T> {
  try { return await work(); }
  catch (error) {
    signal.throwIfAborted();
    const safe = safeProviderFailure(error);
    if (safe.providerErrorType === 'insufficient_quota' || !(safe.status === 429 || safe.status === 408 || (safe.status && safe.status >= 500) || ['timeout','connection'].includes(safe.providerType))) throw error;
    // A one-second retry repeatedly exhausts the same search-model window.
    let delay = safe.status === 429 ? 30000 : 1000;
    if (error && typeof error === 'object' && 'headers' in error && error.headers instanceof Headers) {
      const retry = error.headers.get('retry-after');
      if (retry) { const seconds = Number(retry); const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retry) - Date.now();
        if (ms > 60000) throw error;
        if (Number.isFinite(ms)) delay = Math.max(500, ms);
      }
    }
    console.info('[invitation-theme-provider] retry', { stage, ...safe });
    await pause(delay);
    signal.throwIfAborted();
    return work();
  }
}
