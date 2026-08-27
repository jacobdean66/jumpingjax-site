import { createHash } from "node:crypto";

import type { AgentJob } from "./types";
import type { AgentWorker, WorkerResult } from "./worker";

export const WAIVER_TRIAGE_JOB_TYPE = "waiver.submission.triage";

export type WaiverTriageIssue = {
  submissionId: string;
  submissionCreatedAt: string;
  issue: "missing_signature" | "missing_document" | "document_not_generated" | "document_hash_missing";
};

function relationRows(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  return value && typeof value === "object" ? [value as Record<string, unknown>] : [];
}

export function waiverReference(submissionId: string) {
  return `waiver-${createHash("sha256").update(submissionId).digest("hex").slice(0, 10)}`;
}

export function waiverTriageIdempotencyKey(issue: WaiverTriageIssue) {
  return `waiver-triage:${createHash("sha256").update([
    issue.submissionId,
    issue.submissionCreatedAt,
    issue.issue,
  ].join(":")).digest("hex")}`;
}

export function identifyWaiverTriageIssues(row: Record<string, unknown>): WaiverTriageIssue[] {
  const submissionId = typeof row.id === "string" ? row.id : null;
  const submissionCreatedAt = typeof row.created_at === "string" ? row.created_at : null;
  if (!submissionId || !submissionCreatedAt || row.status !== "completed") return [];

  const signatures = relationRows(row.waiver_signatures);
  const documents = relationRows(row.waiver_documents);
  const issues: WaiverTriageIssue["issue"][] = [];
  if (signatures.length === 0) issues.push("missing_signature");
  if (documents.length === 0) {
    issues.push("missing_document");
  } else {
    if (typeof documents[0].generated_at !== "string") issues.push("document_not_generated");
    if (typeof documents[0].sha256 !== "string") issues.push("document_hash_missing");
  }
  return issues.map((issue) => ({ submissionId, submissionCreatedAt, issue }));
}

function parsePayload(payload: Record<string, unknown>): WaiverTriageIssue | null {
  const submissionId = typeof payload.submissionId === "string" ? payload.submissionId : null;
  const submissionCreatedAt = typeof payload.submissionCreatedAt === "string" ? payload.submissionCreatedAt : null;
  const issue = payload.issue;
  if (!submissionId || !submissionCreatedAt || !["missing_signature", "missing_document", "document_not_generated", "document_hash_missing"].includes(String(issue))) return null;
  return { submissionId, submissionCreatedAt, issue: issue as WaiverTriageIssue["issue"] };
}

export class WaiverTriageWorker implements AgentWorker {
  readonly kind = "deterministic" as const;

  supports(jobType: string) {
    return jobType === WAIVER_TRIAGE_JOB_TYPE;
  }

  async execute(job: AgentJob, signal: AbortSignal): Promise<WorkerResult> {
    if (signal.aborted) return { ok: false, summary: "Waiver triage cancelled before execution", transient: false };
    const issue = parsePayload(job.payload);
    if (!issue) return { ok: false, summary: "Waiver triage payload was invalid", transient: false };
    return {
      ok: true,
      summary: `${waiverReference(issue.submissionId)} requires owner review: ${issue.issue}. Read-only triage; no AI invoked.`,
    };
  }
}
