import "server-only";
import { randomUUID } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { collectSupervisorSnapshot } from "./supervisor-service";
import { researchTechnicalIssue } from "./tech-search-provider";
import { buildFindingExplanation, safeResearchText, TECH_SEARCH_JOB_TYPE, techSearchReportSchema, techSearchRequestSchema, validateResearchQuestion, TechSearchError, type TechSearchReport } from "./tech-search";
import manifest from "../../../package.json";

export async function explainTechFinding(issueCode: string, actorId: string) {
  const snapshot = await collectSupervisorSnapshot(actorId);
  const issue = snapshot.issues.find(item => item.code === issueCode);
  if (!issue) throw new Error("That finding is no longer in the latest check. Refresh and choose a current finding.");
  return buildFindingExplanation(issue, snapshot.generatedAt);
}

export async function loadTechSearchHistory(): Promise<TechSearchReport[]> {
  const db = createServiceRoleClient();
  const { data, error } = await db.from("agent_jobs").select("payload")
    .eq("job_type", TECH_SEARCH_JOB_TYPE).eq("status", "succeeded")
    .order("created_at", { ascending: false }).limit(12);
  if (error) throw new Error("Saved Tech Search reports are unavailable.");
  return (data ?? []).flatMap(row => {
    const parsed = techSearchReportSchema.safeParse(row.payload?.report);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function runTechSearch(raw: unknown, actorId: string) {
  const input = techSearchRequestSchema.parse(raw);
  validateResearchQuestion(input.question);
  const db = createServiceRoleClient();
  const key = `tech-search:${actorId}:${input.requestId}`;
  const existing = await db.from("agent_jobs").select("status,payload").eq("idempotency_key", key).eq("job_type", TECH_SEARCH_JOB_TYPE).maybeSingle();
  if (existing.error) throw new Error("Tech Search history is unavailable.");
  if (existing.data) {
    if (existing.data.payload.question !== input.question || existing.data.payload.issueCode !== input.issueCode) throw new Error("Start a new search for a different question.");
    const report = techSearchReportSchema.safeParse(existing.data.payload.report);
    if (existing.data.status === "succeeded" && report.success) return report.data;
    throw new Error("This search was already started. Check saved reports before starting another search.");
  }
  const [settings, agent] = await Promise.all([
    db.from("agent_manager_settings").select("emergency_stop").eq("singleton", true).single(),
    db.from("agents").select("id,enabled,paused").eq("key", "supervisor").single(),
  ]);
  if (settings.error || agent.error) throw new Error("Permanent Agent controls are unavailable.");
  if (settings.data.emergency_stop || !agent.data.enabled || agent.data.paused) throw new Error("Tech Search is paused by Permanent Agent controls.");
  const snapshot = await collectSupervisorSnapshot(actorId);
  const issue = input.issueCode ? snapshot.issues.find(item => item.code === input.issueCode) : undefined;
  if (input.issueCode && !issue) throw new Error("That finding is no longer in the latest check. Refresh or search without a finding.");
  const context = {
    checkedAt: snapshot.generatedAt,
    versions: { next: manifest.dependencies.next, react: manifest.dependencies.react, sharp: manifest.dependencies.sharp },
    ...(issue ? { finding: { code: safeResearchText(issue.code), area: issue.area, severity: issue.severity, summary: safeResearchText(issue.summary).slice(0, 600) } } : {}),
  };
  const now = new Date().toISOString();
  const id = randomUUID();
  const payload = { question: input.question, issueCode: input.issueCode, actorId, context, aiInvocations: 1, businessWritesAllowed: false, codeWritesAllowed: false, deploymentWritesAllowed: false };
  // Insert directly as running: no cron worker can pick up a billable search.
  // The existing unique key prevents concurrent duplicate provider starts.
  const inserted = await db.from("agent_jobs").insert({
    id, agent_id: agent.data.id, job_type: TECH_SEARCH_JOB_TYPE, source: "admin.tech-search", payload,
    idempotency_key: key, status: "running", attempt_count: 1, max_attempts: 1,
    worker_invocation_count: 1, max_worker_invocations: 1, timeout_seconds: 60,
    claimed_by: `tech-search:${id}`, started_at: now, claimed_at: now,
    lease_expires_at: new Date(Date.now() + 90_000).toISOString(),
  });
  if (inserted.error) throw new Error("Search could not start or was already started. Check saved reports before retrying.");
  try {
    const answer = await researchTechnicalIssue({ question: input.question, context }, AbortSignal.timeout(50_000));
    const report = techSearchReportSchema.parse({ ...answer, id, question: input.question, issueCode: input.issueCode, searchedAt: new Date().toISOString(), snapshotAt: snapshot.generatedAt, deploymentSha: snapshot.deployment.commitSha });
    const finished = new Date().toISOString();
    const saved = await db.from("agent_jobs").update({ status: "succeeded", payload: { ...payload, report }, result_summary: `Tech Search: ${input.question}`, completed_at: finished, updated_at: finished, lease_expires_at: null, claimed_by: null })
      .eq("id", id).eq("status", "running").select("id").maybeSingle();
    if (saved.error || !saved.data) throw new TechSearchError("save_failed");
    await db.from("agent_events").insert({ agent_id: agent.data.id, job_id: id, actor_id: actorId, event_type: "supervisor.tech_search_completed", summary: "Technical research saved with official-source citations.", metadata: { aiInvocations: 1, businessWrites: 0 } });
    return report;
  } catch (error) {
    const failure = error instanceof TechSearchError ? error : new TechSearchError("connection");
    const finished = new Date().toISOString();
    await db.from("agent_jobs").update({ status: "failed", payload: { ...payload, failureCode: failure.code }, error_summary: failure.message, completed_at: finished, updated_at: finished, lease_expires_at: null, claimed_by: null }).eq("id", id).eq("status", "running");
    throw failure;
  }
}
