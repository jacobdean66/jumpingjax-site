import "server-only";

import { randomUUID } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SecurityState } from "./types";

type Provider = "aikido" | "aithura";
type Action = "scan" | "health";
type Outcome = "requested" | "accepted" | "succeeded" | "failed" | "denied";

export type SecurityObservation = {
  provider: Provider;
  state: Extract<SecurityState, "healthy" | "degraded" | "failing" | "unavailable">;
  checkedAt: string;
  message: string;
  deploymentSha: string | null;
};

export type PendingAikidoScan = { scanId: number; correlationId: string };

export async function beginSecurityAction(input: {
  actorId: string;
  action: Action;
  provider: Provider;
  cooldownSeconds: number;
}): Promise<{ claimed: boolean; correlationId: string }> {
  const client = createServiceRoleClient();
  const correlationId = randomUUID();
  const actionKey = `${input.actorId}:${input.provider}:${input.action}`;
  const { data, error } = await client.rpc("claim_security_action", {
    p_action_key: actionKey,
    p_cooldown_seconds: input.cooldownSeconds,
  });
  if (error) throw new Error("security_action_store_unavailable");
  const claimed = data === true;
  await writeSecurityAudit({
    actorId: input.actorId,
    action: input.action,
    provider: input.provider,
    outcome: claimed ? "requested" : "denied",
    safeCode: claimed ? "started" : "cooldown_active",
    correlationId,
  });
  return { claimed, correlationId };
}

export async function writeSecurityAudit(input: {
  actorId: string;
  action: Action;
  provider: Provider;
  outcome: Outcome;
  safeCode: string;
  correlationId: string;
}) {
  const client = createServiceRoleClient();
  const { error } = await client.from("security_action_audit_events").insert({
    actor_id: input.actorId,
    action: input.action,
    provider: input.provider,
    deployment_sha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 64) || null,
    outcome: input.outcome,
    safe_code: input.safeCode.slice(0, 80),
    correlation_id: input.correlationId,
  });
  if (error) throw new Error("security_audit_unavailable");
}

export async function saveSecurityObservation(input: Omit<SecurityObservation, "deploymentSha"> & { actorId: string }) {
  const client = createServiceRoleClient();
  const { error } = await client.from("security_service_observations").upsert(
    {
      provider: input.provider,
      state: input.state,
      checked_at: input.checkedAt,
      message: input.message.slice(0, 240),
      actor_id: input.actorId,
      deployment_sha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 64) || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider" },
  );
  if (error) throw new Error("security_observation_unavailable");
}

export async function loadSecurityObservations(): Promise<SecurityObservation[]> {
  try {
    const client = createServiceRoleClient();
    const { data, error } = await client
      .from("security_service_observations")
      .select("provider, state, checked_at, message, deployment_sha");
    if (error || !data) return [];
    return data.flatMap((row) => {
      if (
        (row.provider !== "aikido" && row.provider !== "aithura") ||
        !["healthy", "degraded", "failing", "unavailable"].includes(row.state)
      ) return [];
      return [{
        provider: row.provider as Provider,
        state: row.state as SecurityObservation["state"],
        checkedAt: String(row.checked_at),
        message: String(row.message).slice(0, 240),
        deploymentSha: row.deployment_sha ? String(row.deployment_sha) : null,
      }];
    });
  } catch {
    return [];
  }
}

export async function saveAikidoScanJob(input: { scanId: number; correlationId: string; actorId: string }) {
  const deploymentSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  const branchName = process.env.VERCEL_GIT_COMMIT_REF?.trim();
  if (!deploymentSha || !branchName) throw new Error("deployment_identity_unavailable");
  const client = createServiceRoleClient();
  const { error } = await client.from("security_scan_jobs").insert({
    scan_id: input.scanId,
    correlation_id: input.correlationId,
    actor_id: input.actorId,
    deployment_sha: deploymentSha.slice(0, 64),
    branch_name: branchName.slice(0, 160),
    head_commit_id: deploymentSha.slice(0, 64),
  });
  if (error) throw new Error("security_scan_job_unavailable");
}

export async function loadPendingAikidoScan(actorId: string): Promise<PendingAikidoScan | null> {
  const deploymentSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (!deploymentSha) return null;
  try {
    const client = createServiceRoleClient();
    const { data, error } = await client
      .from("security_scan_jobs")
      .select("scan_id, correlation_id")
      .eq("actor_id", actorId)
      .eq("deployment_sha", deploymentSha)
      .eq("status", "pending")
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return { scanId: Number(data.scan_id), correlationId: String(data.correlation_id) };
  } catch {
    return null;
  }
}

export async function validateAikidoScanJob(input: PendingAikidoScan & { actorId: string }): Promise<boolean> {
  const deploymentSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (!deploymentSha) return false;
  const client = createServiceRoleClient();
  const { data, error } = await client
    .from("security_scan_jobs")
    .select("scan_id")
    .eq("scan_id", input.scanId)
    .eq("correlation_id", input.correlationId)
    .eq("actor_id", input.actorId)
    .eq("deployment_sha", deploymentSha)
    .eq("status", "pending")
    .maybeSingle();
  return !error && Boolean(data);
}

export async function completeAikidoScanJob(input: PendingAikidoScan & { actorId: string; passed: boolean; message: string }): Promise<boolean> {
  const deploymentSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (!deploymentSha) return false;
  const client = createServiceRoleClient();
  const { data, error } = await client.rpc("complete_security_scan_job", {
    p_scan_id: input.scanId,
    p_correlation_id: input.correlationId,
    p_actor_id: input.actorId,
    p_deployment_sha: deploymentSha,
    p_passed: input.passed,
    p_message: input.message,
  });
  if (error) throw new Error("security_scan_completion_unavailable");
  return data === true;
}
