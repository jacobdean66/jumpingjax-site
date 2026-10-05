import {
  isInvitationAgentAction,
  runInvitationAgent,
} from "@/lib/facility-parties/invitations/agent";
import { recordInvitationAgentRun } from "@/lib/agent-manager/invitation-run";
import { composeInvitationWorkflow } from "@/lib/facility-parties/invitations/workflow";
import { readConfirmedTheme } from "@/lib/facility-parties/invitations/theme-token";
import { INVITATION_ARTWORK_REQUIRED } from "@/lib/facility-parties/invitations/artwork-policy";
import { loadFacilityInvitationView } from "@/lib/facility-parties/invitations/load-invitation";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const input: unknown = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid request body.");
    body = input as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid invitation request." }, { status: 400 });
  }

  if (!isInvitationAgentAction(body.action)) {
    return Response.json({ error: "Unknown invitation action." }, { status: 400 });
  }

  const sourceText = typeof body.sourceText === "string" ? body.sourceText : "";
  if (sourceText.length > 160) {
    return Response.json({ error: "Invitation theme is too long." }, { status: 400 });
  }

  let confirmedTheme = readConfirmedTheme(body.confirmationToken, sourceText);
  let savedView = null;
  if (!confirmedTheme && typeof body.bookingId === "string" && ["open", "view-single", "view-sheet", "email", "print"].includes(String(body.action))) {
    savedView = await loadFacilityInvitationView(body.bookingId);
    if (savedView?.snapshot.sourceText !== sourceText.trim()) savedView = null;
    confirmedTheme = savedView?.snapshot.confirmedTheme ?? null;
  }
  if (["create", "alternate", "choose-delivery", "choose-template"].includes(String(body.action)) && !confirmedTheme) {
    return Response.json({ error: "Search for your theme and confirm the right picture first.", code: "theme_confirmation_required" }, { status: 409 });
  }

  const compose = confirmedTheme ? composeInvitationWorkflow : runInvitationAgent;
  const result = await compose({
    action: body.action,
    sourceText,
    confirmedTheme: confirmedTheme ?? undefined,
    colorHint: typeof body.colorHint === "string" ? body.colorHint : "",
    optionIndex: typeof body.optionIndex === "number" ? body.optionIndex : 0,
    alternatesUsed:
      typeof body.alternatesUsed === "number" ? body.alternatesUsed : 0,
    selection: typeof body.selection === "string" ? body.selection.slice(0, 80) : "",
    bookingId: typeof body.bookingId === "string" ? body.bookingId.slice(0, 100) : "",
    approvedPrint: savedView?.snapshot.approvedPrint,
  });

  if (!confirmedTheme) await recordInvitationAgentRun(result).catch(() => undefined);

  if (result.status === "needs_theme_confirmation") return Response.json({ error: INVITATION_ARTWORK_REQUIRED, code: "theme_confirmation_required" }, { status: 409, headers: { "cache-control": "no-store" } });

  return Response.json(result, {
    headers: { "cache-control": "no-store" },
  });
}
