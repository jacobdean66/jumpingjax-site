export type AgentStatus = "online" | "idle" | "working" | "paused" | "error" | "not_configured";
export type JobStatus = "queued" | "claimed" | "running" | "approval_required" | "succeeded" | "failed" | "cancelled";

export type AgentRecord = {
  id: string; key: string; display_name: string; agent_type: string; enabled: boolean;
  paused: boolean; status: AgentStatus; capabilities: string[]; current_job_id: string | null;
  last_activity_at: string | null; last_success_at: string | null;
};

export type AgentJob = {
  id: string; agent_id: string; job_type: string; source: string; priority: number; status: JobStatus;
  payload: Record<string, unknown>; idempotency_key: string; attempt_count: number; max_attempts: number;
  worker_invocation_count: number; max_worker_invocations: number; timeout_seconds: number;
  approval_required: boolean; approval_status: "not_required" | "pending" | "approved" | "rejected";
  result_summary: string | null; error_summary: string | null; created_at: string; completed_at: string | null;
};

export type AgentDashboard = {
  generatedAt: string; demoMode?: boolean; emergencyStop: boolean; maxConcurrency: number; agents: AgentRecord[];
  jobs: AgentJob[]; events: Array<{ id: number; event_type: string; summary: string; created_at: string; job_id: string | null }>;
  approvals: Array<{ id: string; job_id: string; action_type: string; status: string; created_at: string }>;
};
