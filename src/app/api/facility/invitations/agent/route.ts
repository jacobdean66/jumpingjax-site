import {
  isInvitationAgentAction,
  runInvitationAgent,
} from "@/lib/facility-parties/invitations/agent";
import { recordInvitationAgentRun } from "@/lib/agent-manager/invitation-run";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
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

  const result = runInvitationAgent({
    action: body.action,
    sourceText,
    colorHint: typeof body.colorHint === "string" ? body.colorHint : "",
    optionIndex: typeof body.optionIndex === "number" ? body.optionIndex : 0,
    alternatesUsed:
      typeof body.alternatesUsed === "number" ? body.alternatesUsed : 0,
    selection: typeof body.selection === "string" ? body.selection.slice(0, 80) : "",
    bookingId: typeof body.bookingId === "string" ? body.bookingId.slice(0, 100) : "",
  });

  await recordInvitationAgentRun(result).catch(() => undefined);

  return Response.json(result, {
    headers: { "cache-control": "no-store" },
  });
}
