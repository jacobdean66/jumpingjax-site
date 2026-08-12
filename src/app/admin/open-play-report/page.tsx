import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { businessDayYmdFromInstant } from "@/lib/open-play/business-day";
import { OpenPlayDeskNav } from "@/components/open-play/OpenPlayDeskNav";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
} from "../_components";
import { DailyReportClient } from "./DailyReportClient";

export const dynamic = "force-dynamic";

export default async function AdminOpenPlayDailyReportPage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const initialDateYmd = businessDayYmdFromInstant(new Date());

  return (
    <AdminShell>
      <AdminHeader eyebrow="Open Play" title="Daily report" />
      <AdminNav token="" role={auth.role} active="open-play" />
      <p className="mt-3 max-w-xl text-sm font-semibold text-slate-600">
        Owner-only net retained admissions for the selected date. Totals include
        the effect of corrections, voids, and refunds.
      </p>
      <OpenPlayDeskNav active="daily-report" showOwnerTools />
      <DailyReportClient initialDateYmd={initialDateYmd} />
    </AdminShell>
  );
}
