import { verifyAdminAccess } from "@/lib/admin/session";
import { businessDayYmdFromInstant } from "@/lib/open-play/business-day";
import { loadBirthdayPartiesForDay } from "@/lib/open-play/birthday-parties";
import { OpenPlayDeskNav } from "@/components/open-play/OpenPlayDeskNav";
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
  const birthdayParties = await loadBirthdayPartiesForDay(visitDateYmd).catch(() => []);
  const isOwner = auth.role === "owner";

  return (
    <AdminShell>
      <AdminHeader eyebrow="Open Play" title="Check-in" />
      <AdminNav token="" role={auth.role} active="open-play" />
      <p className="mt-3 max-w-xl text-sm font-semibold text-slate-600">
        Front-desk Open Play admissions for today. Search completed waivers,
        edit each child&apos;s price if needed, then choose cash, card, or free pass.
      </p>
      <OpenPlayDeskNav active="check-in" showOwnerTools={isOwner} />
      <CheckInClient visitDateYmd={visitDateYmd} birthdayParties={birthdayParties} />
    </AdminShell>
  );
}
