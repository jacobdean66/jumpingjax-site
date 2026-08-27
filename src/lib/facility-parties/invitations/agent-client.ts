"use client";

import type {
  InvitationAgentInput,
  InvitationAgentResult,
} from "./agent";

export async function invokeInvitationAgent(
  input: InvitationAgentInput,
): Promise<InvitationAgentResult> {
  const response = await fetch("/api/facility/invitations/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    keepalive: true,
  });
  if (!response.ok) throw new Error("Invitation designer is unavailable.");
  return (await response.json()) as InvitationAgentResult;
}

export function notifyInvitationAgent(input: InvitationAgentInput): void {
  void invokeInvitationAgent(input).catch(() => undefined);
}
