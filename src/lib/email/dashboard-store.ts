import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { GOOGLE_REPORTING_BUCKET, readGoogleReportingObject, writeGoogleReportingObject } from "@/lib/analytics/shared-google-store";
import { EMPTY_WORKFLOW, isEmailCategory, isEmailStatus, workflowPath, type EmailAccount, type Workflow, type WorkflowChange } from "./dashboard-core";

export async function readEmailWorkflow(account: EmailAccount, id: string): Promise<Workflow> {
  const [category, status, read] = await Promise.all((["category", "status", "read"] as const).map(field => readGoogleReportingObject<{ value: unknown }>(workflowPath(account, id, field))));
  return { category: isEmailCategory(category?.value) ? category.value : null, status: isEmailStatus(status?.value) ? status.value : "none", read: typeof read?.value === "boolean" ? read.value : null };
}
export async function readEmailWorkflows(account: EmailAccount, ids: string[]): Promise<Map<string, Workflow>> {
  const result = new Map<string, Workflow>(ids.map(id => [id, { ...EMPTY_WORKFLOW }]));
  if (!ids.length) return result;
  const client = createServiceRoleClient();
  const saved = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.storage.from(GOOGLE_REPORTING_BUCKET).list(`email-workflow/v1/${account}`, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error("Saved email categories and statuses could not be loaded.");
    for (const row of data ?? []) if (result.has(row.name)) saved.add(row.name);
    if ((data?.length ?? 0) < 1000 || saved.size === ids.length) break;
  }
  const existing = [...saved];
  for (let i = 0; i < existing.length; i += 5) await Promise.all(existing.slice(i, i + 5).map(async id => result.set(id, await readEmailWorkflow(account, id))));
  return result;
}
export async function saveEmailWorkflow(change: WorkflowChange, ownerId: string) {
  // Each field is independent, so two people changing different fields cannot overwrite each other.
  await writeGoogleReportingObject(workflowPath(change.account, change.id, change.field), {
    value: change.field === "category" && change.value === "auto" ? null : change.value,
    updatedAt: new Date().toISOString(), updatedBy: ownerId,
  });
}
