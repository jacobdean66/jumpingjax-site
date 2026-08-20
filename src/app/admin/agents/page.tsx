import { createLocalAgentPreview, isLocalAgentPreviewEnabled } from "@/lib/agent-manager/local-preview";
import { loadDashboard } from "@/lib/agent-manager/service";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "../_components";
import { AgentsDashboardClient } from "./AgentsDashboardClient";
import { TriggerProofClient } from "./TriggerProofClient";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  let dashboard = null;
  try {
    dashboard = await loadDashboard();
  } catch {
    if (isLocalAgentPreviewEnabled()) dashboard = createLocalAgentPreview();
  }

  return (
    <AdminShell>
      <AdminHeader eyebrow="Owner Tools" title="Agent Manager">
        <AdminNav token="" role={auth.role} active="agents" compact />
      </AdminHeader>
      <p className="mt-4 max-w-3xl text-sm font-semibold text-slate-600">
        Durable, event-driven operations. Models run only for future jobs that explicitly select a model worker; the health demonstration is deterministic.
      </p>
      <TriggerProofClient />
      {dashboard ? (
        <>
          {dashboard.demoMode ? (
            <div className="mt-7 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm font-bold text-violet-950">
              Local preview mode — representative non-customer data. Do not use controls; no database is connected.
            </div>
          ) : null}
          <AgentsDashboardClient initial={dashboard} />
        </>
      ) : (
        <section className="mt-7 rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-xl font-black">Database migration required</h2>
          <p className="mt-2 text-sm font-semibold">The Agent Manager migration has not been applied in this environment. No production migration is performed by this build.</p>
        </section>
      )}
    </AdminShell>
  );
}
