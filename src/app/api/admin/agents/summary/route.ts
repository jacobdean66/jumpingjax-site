import { NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { agentNavigationSummary, UNKNOWN_AGENT_SUMMARY } from "@/lib/agent-manager/navigation-summary";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  let summary = UNKNOWN_AGENT_SUMMARY;
  try {
    const db = createServiceRoleClient();
    const { data: agent, error: agentError } = await db.from("agents").select("id").eq("key", "supervisor").maybeSingle();
    if (!agentError && agent) {
      const { data, error } = await db.from("agent_jobs").select("payload")
        .eq("agent_id", agent.id).in("job_type", ["system.website_watch", "supervisor.chat"])
        .eq("status", "succeeded").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!error) summary = agentNavigationSummary(data?.payload?.snapshot);
    }
  } catch { /* No saved check is explicitly unknown, never reported as healthy. */ }
  return NextResponse.json(summary, { headers: { "Cache-Control": "private, no-store" } });
}
