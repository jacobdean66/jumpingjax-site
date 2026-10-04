import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
} from "@/app/admin/_components";
import { DriverLocationsClient } from "./DriverLocationsClient";
import { loadDriverMobileLocationSnapshots } from "@/lib/admin/driver-location";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

export default async function AdminDriverLocationsPage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) {
    return <AdminAuthError reason={auth.reason} />;
  }

  const locations = await loadDriverMobileLocationSnapshots();

  return (
    <AdminShell>
      <AdminHeader eyebrow="Driver tracking" title="Driver locations">
        <p className="max-w-xl text-sm font-bold leading-relaxed text-slate-600">
          Live-ish driver tracking from the native Driver App. Locations are active
          while a driver is signed in and the phone allows background location.
        </p>
      </AdminHeader>
      <AdminNav active="driver-locations" role={auth.role} token="" />
      <DriverLocationsClient initialLocations={locations} />
    </AdminShell>
  );
}
