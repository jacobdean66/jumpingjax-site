import { confirmedThemeSchema, themeConfirmationRequestSchema, themeSearchRequestSchema, type ThemeSearchRequest, type ThemeCandidate } from "./theme-search";
import { assertThemeSigningConfigured, readThemeSelection, signConfirmedTheme, signThemeSelection } from "./theme-token";

export type ThemeSearchDependencies = {
  search: (input: ThemeSearchRequest) => Promise<{ question: string; candidates: ThemeCandidate[] }>;
  persist: (url: string, candidate: ThemeCandidate) => Promise<string>;
};

/** Search never composes or saves an invitation. Only an explicit, signed selection does. */
export async function performThemeSearch(body: unknown, dependencies: Pick<ThemeSearchDependencies, "search">) {
  const input = themeSearchRequestSchema.parse(body);
  assertThemeSigningConfigured();
  const result = await dependencies.search(input);
  return {
    status: "needs_confirmation" as const,
    question: result.question,
    candidates: result.candidates.map(candidate => ({ ...candidate, selectionToken: signThemeSelection(input.query, candidate) })),
  };
}

export async function confirmInvitationTheme(body: unknown, dependencies: Pick<ThemeSearchDependencies, "persist">) {
  const input = themeConfirmationRequestSchema.parse(body);
  const selection = readThemeSelection(input.selectionToken);
  if (!selection) throw new Error("This search has expired. Please search for your theme again.");
  const imagePath = await dependencies.persist(selection.candidate.imageUrl, selection.candidate);
  const theme = confirmedThemeSchema.parse({
    ...selection.candidate,
    originalQuery: selection.query,
    imagePath,
    confirmedAt: new Date().toISOString(),
  });
  return { sourceText: theme.label, theme, confirmationToken: signConfirmedTheme(theme) };
}
