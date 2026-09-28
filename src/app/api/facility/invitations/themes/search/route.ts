import { themeSearchRequestSchema } from "@/lib/facility-parties/invitations/theme-search";
import { performThemeSearch } from "@/lib/facility-parties/invitations/theme-search-service";
import { searchInvitationThemes } from "@/lib/facility-parties/invitations/theme-search-provider";
import { invitationThemeSearchLimit } from "@/lib/facility-parties/invitations/theme-search-limit";

export const maxDuration = 60;
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 16000) return Response.json({ error: "Search is too long." }, { status: 413 });
  const body = themeSearchRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Enter a theme and a short description." }, { status: 400 });
  try {
    const limited = await invitationThemeSearchLimit(request);
    if (limited) return limited;
    const result = await performThemeSearch(body.data, { search: searchInvitationThemes });
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const configurationError = error instanceof Error && ["Invitation theme signing is not configured.", "Theme search is not configured."].includes(error.message) ? error.message : undefined;
    const providerStatus = error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : undefined;
    console.error("[invitation-theme-search] unavailable", { name: error instanceof Error ? error.name : "UnknownError", configurationError, providerStatus });
    return Response.json({ error: "Theme search couldn’t finish. Your theme has not been changed. Please try again." }, { status: 503 });
  }
}
