import { logger, task } from "@trigger.dev/sdk";

export type AgentManagerProofPayload = {
  probeId: string;
  failureMode: "none" | "fail_once";
};

export type AgentManagerProofOutput = {
  ok: true;
  probeId: string;
  attempt: number;
  retried: boolean;
  handler: "deterministic-typescript";
  aiInvocations: 0;
  completedAt: string;
};

export const agentManagerProofTask = task({
  id: "jumping-jax-agent-manager-proof",
  maxDuration: 30,
  queue: { concurrencyLimit: 1 },
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 500,
    maxTimeoutInMs: 1_000,
    factor: 1,
    randomize: false,
  },
  run: async (payload: AgentManagerProofPayload, { ctx }) => {
    logger.info("Running deterministic Agent Manager proof", {
      probeId: payload.probeId,
      attempt: ctx.attempt.number,
      aiInvocations: 0,
    });

    if (payload.failureMode === "fail_once" && ctx.attempt.number === 1) {
      throw new Error("Intentional safe first-attempt failure for retry proof");
    }

    return {
      ok: true as const,
      probeId: payload.probeId,
      attempt: ctx.attempt.number,
      retried: ctx.attempt.number > 1,
      handler: "deterministic-typescript" as const,
      aiInvocations: 0 as const,
      completedAt: new Date().toISOString(),
    };
  },
});
