import { verifyAdminAccess } from "@/lib/admin/session";
import { businessDayYmdFromInstant } from "@/lib/open-play/business-day";
import { OpenPlayDeskNav } from "@/components/open-play/OpenPlayDeskNav";
import { DailyReportActivity } from "@/components/open-play/DailyReportActivity";
import { getOpenPlayDailyReport } from "@/lib/open-play/report-service";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
} from "../_components";
import { CheckInClient } from "./CheckInClient";

export const dynamic = "force-dynamic";

export default async function AdminCheckInPage() {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const visitDateYmd = businessDayYmdFromInstant(new Date());
  const isOwner = auth.role === "owner";
  const todayReport = isOwner
    ? await getOpenPlayDailyReport(visitDateYmd).catch(() => null)
    : null;

  return (
    <AdminShell>
      <AdminHeader eyebrow="Open Play" title="Check-in" />
      <AdminNav token="" role={auth.role} active="open-play" />
      <p className="mt-3 max-w-xl text-sm font-semibold text-slate-600">
        Front-desk Open Play admissions for today. Search completed waivers,
        edit each child&apos;s price if needed, then choose cash, card, or free pass.
      </p>
      <OpenPlayDeskNav active="check-in" showOwnerTools={isOwner} />
      {isOwner ? (
        <p className="mt-3 max-w-xl text-xs font-semibold text-slate-500">
          Owner tools: open Daily report for net retained totals, or Corrections
          for method changes, refunds, voids, and attendee removals.
        </p>
      ) : null}
      <CheckInClient visitDateYmd={visitDateYmd} />
      {todayReport ? (
        <div className="mx-auto mt-8 max-w-6xl pb-10">
          <DailyReportActivity report={todayReport} />
        </div>
      ) : null}
    </AdminShell>
  );
}
