import type { AgentJob } from "./types";
import { BookingFollowUpWorker } from "./booking-follow-up";
import { BookingTriageWorker } from "./booking-triage";
import { WaiverTriageWorker } from "./waiver-triage";

export type WorkerResult = { ok: true; summary: string } | { ok: false; summary: string; transient: boolean };

export interface AgentWorker {
  readonly kind: "deterministic" | "github" | "coding" | "model";
  supports(jobType: string): boolean;
  execute(job: AgentJob, signal: AbortSignal): Promise<WorkerResult>;
}

export class DeterministicWorker implements AgentWorker {
  readonly kind = "deterministic" as const;
  supports(jobType: string) { return jobType === "system.health_check"; }
  async execute(job: AgentJob, signal: AbortSignal): Promise<WorkerResult> {
    if (signal.aborted) return { ok: false, summary: "Job cancelled before execution", transient: false };
    return { ok: true, summary: `Deterministic health check passed for job ${job.id.slice(0, 8)}; no AI invoked.` };
  }
}

export function selectWorker(job: AgentJob, workers: AgentWorker[]): AgentWorker | null {
  return workers.find((worker) => worker.supports(job.job_type)) ?? null;
}

export function configuredDeterministicWorkers(): AgentWorker[] {
  return [new DeterministicWorker(), new BookingTriageWorker(), new BookingFollowUpWorker(), new WaiverTriageWorker()];
}
