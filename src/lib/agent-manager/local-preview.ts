import type { AgentDashboard, AgentRecord, AgentJob } from "./types";

export function isLocalAgentPreviewEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.AGENT_MANAGER_LOCAL_PREVIEW === "1";
}

export function createLocalAgentPreview(): AgentDashboard {
  const now = new Date();
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
  const definitions: Array<[string,string,string,AgentRecord["status"],string[]]> = [
    ["supervisor","Agent Manager","deterministic","idle",["system.health_check"]], ["nomination","Nomination Agent","application","not_configured",[]],
    ["booking","Booking Agent","application","not_configured",[]], ["waiver","Waiver Agent","application","not_configured",[]],
    ["party-invitation","Party / Invitation Agent","application","not_configured",[]], ["social","Social Agent","worker_adapter","not_configured",[]],
    ["coding","Coding Agent","worker_adapter","paused",[]], ["health-security","Health / Security Agent","application","idle",["system.health_check"]],
  ];
  const agents: AgentRecord[] = definitions.map(([key,display_name,agent_type,status,capabilities],index)=>({id:`00000000-0000-4000-8000-${String(index+1).padStart(12,"0")}`,key,display_name,agent_type,enabled:true,paused:status==="paused",status,capabilities,current_job_id:null,last_activity_at:index===0?ago(2):null,last_success_at:index===0?ago(2):null}));
  const job:AgentJob={id:"11111111-1111-4111-8111-111111111111",agent_id:agents[0].id,job_type:"system.health_check",source:"admin.manual",priority:100,status:"succeeded",payload:{preview:true},idempotency_key:"local-preview-health-check",attempt_count:1,max_attempts:3,worker_invocation_count:0,max_worker_invocations:0,timeout_seconds:60,approval_required:false,approval_status:"not_required",result_summary:"Deterministic health check passed; no AI invoked.",error_summary:null,created_at:ago(2),completed_at:ago(2)};
  return {demoMode:true,generatedAt:now.toISOString(),emergencyStop:false,maxConcurrency:1,agents,jobs:[job],approvals:[],events:[{id:3,event_type:"job.succeeded",summary:"Deterministic health check passed; no AI invoked.",created_at:ago(2),job_id:job.id},{id:2,event_type:"job.claimed",summary:"Worker claimed job",created_at:ago(2),job_id:job.id},{id:1,event_type:"job.enqueued",summary:"Job accepted",created_at:ago(3),job_id:job.id}]};
}
