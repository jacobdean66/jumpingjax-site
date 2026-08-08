import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { businessDayYmdFromInstant } from "@/lib/open-play/business-day";
import {
  AdminAuthError,
  AdminHeader,
  AdminShell,
} from "../_components";
import { AdminBackButton } from "../AdminBackButton";
import { AdminLogoutButton } from "../AdminLogoutButton";
import { CorrectionsClient } from "./CorrectionsClient";

export const dynamic = "force-dynamic";

export default async function AdminOpenPlayCorrectionsPage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const initialDateYmd = businessDayYmdFromInstant(new Date());

  return (
    <AdminShell>
      <AdminHeader eyebrow="Open Play" title="Corrections">
        <div className="flex flex-wrap gap-2">
          <AdminBackButton label="Back" />
          <AdminLogoutButton />
        </div>
      </AdminHeader>
      <p className="mt-3 max-w-xl text-sm font-semibold text-slate-600">
        Owner-only method corrections, refunds, voids, and attendee removals. Original ledger
        entries stay visible; adjustments are appended by the server.
      </p>
      <CorrectionsClient initialDateYmd={initialDateYmd} />
    </AdminShell>
  );
}
