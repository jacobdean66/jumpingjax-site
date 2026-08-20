import "server-only";

import { runs, tasks } from "@trigger.dev/sdk";
import type { NominationAgentOutput, NominationAgentPayload, nominationAgentTask } from "@/trigger/nomination-agent";

export const NOMINATION_PROOF_COOKIE = "jj-nomination-proof-run";

export async function triggerNominationFixture(payload: NominationAgentPayload) {
  return tasks.trigger<typeof nominationAgentTask>(
    "jumping-jax-nomination-agent",
    payload,
    {
      idempotencyKey: `jj-nomination-${payload.event.sourceEventId}`,
      idempotencyKeyTTL: "1h",
      tags: ["jumping-jax", "nomination-agent", "safe-fixture"],
    },
  );
}

export async function retrieveNominationFixture(runId: string) {
  const run = await runs.retrieve<typeof nominationAgentTask>(runId);
  return {
    id: run.id,
    status: run.status,
    isCompleted: run.isCompleted,
    isSuccess: run.isSuccess,
    isFailed: run.isFailed,
    createdAt: run.createdAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    output: run.output as NominationAgentOutput | undefined ?? null,
    error: run.error?.message ?? null,
  };
}

