import "server-only";
import { runs, tasks } from "@trigger.dev/sdk";
import type { agentManagerProofTask, AgentManagerProofOutput, AgentManagerProofPayload } from "@/trigger/agent-manager-proof";

export const TRIGGER_PROOF_COOKIE = "jj-trigger-proof-run";

export async function triggerArchitectureProof(input: AgentManagerProofPayload & { idempotencyKey: string }) {
  return tasks.trigger<typeof agentManagerProofTask>(
    "jumping-jax-agent-manager-proof",
    { probeId: input.probeId, failureMode: input.failureMode },
    {
      idempotencyKey: input.idempotencyKey,
      idempotencyKeyTTL: "1h",
      tags: ["jumping-jax", "agent-manager", "architecture-proof"],
    },
  );
}

export async function retrieveArchitectureProof(runId: string) {
  const run = await runs.retrieve<typeof agentManagerProofTask>(runId);
  const output = run.output as AgentManagerProofOutput | undefined;
  return {
    id: run.id,
    status: run.status,
    isCompleted: run.isCompleted,
    isSuccess: run.isSuccess,
    isFailed: run.isFailed,
    idempotencyKey: run.idempotencyKey ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    output: output ?? null,
    error: run.error?.message ?? null,
  };
}
