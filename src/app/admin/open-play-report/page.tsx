import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { businessDayYmdFromInstant } from "@/lib/open-play/business-day";
import { OpenPlayDeskNav } from "@/components/open-play/OpenPlayDeskNav";
import {
  AdminAuthError,
  AdminHeader,
  AdminShell,
} from "../_components";
import { AdminBackButton } from "../AdminBackButton";
import { AdminLogoutButton } from "../AdminLogoutButton";
import { DailyReportClient } from "./DailyReportClient";

export const dynamic = "force-dynamic";

export default async function AdminOpenPlayDailyReportPage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const initialDateYmd = businessDayYmdFromInstant(new Date());

  return (
    <AdminShell>
      <AdminHeader eyebrow="Open Play" title="Daily report">
        <div className="flex flex-wrap gap-2">
          <AdminBackButton label="Back" />
          <AdminLogoutButton />
        </div>
      </AdminHeader>
      <p className="mt-3 max-w-xl text-sm font-semibold text-slate-600">
        Owner-only net retained admissions for one America/New_York business day.
        Totals include the effect of corrections, voids, and refunds.
      </p>
      <OpenPlayDeskNav active="daily-report" showOwnerTools />
      <DailyReportClient initialDateYmd={initialDateYmd} />
    </AdminShell>
  );
}
