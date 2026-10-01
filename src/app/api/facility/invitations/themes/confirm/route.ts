import { confirmInvitationWorkflow } from "@/lib/facility-parties/invitations/workflow";
import { themeConfirmationRequestSchema } from "@/lib/facility-parties/invitations/theme-search";
import { readThemeSelection } from "@/lib/facility-parties/invitations/theme-token";
import { invitationThemeSearchLimit } from "@/lib/facility-parties/invitations/theme-search-limit";

export const maxDuration = 30;
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 20000) return Response.json({ error: "Selection is too large." }, { status: 413 });
  const body = themeConfirmationRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success || !readThemeSelection(body.data.selectionToken)) return Response.json({ error: "Search again and confirm the picture you want." }, { status: 400 });
  try {
    const limited = await invitationThemeSearchLimit(request);
    if (limited) return limited;
    return Response.json(await confirmInvitationWorkflow(body.data), { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "That picture couldn’t be saved for your invitation. Please try again or choose another match." }, { status: 503 });
  }
}
