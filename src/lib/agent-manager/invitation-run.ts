import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { InvitationAgentResult } from "@/lib/facility-parties/invitations/agent";

/** Best-effort operational proof that an invitation UI action invoked the specialist. */
export async function recordInvitationAgentRun(
  result: InvitationAgentResult,
): Promise<void> {
  const db = createServiceRoleClient();
  const { data: agent, error } = await db
    .from("agents")
    .select("id")
    .eq("key", "party-invitation")
    .maybeSingle<{ id: string }>();
  if (error || !agent) return;

  const now = new Date().toISOString();
  await Promise.all([
    db
      .from("agents")
      .update({
        status: "idle",
        last_activity_at: now,
        last_success_at: now,
        updated_at: now,
      })
      .eq("id", agent.id),
    db.from("agent_events").insert({
      agent_id: agent.id,
      event_type: `invitation.${result.action}`,
      summary: `Invitation ${result.action} completed with ${result.snapshot.themeId}`,
      metadata: {
        theme_id: result.snapshot.themeId,
        libraries: result.usedLibraries,
      },
    }),
  ]);
}
