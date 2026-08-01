import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "../../_components";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function ChangeOwnerPasswordPage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  return (
    <AdminShell>
      <AdminHeader eyebrow="Owner Admin" title="Change Password" />
      <AdminNav token="" role={auth.role} active="rentals" />
      <ChangePasswordForm />
    </AdminShell>
  );
}
