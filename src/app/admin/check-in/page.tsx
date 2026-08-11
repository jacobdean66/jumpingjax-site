import { verifyAdminAccess } from "@/lib/admin/session";
import { businessDayYmdFromInstant } from "@/lib/open-play/business-day";
import { OpenPlayDeskNav } from "@/components/open-play/OpenPlayDeskNav";
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
  const isOwner = auth.role === "owner";

  return (
    <AdminShell>
      <AdminHeader eyebrow="Open Play" title="Check-in">
        <div className="flex flex-wrap gap-2">
          <AdminBackButton label="Back" />
          <AdminLogoutButton />
        </div>
      </AdminHeader>
      <p className="mt-3 max-w-xl text-sm font-semibold text-slate-600">
        Front-desk Open Play admissions for today&apos;s America/New_York business
        day. Search completed waivers, build a group, then confirm cash or card.
      </p>
      <OpenPlayDeskNav active="check-in" showOwnerTools={isOwner} />
      {isOwner ? (
        <p className="mt-3 max-w-xl text-xs font-semibold text-slate-500">
          Owner tools: open Daily report for net retained totals, or Corrections
          for method changes, refunds, voids, and attendee removals.
        </p>
      ) : null}
      <CheckInClient visitDateYmd={visitDateYmd} />
    </AdminShell>
  );
}
