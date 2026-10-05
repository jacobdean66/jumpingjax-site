import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "../../_components";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { DriverPasswordForm } from "./DriverPasswordForm";
import { loadDriverAccounts } from "@/lib/admin/driver-accounts";
import { loadKnownDriverNames } from "@/lib/admin/driver-auth";
import { normalizeDriverUsername } from "@/lib/admin/driver-login-policy";

export const dynamic = "force-dynamic";

export default async function ChangeOwnerPasswordPage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  let driverNames: string[] = [];
  let driverError = false;
  try {
    const [accounts, assignedNames] = await Promise.all([loadDriverAccounts(), loadKnownDriverNames()]);
    const names = new Map<string, string>();
    for (const name of [...accounts.map((account) => account.display_name), ...assignedNames]) {
      if (!names.has(normalizeDriverUsername(name))) names.set(normalizeDriverUsername(name), name);
    }
    driverNames = [...names.values()].sort((a, b) => a.localeCompare(b));
  } catch {
    driverError = true;
  }

  return (
    <AdminShell>
      <AdminHeader eyebrow="Owner Admin" title="Change Password" />
      <AdminNav token="" role={auth.role} active="rentals" />
      <ChangePasswordForm />
      {driverError ? (
        <p role="alert" className="mt-6 max-w-2xl rounded-xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-800">
          Driver logins could not be loaded. Refresh this page to try again.
        </p>
      ) : <DriverPasswordForm driverNames={driverNames} />}
    </AdminShell>
  );
}
