import { logger, task } from "@trigger.dev/sdk";

import { parseNominationEmail, type NominationEmailEvent } from "@/lib/giveaway/nomination-email";

export type NominationAgentPayload = {
  event: NominationEmailEvent;
  agentJobId?: string;
} & (
  | { mode: "fixture"; callbackUrl: string }
  | { mode: "production"; callbackUrl?: never }
);

export type NominationAgentOutput = {
  ok: true;
  sourceEventId: string;
  nominationId: string;
  nominee: string;
  partyChoice: "september_birthday" | "back_to_school";
  stored: true;
  created: boolean;
  attempt: number;
  handler: "deterministic-typescript";
  aiInvocations: 0;
  completedAt: string;
};

export const nominationAgentTask = task({
  id: "jumping-jax-nomination-agent",
  maxDuration: 30,
  queue: { concurrencyLimit: 1 },
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 500,
    maxTimeoutInMs: 2_000,
    factor: 2,
    randomize: false,
  },
  run: async (payload: NominationAgentPayload, { ctx }) => {
    let callback: URL;
    let authorization: string | null = null;

    if (payload.mode === "fixture") {
      callback = new URL(payload.callbackUrl);
      if (callback.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(callback.hostname)) {
        throw new Error("Fixture callback must remain on the local development server");
      }
    } else {
      const appUrl = process.env.AGENT_MANAGER_APP_URL?.trim();
      const callbackSecret = process.env.AGENT_MANAGER_CALLBACK_SECRET?.trim();
      if (!appUrl || !callbackSecret || !payload.agentJobId) {
        throw new Error("Production nomination callback is not configured");
      }
      callback = new URL("/api/agents/nomination/callback", appUrl);
      if (callback.protocol !== "https:") {
        throw new Error("Production nomination callback must use HTTPS");
      }
      authorization = `Bearer ${callbackSecret}`;
    }

    const nomination = parseNominationEmail(payload.event);
    logger.info("Processing deterministic nomination event", {
      sourceEventId: payload.event.sourceEventId,
      mode: payload.mode,
      attempt: ctx.attempt.number,
      aiInvocations: 0,
    });

    const response = await fetch(callback, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify({
        event: payload.event,
        agentJobId: payload.agentJobId,
        attempt: ctx.attempt.number,
      }),
    });
    const result = await response.json() as { ok?: boolean; nominationId?: string; created?: boolean; error?: string };
    if (!response.ok || !result.ok || !result.nominationId) {
      throw new Error(result.error || "Local fixture nomination storage failed");
    }

    return {
      ok: true as const,
      sourceEventId: payload.event.sourceEventId,
      nominationId: result.nominationId,
      nominee: nomination.child_name,
      partyChoice: nomination.party_choice,
      stored: true as const,
      created: result.created === true,
      attempt: ctx.attempt.number,
      handler: "deterministic-typescript" as const,
      aiInvocations: 0 as const,
      completedAt: new Date().toISOString(),
    };
  },
});

