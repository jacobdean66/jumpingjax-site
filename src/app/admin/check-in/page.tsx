import { verifyAdminAccess } from "@/lib/admin/session";
import { businessDayYmdFromInstant } from "@/lib/open-play/business-day";
import { isYmd } from "@/lib/open-play/pricing";
import { loadDeskState } from "@/lib/open-play/desk-service";
import { OpenPlayDeskNav } from "@/components/open-play/OpenPlayDeskNav";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
} from "../_components";
import { WaiverDeskClient } from "./WaiverDeskClient";

export const dynamic = "force-dynamic";

export default async function AdminCheckInPage({ searchParams }: { searchParams?: Promise<{ date?: string }> }) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const today = businessDayYmdFromInstant(new Date());
  const params = await searchParams;
  const visitDateYmd = params?.date && isYmd(params.date) ? params.date : today;
  const initial = await loadDeskState(visitDateYmd).catch(() => null);
  const isOwner = auth.role === "owner";

  return (
    <AdminShell>
      <AdminHeader eyebrow="Open Play" title="Check-in" />
      <AdminNav token="" role={auth.role} active="open-play" />
      <p className="mt-3 max-w-xl text-sm font-semibold text-slate-600">
        Search first, last, or full names. Mark each guest here immediately,
        then put everyone paying together on one checkout ticket.
      </p>
      <OpenPlayDeskNav active="check-in" showOwnerTools={isOwner} />
      <form className="mt-4 flex flex-wrap items-center gap-2"><label htmlFor="desk-date" className="font-bold">Desk date</label><input id="desk-date" type="date" name="date" defaultValue={visitDateYmd} max={today} className="min-h-11 rounded-xl border border-slate-300 px-3" /><button className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 font-bold">View date</button><a href="/admin/check-in" className="font-bold underline">Today</a></form>
      <WaiverDeskClient key={visitDateYmd} day={visitDateYmd} initial={initial} isOwner={isOwner} readOnly={visitDateYmd !== today} />
    </AdminShell>
  );
}
