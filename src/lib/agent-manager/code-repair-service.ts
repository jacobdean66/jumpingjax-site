import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { CODE_REPAIR_TABLE, codeRepairRequestSchema, codeRepairResultSchema } from "./code-repair";
import { acceptedRepairEvidence, allowedTaskRepairPath } from '../../../scripts/code-repairs/policy.mjs';

const fields = "id,description,page_path,expected_text,status,created_at,updated_at,run_url,result";

export async function loadCodeRepairWorkerStatus() {
  const configured = Boolean(process.env.CODE_REPAIR_RUNNER_TOKEN?.trim());
  const { data, error } = await createServiceRoleClient().from("agent_code_repair_runner").select("last_seen_at").eq("singleton", true).maybeSingle();
  const lastSeenAt = data?.last_seen_at ?? null;
  return { configured, lastSeenAt, connected: configured && !error && Boolean(lastSeenAt) && Date.now() - Date.parse(lastSeenAt) < 20 * 60_000 };
}

export async function loadCodeRepairs(actorId: string) {
  const db = createServiceRoleClient();
  const { data, error } = await db.from(CODE_REPAIR_TABLE).select(fields).eq("actor_id", actorId).order("created_at", { ascending: false }).limit(12);
  if (error) throw new Error("Code repair storage is unavailable. The repair queue migration must be activated.");
  return data ?? [];
}

export async function requestCodeRepair(raw: unknown, actorId: string) {
  const input = codeRepairRequestSchema.parse(raw);
  if (!process.env.CODE_REPAIR_RUNNER_TOKEN?.trim()) throw new Error("The coding worker connection is not configured.");
  const db = createServiceRoleClient();
  const { data, error } = await db.rpc("enqueue_code_repair", {
    p_actor_id: actorId, p_request_id: input.requestId, p_description: input.description,
    p_page_path: input.pagePath, p_expected_text: input.expectedText,
  });
  if (error || !data) throw new Error("Code repair could not be queued. Check worker setup, pause controls and the request limit.");
  return { id: String(data.id), status: String(data.status) };
}

export async function cancelCodeRepair(id: string, actorId: string) {
  const db = createServiceRoleClient();
  const { data, error } = await db.from(CODE_REPAIR_TABLE).update({ status: "cancelled", lease_token: null, lease_expires_at: null, updated_at: new Date().toISOString() })
    .eq("id", id).eq("actor_id", actorId).in("status", ["queued", "running"]).select("id").maybeSingle();
  if (error || !data) throw new Error("This repair is no longer active.");
}

export async function claimCodeRepair(runUrl: string) {
  const db = createServiceRoleClient();
  const { data, error } = await db.rpc("claim_code_repair", { p_run_url: runUrl });
  if (error) throw new Error("Code repair queue is unavailable.");
  if (!data?.id) return null;
  return { id: data.id, leaseToken: data.lease_token, description: data.description, pagePath: data.page_path, expectedText: data.expected_text };
}

export async function recoverCodeRepair(id: string, runUrl: string) {
  const { data, error } = await createServiceRoleClient().rpc("recover_code_repair_lease", { p_id: id, p_run_url: runUrl });
  if (error) throw new Error("Code repair lease is unavailable.");
  if (!data?.id) return null;
  return { id: data.id, leaseToken: data.lease_token, description: data.description, pagePath: data.page_path, expectedText: data.expected_text };
}

export async function finishCodeRepair(id: string, leaseToken: string, raw: unknown) {
  const result = codeRepairResultSchema.parse(raw);
  const db = createServiceRoleClient();
  const task = await db.from(CODE_REPAIR_TABLE).select('page_path').eq('id', id).eq('lease_token', leaseToken).eq('status', 'running').maybeSingle();
  if (task.error || !task.data) throw new Error('Repair evidence does not match the queued scope.');
  const pagePath = task.data.page_path;
  if (result.changedFiles.some(path => !allowedTaskRepairPath(path, pagePath)) || (result.outcome === 'review_ready' && !acceptedRepairEvidence(result, pagePath))) throw new Error('Repair evidence does not match the queued scope.');
  const { data, error } = await db.rpc("finish_code_repair", { p_id: id, p_lease_token: leaseToken, p_result: result });
  if (error || !data) throw new Error("The repair was cancelled, paused, completed or its worker lease expired.");
  return result;
}

export async function codeRepairLeaseActive(id: string, leaseToken: string) {
  const db = createServiceRoleClient();
  const { data, error } = await db.rpc("code_repair_lease_active", { p_id: id, p_lease_token: leaseToken });
  if (error) throw new Error("Worker authorization could not be checked.");
  return data === true;
}
