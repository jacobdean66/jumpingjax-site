import { verifyAdminAccess } from "@/lib/admin/session";
import { businessDayYmdFromInstant } from "@/lib/open-play/business-day";
import {
  AdminAuthError,
  AdminHeader,
  AdminShell,
} from "../_components";
import { AdminBackButton } from "../AdminBackButton";
import { AdminLogoutButton } from "../AdminLogoutButton";
import { CheckInClient } from "./CheckInClient";

export const dynamic = "force-dynamic";

export default async function AdminCheckInPage() {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const visitDateYmd = businessDayYmdFromInstant(new Date());

  return (
    <AdminShell>
      <AdminHeader eyebrow="Open Play" title="Check-in">
        <div className="flex flex-wrap gap-2">
          <AdminBackButton label="Back" />
          <AdminLogoutButton />
        </div>
      </AdminHeader>
      <CheckInClient visitDateYmd={visitDateYmd} />
    </AdminShell>
  );
}
