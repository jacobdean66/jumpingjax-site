import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { assertAgentDispatchAllowed } from "./service";
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

/** Claim the run and its Agent Manager job before invoking the stage. */
export async function beginSocialAgentStage(input: {
  runId: string;
  stage: SocialAgentStage;
  actorId: string;
  claimId: string;
  payload?: Record<string, unknown>;
}): Promise<AgentJob> {
  await assertAgentDispatchAllowed("social");
  const db=createServiceRoleClient();
  const {data,error}=await db.rpc("claim_social_agent_job",{
    p_owner:input.actorId,p_run:input.runId,p_stage:input.stage,p_claim:input.claimId,p_payload:input.payload??{},
  });
  if(error||!data)throw new Error("Social Agent could not claim this stage. Check Agent Manager before retrying.");
  return data as AgentJob;
}

export async function finishSocialAgentStage(input: {
  job: AgentJob;
  runId: string;
  stage: SocialAgentStage;
  ok: boolean;
  summary: string;
  modelCalls: number;
  inference?: { executionId: string; model: string };
}): Promise<void> {
  const db = createServiceRoleClient();
  const now = new Date().toISOString();
  const status = input.ok ? "succeeded" : "failed";
  const { error } = await db
    .from("agent_jobs")
    .update({
      status,

      result_summary: input.ok ? input.summary : null,
      error_summary: input.ok ? null : input.summary,
      completed_at: now,
      updated_at: now,
    })
    .eq("id", input.job.id).eq("status","running");
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
      .eq("id", input.job.agent_id)
      .eq("current_job_id", input.job.id)
      .eq("enabled", true)
      .eq("paused", false),
    db.from("agent_events").insert({
      agent_id: input.job.agent_id,
      job_id: input.job.id,
      event_type: input.ok ? "social.stage.succeeded" : "social.stage.failed",
      summary: input.summary,
      metadata: {
        runId: input.runId,
        stage: input.stage,
        modelCalls: input.modelCalls,
        ...(input.inference??{}),
      },
    }),
  ]);
}
