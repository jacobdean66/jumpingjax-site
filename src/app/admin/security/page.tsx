import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { loadSecurityDashboard } from "@/lib/security/dashboard-service";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "../_components";
import { SecurityDashboardClient } from "./SecurityDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const dashboard = await loadSecurityDashboard(auth.identity.id);

  return (
    <AdminShell>
      <AdminHeader eyebrow="Owner Tools" title="Security Center">
        <AdminNav token="" role={auth.role} active="security" compact />
      </AdminHeader>
      <p className="mt-4 max-w-3xl text-sm font-semibold leading-relaxed text-slate-600">
        One private control center for repository scanning and protected AI routing. Status refreshes are read-only. Live tests and branch scans run only when you press their button.
      </p>
      <SecurityDashboardClient initial={dashboard} />
    </AdminShell>
  );
}
