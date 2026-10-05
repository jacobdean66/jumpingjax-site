import { superviseThemeSearch } from "@/lib/facility-parties/invitations/search-watchdog";
import { randomUUID } from "node:crypto";
import { localThemeCandidates } from "@/lib/facility-parties/invitations/local-theme";
import { recordInvitationEvent } from "@/lib/agent-manager/invitation-run";
import { performThemeSearch } from "@/lib/facility-parties/invitations/theme-search-service";
import { findCatalogThemes } from "@/lib/facility-parties/invitations/theme-asset-catalog";
import { themeSearchRequestSchema } from "@/lib/facility-parties/invitations/theme-search";
import { searchInvitationWorkflow } from "@/lib/facility-parties/invitations/workflow";
import { invitationThemeSearchLimit } from "@/lib/facility-parties/invitations/theme-search-limit";
import { ThemeChatCapabilityError } from "@/lib/facility-parties/invitations/theme-search-chat-core";
import { safeProviderFailure } from "@/lib/facility-parties/invitations/provider-failure";

export const maxDuration = 60;
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 16000) return Response.json({ error: "Search is too long." }, { status: 413 });
  const body = themeSearchRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Enter a theme and a short description." }, { status: 400 });
  try {
    const limited = await invitationThemeSearchLimit(request);
    if (limited) return limited;
    const operationId = randomUUID();
    const result = await superviseThemeSearch(
      signal => searchInvitationWorkflow(body.data, { signal, operationId }),
      async signal => {
        signal.throwIfAborted();
        const library = localThemeCandidates(body.data);
        const saved = await findCatalogThemes(body.data);
        const candidates = library.length ? saved.filter(candidate => library.some(asset => asset.sourceUrl === candidate.sourceUrl || asset.imageUrl === candidate.imageUrl)) : saved;
        signal.throwIfAborted();
        if (!candidates.length) return null;
        await recordInvitationEvent("candidates_found", { operationId, stage: "search", candidateCount: candidates.length, searchPath: library.length ? "library" : "saved_catalog" });
        return performThemeSearch(body.data, { search: async () => ({ question: "The supervisor found saved artwork. Which picture matches your party?", candidates }) });
      },
      { onReview: () => {
        console.info("[invitation-theme-supervisor] recovery_started", { elapsedMs: 10000, additionalAiCalls: 0 });
        void recordInvitationEvent("search_recovery_started", { operationId, stage: "search", elapsedMs: 10000 });
      } },
    );
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const configurationError = error instanceof Error && ["Invitation theme signing is not configured.", "Theme search is not configured.", "The configured AI gateway requires chat messages and does not accept Responses image search.", "The configured AI gateway does not support the invitation search model.", "The configured AI gateway does not support image search fields."].includes(error.message) ? error.message : undefined;
    const providerStatus = safeProviderFailure(error).status;
    const providerCapability = error instanceof ThemeChatCapabilityError ? error.code : undefined;
    const providerType = error instanceof ThemeChatCapabilityError ? error.providerType : undefined;
    const providerErrorType = error instanceof ThemeChatCapabilityError ? error.providerErrorType : undefined;
    console.error("[invitation-theme-search] unavailable", { configurationError, providerStatus, providerCapability, providerType, providerErrorType });
    return Response.json({ error: error instanceof Error && error.message === "search_deadline_exceeded" ? "The supervisor stopped a search that took too long. Your theme details are kept. Add a specific detail or try again." : providerStatus === 429 ? "The picture search provider is busy. Your theme details have been kept. Please wait a moment and retry." : "Theme search couldn’t finish. Your theme has not been changed. Please try again.", code: providerStatus === 429 ? "provider_rate_limited" : "theme_search_unavailable" }, { status: 503, headers: { "cache-control": "no-store", ...(providerStatus === 429 ? { "Retry-After": "30" } : {}) } });
  }
}
