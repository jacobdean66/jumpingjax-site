import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { assertAgentDispatchAllowed, enqueueJob } from "./service";
import type { AgentJob } from "./types";

export const SOCIAL_AGENT_CAPABILITIES = [
  "social.draft.campaign_strategist",
  "social.draft.creative_director",
  "social.draft.independent_reviewer",
  "social.draft.compliance",
  "social.draft.final_compliance",
  "social.draft.revision",
  "social.draft.persist",
] as const;

export type SocialAgentStage =
  | "campaign_strategist"
  | "creative_director"
  | "independent_reviewer"
  | "compliance"
  | "final_compliance"
  | "revision"
  | "persist";

function jobType(stage: SocialAgentStage): string {
  return `social.draft.${stage}`;
}

/**
 * Social stages execute inline so the owner can inspect every result before the
 * next model call. They are still durable Agent Manager jobs, not invisible
 * page-local calls.
 */
export async function beginSocialAgentStage(input: {
  runId: string;
  stage: SocialAgentStage;
  actorId: string;
  payload?: Record<string, unknown>;
}): Promise<AgentJob> {
  const db = createServiceRoleClient();
  const now = new Date().toISOString();
  const { error: configureError } = await db
    .from("agents")
    .update({
      agent_type: "application",
      enabled: true,
      status: "idle",
      capabilities: [...SOCIAL_AGENT_CAPABILITIES],
      updated_at: now,
    })
    .eq("key", "social");
  if (configureError) {
    throw new Error(`Social Agent configuration failed: ${configureError.message}`);
  }

  await assertAgentDispatchAllowed("social");
  const job = await enqueueJob({
    agentKey: "social",
    jobType: jobType(input.stage),
    source: "admin.social-posts.checkpoint",
    payload: { runId: input.runId, stage: input.stage, ...(input.payload ?? {}) },
    idempotencyKey: `social:${input.runId}:${input.stage}`,
    actorId: input.actorId,
  });

  if (job.status === "succeeded") return job;
  const { error: jobError } = await db
    .from("agent_jobs")
    .update({ status: "running", started_at: now, updated_at: now })
    .eq("id", job.id)
    .in("status", ["queued", "claimed", "running"]);
  if (jobError) throw new Error(`Social Agent job start failed: ${jobError.message}`);

  await Promise.all([
    db
      .from("agents")
      .update({
        status: "working",
        current_job_id: job.id,
        last_activity_at: now,
        updated_at: now,
      })
      .eq("id", job.agent_id),
    db.from("agent_events").insert({
      agent_id: job.agent_id,
      job_id: job.id,
      event_type: "social.stage.started",
      actor_id: input.actorId,
      summary: `Social Agent started ${input.stage}`,
      metadata: { runId: input.runId, stage: input.stage },
    }),
  ]);
  return { ...job, status: "running" };
}

export async function finishSocialAgentStage(input: {
  job: AgentJob;
  runId: string;
  stage: SocialAgentStage;
  ok: boolean;
  summary: string;
  modelCalls: number;
}): Promise<void> {
  const db = createServiceRoleClient();
  const now = new Date().toISOString();
  const status = input.ok ? "succeeded" : "failed";
  const { error } = await db
    .from("agent_jobs")
    .update({
      status,
      attempt_count: 1,
      result_summary: input.ok ? input.summary : null,
      error_summary: input.ok ? null : input.summary,
      completed_at: now,
      updated_at: now,
    })
    .eq("id", input.job.id);
  if (error) throw new Error(`Social Agent job completion failed: ${error.message}`);

  await Promise.all([
    db
      .from("agents")
      .update({
        status: input.ok ? "idle" : "error",
        current_job_id: null,
        last_activity_at: now,
        ...(input.ok ? { last_success_at: now } : {}),
        updated_at: now,
      })
      .eq("id", input.job.agent_id),
    db.from("agent_events").insert({
      agent_id: input.job.agent_id,
      job_id: input.job.id,
      event_type: input.ok ? "social.stage.succeeded" : "social.stage.failed",
      summary: input.summary,
      metadata: {
        runId: input.runId,
        stage: input.stage,
        modelCalls: input.modelCalls,
      },
    }),
  ]);
}
