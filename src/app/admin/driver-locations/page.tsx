import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
} from "@/app/admin/_components";
import { DriverLocationsClient } from "./DriverLocationsClient";
import { loadDriverLocationSnapshots } from "@/lib/admin/driver-location";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

export default async function AdminDriverLocationsPage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) {
    return <AdminAuthError reason={auth.reason} />;
  }

  const locations = await loadDriverLocationSnapshots();

  return (
    <AdminShell>
      <AdminHeader eyebrow="Driver tracking" title="Driver locations">
        <p className="max-w-xl text-sm font-bold leading-relaxed text-slate-600">
          Latest locations shared from the Driver App website and installed phone app.
          Browser sharing requires the driver page to stay open. The installed app
          supports background location when the phone permits it.
        </p>
      </AdminHeader>
      <AdminNav active="driver-locations" role={auth.role} token="" />
      <DriverLocationsClient initialLocations={locations} />
    </AdminShell>
  );
}
